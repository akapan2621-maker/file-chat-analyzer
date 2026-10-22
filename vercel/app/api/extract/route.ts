import { NextRequest, NextResponse } from "next/server";

/**
 * PDF → text extraction.
 *
 * Uses a minimal, dependency-free PDF text extractor so the project stays
 * lean. Handles the common case: uncompressed and FlateDecode text streams
 * with Tj / TJ operators.
 */

export const runtime = "nodejs";

import { inflateSync } from "zlib";

const MAX_BYTES = 10 * 1024 * 1024;

function inflate(data: Uint8Array): Buffer | null {
  try {
    // Node's zlib is available in the Node runtime.
    return inflateSync(Buffer.from(data));
  } catch {
    return null;
  }
}

/** Decode PDF text-showing operators from a content stream. */
function extractTextFromContent(content: string): string {
  const out: string[] = [];

  // Match (string) Tj  and  [ (a) -1 (b) ] TJ
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bTJ\b|\bTj\b|\bTd\b|\bTD\b|\bT\*\b|\bET\b/g;

  let pending: string[] = [];
  for (const raw of content.split(/[\r\n]+/)) {
    const line = raw;
    let m: RegExpExecArray | null;
    const tokenizer = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g;
    while ((m = tokenizer.exec(line)) !== null) {
      const tok = m[0];
      if (tok.startsWith("(")) {
        let s = tok.slice(1, -1);
        s = s.replace(/\\([nrtbf()\\])/g, (_, c: string) => {
          switch (c) {
            case "n": return "\n";
            case "r": return "\r";
            case "t": return "\t";
            case "b": return "\b";
            case "f": return "\f";
            default: return c;
          }
        });
        s = s.replace(/\\([0-7]{1,3})/g, (_, o: string) =>
          String.fromCharCode(parseInt(o, 8))
        );
        pending.push(s);
      } else if (tok.startsWith("<")) {
        const hex = tok.slice(1, -1).replace(/\s/g, "");
        // Hex strings are usually UTF-16BE; fall back to latin-1.
        let s = "";
        if (hex.length % 4 === 0 && hex.length >= 4) {
          for (let i = 0; i < hex.length; i += 4) {
            s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
          }
        } else {
          for (let i = 0; i < hex.length; i += 2) {
            s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
          }
        }
        pending.push(s);
      }
    }

    if (/\bTj\b|\bTJ\b/.test(line) && pending.length) {
      out.push(pending.join(""));
      pending = [];
    } else if (/\bTd\b|\bTD\b|\bT\*\b|\bET\b/.test(line) && pending.length) {
      out.push(pending.join(""));
      pending = [];
      out.push("\n");
    }
  }
  if (pending.length) out.push(pending.join(""));

  return out.join("");
}

function extractPdfText(buf: Buffer): string {
  const latin = buf.toString("latin1");
  const chunks: string[] = [];

  // Find all stream ... endstream blocks.
  const streamRe = /stream\r?\n?([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(latin)) !== null) {
    const raw = m[1];
    let content: string;
    if (/FlateDecode/.test(latin.slice(Math.max(0, m.index - 400), m.index))) {
      const inflated = inflate(Buffer.from(raw, "latin1"));
      if (!inflated) continue;
      content = inflated.toString("latin1");
    } else {
      content = raw;
    }
    if (!/(Tj|TJ)/.test(content)) continue;
    const text = extractTextFromContent(content);
    if (text.trim()) chunks.push(text);
  }

  // Fallback for PDFs with no text layer (scanned images).
  if (!chunks.length) {
    const t = latin.match(/\((?:\\.|[^\\()])*\)/g);
    if (t) {
      chunks.push(
        t
          .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, "$1"))
          .join(" ")
      );
    }
  }

  return chunks
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const buf = Buffer.from(await req.arrayBuffer());

    if (buf.length === 0) {
      return NextResponse.json({ error: "ไม่ได้รับข้อมูลไฟล์" }, { status: 400 });
    }
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { error: `ไฟล์ใหญ่เกิน ${Math.round(MAX_BYTES / 1024 / 1024)} MB` },
        { status: 413 }
      );
    }
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "ไม่ใช่ไฟล์ PDF" }, { status: 400 });
    }

    const text = extractPdfText(buf);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "ไม่พบชั้นข้อความใน PDF (อาจเป็นไฟล์สแกนภาพ)" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text,
      chars: text.length,
      pages: (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอ่าน PDF" },
      { status: 500 }
    );
  }
}
