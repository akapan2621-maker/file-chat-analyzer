/**
 * Deterministic text-processing primitives.
 *
 * Every function here is pure and LLM-free: the same input ALWAYS produces
 * the same output. This is what makes the pipeline reproducible.
 */

import { segmentMixed } from "./thai";
import type { TextStats, StructureInfo, Keyword, Chunk } from "./types";

/* ── Unicode-aware helpers ─────────────────────────────────────────── */

// Thai has no spaces between words. Split on Thai character ranges too.
const THAI_RE = /[฀-๿]/;
const THAI_RUN_RE = /[฀-๿]+/g;

/**
 * Split text into word-like tokens.
 *
 * Latin words stay whole; Thai runs are segmented with a dictionary-driven
 * longest-match scan (see ./thai.ts) so we get real words ("ยอดขาย") instead
 * of one giant token per sentence.
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  return segmentMixed(text);
}

/** Thai-aware word count (Thai runs count as one word each). */
export function countWords(text: string): number {
  return tokenizeWords(text).length;
}

export function countSentences(text: string): number {
  if (!text.trim()) return 0;
  const parts = text.split(/[.!?。！？]+/);
  return parts.filter((p) => p.trim().length > 0).length;
}

export function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
}

/* ── Stats ─────────────────────────────────────────────────────────── */

export function computeStats(text: string): TextStats {
  const words = tokenizeWords(text);
  const thai = words.filter((w) => THAI_RE.test(w));
  const latin = words.filter((w) => /^[a-z0-9'_-]+$/.test(w) && !THAI_RE.test(w));
  const numeric = words.filter((w) => /^[0-9.,%$]+$/.test(w));
  const unique = new Set(words);

  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, "").length;
  const avgWordLength = words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 0;

  return {
    characters: chars,
    charactersNoSpace: charsNoSpace,
    words: words.length,
    uniqueTerms: unique.size,
    sentences: countSentences(text),
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
    paragraphs: countParagraphs(text),
    avgWordLength: Math.round(avgWordLength * 100) / 100,
    // 200 wpm for Thai, 220 for Latin — use the conservative figure
    readingTimeMinutes: Math.max(1, Math.round(words.length / 200)),
    thaiTerms: thai.length,
    latinTerms: latin.length,
    numericTerms: numeric.length,
  };
}

/* ── Structure detection ───────────────────────────────────────────── */

export function detectFormat(name: string, text: string): StructureInfo["kind"] {
  const lower = name.toLowerCase();
  // Extension wins for the unambiguous types.
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".json")) return "json";

  // .txt (and unknown) still get content-sniffed — a .txt file often holds
  // CSV or JSON, and treating it as plain text loses the table structure.
  if (/^#{1,6}\s+\S/m.test(text)) return "markdown";
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  if (firstLine.split(",").length >= 3 && firstLine.includes(",")) return "csv";
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      JSON.parse(t);
      return "json";
    } catch {
      /* not json */
    }
  }
  if (lower.endsWith(".txt")) return "plain";
  return "plain";
}

