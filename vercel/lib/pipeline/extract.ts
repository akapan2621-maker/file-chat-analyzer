/**
 * File ingestion for the pipeline.
 *
 * Text-like files are read in the browser (no upload, no server round-trip).
 * PDFs are extracted on the server (they need a binary parser).
 */

import { formatFromName } from "./run";
import type { ExtractedFile, FileFormat } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ExtractionResult {
  file: ExtractedFile;
  /** Set when the file needs server-side extraction */
  needsServer?: boolean;
}

/** Read a File as text in the browser. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsText(file);
  });
}

/** Extract text from a PDF via the server route. */
export async function extractPdfViaServer(
  file: File
): Promise<{ text: string; error?: string }> {
  try {
    const buf = await file.arrayBuffer();
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: buf,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { text: "", error: `PDF อ่านไม่สำเร็จ (${res.status}) ${body.slice(0, 120)}` };
    }
    const json = await res.json();
    if (json.error) return { text: "", error: String(json.error) };
    return { text: String(json.text ?? "") };
  } catch (e) {
    return { text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Extract one file. Text formats are read locally; PDFs go to the server.
 * Never throws — a failure becomes `error` on the returned record.
 */
export async function extractFile(file: File): Promise<ExtractedFile> {
  const format = formatFromName(file.name);
  const base: ExtractedFile = {
    id: crypto.randomUUID(),
    name: file.name,
    format,
    size: file.size,
    text: "",
    lineCount: 0,
    source: "browser",
  };

  if (file.size > MAX_FILE_BYTES) {
    return {
      ...base,
      error: `ไฟล์ใหญ่เกิน ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`,
    };
  }

  try {
    if (format === "pdf") {
      const { text, error } = await extractPdfViaServer(file);
      return {
        ...base,
        text,
        lineCount: text ? text.split(/\r\n|\r|\n/).length : 0,
        source: "server",
        error,
      };
    }

    if (format === "unknown") {
      return { ...base, error: "รองรับเฉพาะ .txt .md .csv .json .pdf" };
    }

    const text = await readFileAsText(file);
    return {
      ...base,
      text,
      lineCount: text ? text.split(/\r\n|\r|\n/).length : 0,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Extract many files sequentially (keeps memory predictable). */
export async function extractFiles(files: File[]): Promise<ExtractedFile[]> {
  const out: ExtractedFile[] = [];
  for (const f of files) {
    out.push(await extractFile(f));
  }
  return out;
}

export const ACCEPTED_EXTENSIONS = ".txt,.md,.markdown,.csv,.json,.pdf";
