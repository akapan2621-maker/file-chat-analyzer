/**
 * The pipeline orchestrator.
 *
 * INPUT → PROCESS → OUTPUT, fully deterministic and LLM-free.
 * Each stage records its own timing and summary so the UI can show the
 * process transparently.
 */

import {
  analyzeStructure,
  chunkText,
  computeStats,
  countWords,
  extractKeywords,
  retrieve,
  tokenizeWords,
} from "./processing";
import type {
  ExtractedFile,
  FileFormat,
  PipelineInput,
  PipelineOutput,
  PipelineResult,
  StageId,
  StageResult,
  StageStatus,
} from "./types";

/** Formats the browser can read as plain text directly. */
export const BROWSER_TEXT_FORMATS: FileFormat[] = ["txt", "md", "csv", "json"];

export function formatFromName(name: string): FileFormat {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".pdf")) return "pdf";
  return "unknown";
}

/** Stage wrapper: runs `fn`, records status/timing, never throws. */
async function runStage<T>(
  id: StageId,
  title: string,
  fn: () => T | Promise<T>,
  summarize: (result: T) => { summary: string; detail?: string; data?: unknown }
): Promise<{ stage: StageResult; result: T }> {
  const started = Date.now();
  try {
    const result = await fn();
    const s = summarize(result);
    return {
      stage: {
        id,
        title,
        status: "done",
        summary: s.summary,
        detail: s.detail,
        data: s.data,
        durationMs: Date.now() - started,
      },
      result,
    };
  } catch (err) {
    return {
      stage: {
        id,
        title,
        status: "error",
        summary: `ผิดพลาด: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - started,
      },
      result: undefined as T,
    };
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("th-TH");
}

/** Build the deterministic Thai summary — no LLM involved. */
function buildSummary(
  files: ExtractedFile[],
  perFile: {
    stats: ReturnType<typeof computeStats>;
    keywords: { term: string; count: number }[];
    chunkCount: number;
    format: FileFormat;
  }[],
  passages: { score: number; matchedTerms: string[] }[]
): string {
  const lines: string[] = [];
  const totalWords = perFile.reduce((a, f) => a + f.stats.words, 0);
  const totalChunks = perFile.reduce((a, f) => a + f.chunkCount, 0);

  lines.push("📊 ผลการประมวลผลเอกสาร (ไม่ใช้ LLM)");
  lines.push("");

  if (!files.length) {
    lines.push("ไม่มีไฟล์ให้ประมวลผล — อัปโหลดไฟล์เพื่อเริ่มต้น");
    return lines.join("\n");
  }

  lines.push(`📁 ไฟล์ ${files.length} รายการ · ${fmtNum(totalWords)} คำ · ${fmtNum(totalChunks)} ชิ้นข้อมูล`);
  lines.push("");

  perFile.forEach((f, i) => {
    const file = files[i];
    lines.push(`📄 ${file.name}`);
    lines.push(
      `   รูปแบบ ${f.format.toUpperCase()} · ${fmtBytes(file.size)} · ${fmtNum(f.stats.words)} คำ · ` +
        `${fmtNum(f.stats.uniqueTerms)} คำที่ไม่ซ้ำ · ${fmtNum(f.stats.sentences)} ประโยค`
    );
    lines.push(
      `   อ่านประมาณ ${f.stats.readingTimeMinutes} นาที · ไทย ${fmtNum(f.stats.thaiTerms)} คำ · ` +
        `อังกฤษ ${fmtNum(f.stats.latinTerms)} คำ · ตัวเลข ${fmtNum(f.stats.numericTerms)} คำ`
    );
    if (f.keywords.length) {
      const kw = f.keywords.slice(0, 8).map((k) => `${k.term} (${k.count})`).join(" · ");
      lines.push(`   🔑 คำสำคัญ: ${kw}`);
    }
    lines.push(`   🧩 แบ่งเป็น ${fmtNum(f.chunkCount)} ชิ้นข้อมูล`);
    lines.push("");
  });

  if (passages.length) {
    lines.push("🎯 ผลการค้นคืน (จัดอันดับด้วยคะแนนความเกี่ยวข้อง):");
    passages.forEach((p, i) => {
      lines.push(
        `   ${i + 1}. คะแนน ${p.score.toFixed(3)} · คำที่ตรง: ${p.matchedTerms.join(", ") || "-"}`
      );
    });
  }

  return lines.join("\n");
}

/**
 * Run the full pipeline.
 *
 * INPUT  : files (+ optional query)
 * PROCESS: extract → normalize → tokenize → stats → structure → keywords → chunk → index → retrieve
 * OUTPUT : Thai summary + stable JSON
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const stages: StageResult[] = [];
  const topK = input.topK ?? 5;
  const topKeywords = input.topKeywords ?? 15;

  /* ── INPUT ─────────────────────────────────────────────────────── */
  const inputStage = await runStage(
    "input",
    "INPUT · รับไฟล์และคำค้น",
    () => {
      const nFiles = input.files.length;
      const nBytes = input.files.reduce((a, f) => a + f.size, 0);
      return { nFiles, nBytes, query: input.query ?? "" };
    },
    (r) => ({
      summary: `${r.nFiles} ไฟล์ · ${fmtBytes(r.nBytes)}${r.query ? ` · คำค้น "${r.query}"` : " · ไม่มีคำค้น"}`,
      data: r,
    })
  );
  stages.push(inputStage.stage);

  const files = input.files;

  /* ── PROCESS ───────────────────────────────────────────────────── */

  // 1. Extract — normalise line endings, strip BOM, trim trailing spaces.
  const extractStage = await runStage(
    "extract",
    "PROCESS · สกัดและทำความสะอาดข้อความ",
    () =>
      files.map((f) => {
        let text = f.text ?? "";
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
        text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        text = text
          .split("\n")
          .map((l) => l.replace(/[ \t]+$/, ""))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        return { ...f, text, lineCount: text ? text.split("\n").length : 0 };
      }),
    (r) => {
      const totalChars = r.reduce((a, f) => a + f.text.length, 0);
      const failed = r.filter((f) => f.error).length;
      return {
        summary:
          `รวม ${fmtNum(totalChars)} ตัวอักษร` +
          (failed ? ` · ⚠️ ${failed} ไฟล์อ่านไม่ได้` : " · ทุกไฟล์อ่านได้"),
        data: { totalChars, failed },
      };
    }
  );
  stages.push(extractStage.stage);
  const extracted = extractStage.result ?? files;

  // 2. Normalize — collapse whitespace runs inside each line.
  const normalizeStage = await runStage(
    "normalize",
    "PROCESS · ปรับมาตรฐานช่องว่าง",
    () =>
      extracted.map((f) => ({
        ...f,
        text: f.text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n"),
      })),
    (r) => ({
      summary: `เตรียม ${r.length} ไฟล์พร้อมประมวลผล`,
      data: { files: r.length },
    })
  );
  stages.push(normalizeStage.stage);
  const normalized = normalizeStage.result ?? extracted;

  // 3. Tokenize + 4. Stats (per file).
  const statsStage = await runStage(
    "stats",
    "PROCESS · ตัดคำและคำนวณสถิติ",
    () =>
      normalized.map((f) => {
        const tokens = tokenizeWords(f.text);
        return { file: f, tokenCount: tokens.length, stats: computeStats(f.text) };
      }),
    (r) => {
      const words = r.reduce((a, x) => a + x.stats.words, 0);
      const unique = r.reduce((a, x) => a + x.stats.uniqueTerms, 0);
      return {
        summary: `${fmtNum(words)} คำ · ${fmtNum(unique)} คำที่ไม่ซ้ำ`,
        detail: r
          .map(
            (x) =>
              `${x.file.name}: ${fmtNum(x.stats.words)} คำ, ${fmtNum(x.stats.uniqueTerms)} unique, ` +
              `${fmtNum(x.stats.sentences)} ประโยค, ${x.stats.readingTimeMinutes} นาที`
          )
          .join("\n"),
        data: { words, unique },
      };
    }
  );
  stages.push(statsStage.stage);
  const statsRows = statsStage.result ?? [];

  // 5. Structure.
  const structureStage = await runStage(
    "structure",
    "PROCESS · วิเคราะห์โครงสร้าง",
    () =>
      statsRows.map((r) => ({
        ...r,
        structure: analyzeStructure(r.file.name, r.file.text),
      })),
    (r) => {
      const kinds = r.reduce<Record<string, number>>((acc, x) => {
        acc[x.structure.kind] = (acc[x.structure.kind] ?? 0) + 1;
        return acc;
      }, {});
      const parts = Object.entries(kinds).map(([k, v]) => `${k} ${v}`);
      const detail = r
        .map((x) => {
          const s = x.structure;
          const bits: string[] = [];
          if (s.outline?.length) bits.push(`หัวข้อ ${s.outline.length} ระดับ`);
          if (s.table) bits.push(`ตาราง ${s.table.rows}×${s.table.columns}`);
          if (s.json) bits.push(`JSON ${s.json.type}`);
          if (s.links?.length) bits.push(`ลิงก์ ${s.links.length}`);
          if (s.emails?.length) bits.push(`อีเมล ${s.emails.length}`);
          return `${x.file.name}: ${bits.join(" · ") || "ข้อความธรรมดา"}`;
        })
        .join("\n");
      return { summary: parts.join(" · ") || "ไม่มีข้อมูล", detail, data: kinds };
    }
  );
  stages.push(structureStage.stage);
  const structureRows = structureStage.result ?? statsRows;

  // 6. Keywords (tf-idf).
  const keywordStage = await runStage(
    "keywords",
    "PROCESS · สกัดคำสำคัญ (tf-idf)",
    () =>
      structureRows.map((r) => ({
        ...r,
        keywords: extractKeywords(r.file.text, topKeywords),
      })),
    (r) => {
      const total = r.reduce((a, x) => a + x.keywords.length, 0);
      const top = r[0]?.keywords.slice(0, 10).map((k) => k.term).join(" · ");
      return {
        summary: `${total} คำสำคัญ${top ? ` · สูงสุด: ${top}` : ""}`,
        data: { total },
      };
    }
  );
  stages.push(keywordStage.stage);
  const keywordRows = keywordStage.result ?? structureRows;

  // 7. Chunk.
  const chunkStage = await runStage(
    "chunk",
    "PROCESS · แบ่งข้อความเป็นชิ้นข้อมูล",
    () =>
      keywordRows.map((r) => ({
        ...r,
        chunks: chunkText(r.file.text, 800, 150),
      })),
    (r) => {
      const total = r.reduce((a, x) => a + x.chunks.length, 0);
      const avg = r.length ? Math.round(total / r.length) : 0;
      return { summary: `${fmtNum(total)} ชิ้น (เฉลี่ย ${avg} ชิ้น/ไฟล์)`, data: { total, avg } };
    }
  );
  stages.push(chunkStage.stage);
  const chunkRows = chunkStage.result ?? keywordRows;

  // 8. Index — flatten all chunks into one searchable index.
  const indexStage = await runStage(
    "index",
    "PROCESS · สร้างดัชนีค้นคืน",
    () => {
      const index: {
        chunkId: string;
        chunkIndex: number;
        fileName: string;
        text: string;
        tokenCount: number;
      }[] = [];
      for (const row of chunkRows) {
        for (const c of row.chunks) {
          index.push({
            chunkId: `${row.file.name}#${c.id}`,
            chunkIndex: c.index,
            fileName: row.file.name,
            text: c.text,
            tokenCount: c.tokenCount,
          });
        }
      }
      return index;
    },
    (r) => {
      const files = new Set(r.map((x) => x.fileName)).size;
      const tokens = r.reduce((a, x) => a + x.tokenCount, 0);
      return {
        summary: `${fmtNum(r.length)} ชิ้นจาก ${files} ไฟล์ · ${fmtNum(tokens)} คำในดัชนี`,
        data: { chunks: r.length, files, tokens },
      };
    }
  );
  stages.push(indexStage.stage);
  const index = indexStage.result ?? [];

  // 9. Retrieve — only when a query was supplied.
  const retrieveStage = await runStage(
    "retrieve",
    "PROCESS · ค้นคืนข้อมูลที่ตรงคำค้น",
    () => {
      if (!input.query?.trim() || !index.length) return [];
      return retrieve(
        index.map((x, i) => ({
          id: x.chunkId,
          index: i,
          text: x.text,
          startChar: 0,
          endChar: x.text.length,
          tokenCount: x.tokenCount,
        })),
        input.query,
        topK
      );
    },
    (r) => ({
      status: undefined as unknown as StageStatus,
      summary: r.length
        ? `พบ ${r.length} ชิ้น · คะแนนสูงสุด ${r[0].score.toFixed(3)}`
        : input.query?.trim()
          ? "ไม่พบชิ้นข้อมูลที่ตรงคำค้น"
          : "ข้าม — ไม่มีคำค้น",
      data: { count: r.length },
    })
  );
  // The retrieve stage is optional — mark it skipped when there is no query.
  if (!input.query?.trim()) {
    retrieveStage.stage.status = "skipped";
  }
  stages.push(retrieveStage.stage);
  const passages = retrieveStage.result ?? [];

  /* ── OUTPUT ────────────────────────────────────────────────────── */
  const perFileMeta = chunkRows.map((r) => ({
    name: r.file.name,
    format: r.file.format,
    size: r.file.size,
    stats: r.stats,
    structure: r.structure,
    keywords: r.keywords,
    chunkCount: r.chunks.length,
    error: r.file.error,
  }));

  const data: PipelineOutput["data"] = {
    files: perFileMeta,
    query: input.query,
    passages,
    totals: {
      files: files.length,
      characters: perFileMeta.reduce((a, f) => a + f.stats.characters, 0),
      words: perFileMeta.reduce((a, f) => a + f.stats.words, 0),
      chunks: index.length,
      keywords: perFileMeta.reduce((a, f) => a + f.keywords.length, 0),
    },
  };

  const summary = buildSummary(
    normalized,
    perFileMeta.map((f) => ({
      stats: f.stats,
      keywords: f.keywords,
      chunkCount: f.chunkCount,
      format: f.format,
    })),
    passages
  );

  const output: PipelineOutput = {
    summary,
    data,
    json: JSON.stringify(data, null, 2),
  };

  stages.push({
    id: "output",
    title: "OUTPUT · สรุปผลและข้อมูล JSON",
    status: "done",
    summary: `สรุป ${fmtNum(summary.length)} ตัวอักษร · JSON ${fmtNum(output.json.length)} ตัวอักษร`,
    detail: [
      `ไฟล์ ${data.totals.files} · คำ ${fmtNum(data.totals.words)} · ชิ้น ${fmtNum(data.totals.chunks)} · คำสำคัญ ${fmtNum(data.totals.keywords)}`,
      passages.length ? `ผลค้นคืน ${passages.length} ชิ้น` : "ไม่มีผลค้นคืน",
    ].join("\n"),
    data: { summaryChars: summary.length, jsonChars: output.json.length },
    durationMs: 0,
  });

  return {
    stages,
    output,
    durationMs: Date.now() - pipelineStart,
  };
}