function detectDelimiter(header: string): string {
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = header.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

export function analyzeStructure(name: string, text: string): StructureInfo {
  const kind = detectFormat(name, text);
  const info: StructureInfo = { kind };

  if (kind === "markdown") {
    info.outline = text
      .split(/\r?\n/)
      .filter((l) => /^#{1,6}\s+/.test(l))
      .map((l) => ({
        level: (l.match(/^#+/) ?? ["#"])[0].length,
        text: l.replace(/^#+\s+/, "").trim(),
      }));
  }

  if (kind === "csv") {
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    const delimiter = detectDelimiter(lines[0] ?? "");
    const header = (lines[0] ?? "").split(delimiter).map((h) => h.trim());
    info.table = {
      rows: Math.max(0, lines.length - 1),
      columns: header.length,
      header,
      delimiter: delimiter === "\t" ? "\\t" : delimiter,
    };
  }

  if (kind === "json") {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        info.json = {
          type: "array",
          length: parsed.length,
          keys: parsed.length && typeof parsed[0] === "object" && parsed[0] !== null
            ? Object.keys(parsed[0] as Record<string, unknown>)
            : undefined,
          sample: parsed.slice(0, 2),
        };
      } else if (parsed && typeof parsed === "object") {
        info.json = {
          type: "object",
          keys: Object.keys(parsed as Record<string, unknown>),
          sample: Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).slice(0, 5)
          ),
        };
      } else {
        info.json = { type: typeof parsed, sample: parsed };
      }
    } catch (e) {
      info.json = { type: "invalid" };
      void e;
    }
  }

  const links = Array.from(new Set(text.match(/https?:\/\/[^\s)"'<>]+/g) ?? [])).slice(0, 50);
  if (links.length) info.links = links;

  const emails = Array.from(
    new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])
  ).slice(0, 50);
  if (emails.length) info.emails = emails;

  return info;
}

/* ── Keyword extraction (tf-idf, no LLM) ───────────────────────────── */

const STOPWORDS = new Set([
  // English
  "the","a","an","and","or","but","if","then","else","for","while","of","to","in","on","at","by",
  "with","from","as","is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","should","could","this","that","these","those","it","its","not","no","yes",
  "you","your","we","our","they","their","he","she","his","her","i","me","my","us","them","can",
  "may","might","must","shall","about","into","over","under","again","more","most","some","such",
  "only","own","same","so","than","too","very","just","also","there","here","all","any","each",
  // Thai (function words / common particles)
  "และ","หรือ","ที่","ซึ่ง","ของ","ใน","บน","กับ","โดย","เป็น","มี","ได้","ให้","จะ","ไม่",
  "มา","ไป","ก็","แล้ว","ยัง","อยู่","ควร","ต้อง","คือ","ถ้า","เมื่อ","เพราะ","เพื่อ","จาก",
  "กับ","ผม","ฉัน","คุณ","เรา","เขา","เธอ","มัน","ตัว","อีก","แล้ว","ทั้ง","ทุก","บาง","มาก",
]);

export function extractKeywords(text: string, topN = 15): Keyword[] {
  // tokenizeWords already segments Thai into dictionary words.
  const filtered = tokenizeWords(text).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  if (!filtered.length) return [];

  const tf = new Map<string, number>();
  for (const w of filtered) tf.set(w, (tf.get(w) ?? 0) + 1);

  // Document frequency over pseudo-documents = sentences.
  const sentences = text.split(/[.!?。！？\n]+/).filter((s) => s.trim());
  const df = new Map<string, number>();
  for (const s of sentences) {
    new Set(tokenizeWords(s).filter((w) => w.length > 1 && !STOPWORDS.has(w))).forEach((w) =>
      df.set(w, (df.get(w) ?? 0) + 1)
    );
  }

  const N = Math.max(1, sentences.length);
  const scored: Keyword[] = [];
  tf.forEach((count, term) => {
    const d = df.get(term) ?? 1;
    // Classic tf-idf, smoothed idf.
    const idf = Math.log(1 + N / d);
    const tfNorm = count / filtered.length;
    scored.push({ term, score: tfNorm * idf, count, df: d });
  });

  scored.sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));

  // Collapse near-duplicates. For Thai n-grams, a 3-gram is only meaningful
  // if it RECURS in the document — a 3-gram seen once is just a fragment of
  // a longer word, so require count >= 2 to be promoted to a keyword.
  const minCount = scored.some((k) => k.count > 1) ? 2 : 1;
  const out: Keyword[] = [];
  for (const k of scored) {
    if (k.count < minCount && k.term.length <= 3) continue;
    if (out.some((o) => o.term.startsWith(k.term) || k.term.startsWith(o.term))) continue;
    out.push(k);
    if (out.length >= topN) break;
  }
  return out;
}

/* ── Chunking ──────────────────────────────────────────────────────── */

export function chunkText(text: string, chunkSize = 800, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  if (!text || !text.length) return chunks;

  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const body = text.slice(start, end);
    chunks.push({
      id: `chunk-${index}`,
      index,
      text: body,
      startChar: start,
      endChar: end,
      tokenCount: countWords(body),
    });
    index += 1;
    if (end >= text.length) break;
    start = end - overlap;
    if (start <= 0) {
      start = 0;
      if (index > 1) break;
    }
  }
  return chunks;
}

/* ── Retrieval (BM25-lite scoring, no LLM) ─────────────────────────── */

export function retrieve(
  chunks: Chunk[],
  query: string,
  topK = 5
): { chunkId: string; chunkIndex: number; score: number; snippet: string; matchedTerms: string[] }[] {
  const qTerms = Array.from(
    new Set(tokenizeWords(query).filter((w) => w.length > 1 && !STOPWORDS.has(w)))
  );
  if (!qTerms.length || !chunks.length) return [];

  const docTokens = chunks.map((c) => tokenizeWords(c.text));
  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    new Set(tokens).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
  }

  const N = chunks.length;
  const avgLen = docTokens.reduce((a, t) => a + t.length, 0) / N || 1;

  const scored = chunks.map((chunk, i) => {
    const tokens = docTokens[i];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    const matched: string[] = [];
    for (const q of qTerms) {
      // Thai has no spaces, so a query term is often only a SUBSTRING of a
      // document token ("เว็บไซต์" inside "ยอดขายผ่านเว็บไซต์โตมาก").
      // Count both exact hits and substring hits.
      let f = tf.get(q) ?? 0;
      if (!f) {
        // for..of over a Map needs downlevelIteration; use forEach instead.
        tf.forEach((n, tok) => {
          if (tok.includes(q)) f += n;
        });
      }
      if (!f) continue;
      matched.push(q);
      const n = df.get(q) ?? 1;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + 1.2 * (0.25 + 0.75 * (tokens.length / avgLen));
      score += idf * ((f * 2.2) / denom);
    }
    return {
      chunkId: chunk.id,
      chunkIndex: chunk.index,
      score: Math.round(score * 10000) / 10000,
      snippet: chunk.text.slice(0, 220).trim(),
      matchedTerms: matched,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, topK);
}
