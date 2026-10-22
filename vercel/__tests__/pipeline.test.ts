import { describe, it, expect } from "vitest";
import {
  analyzeStructure,
  chunkText,
  computeStats,
  countSentences,
  countWords,
  detectFormat,
  extractKeywords,
  retrieve,
  tokenizeWords,
} from "@/lib/pipeline/processing";
import { runPipeline } from "@/lib/pipeline/run";
import { segmentThai, segmentMixed } from "@/lib/pipeline/thai";
import type { ExtractedFile } from "@/lib/pipeline/types";

const SAMPLE = `# รายงานยอดขายไตรมาส 3

ยอดขายรวม **$4,149.60** เพิ่มขึ้น 5.50 ดอลลาร์

## ช่องทางขาย
- เว็บไซต์: 42% ของยอดขาย
- ร้านค้า: 35%
- ตัวแทน: 23%

ติดต่อ: sales@example.com
ดูเพิ่มเติม https://example.com/report

## ข้อสังเกต
ยอดขายผ่านช่องทางเว็บไซต์โตมากที่สุด เพราะลูกค้าสั่งซื้อผ่านโปรโมชั่นฤดูฝน
ยอดขายรวมเติบโต 0.13% เมื่อเทียบกับราคาปิดก่อนหน้า
`;

function makeFile(overrides: Partial<ExtractedFile> = {}): ExtractedFile {
  return {
    id: "f1",
    name: "report.md",
    format: "md",
    size: SAMPLE.length,
    text: SAMPLE,
    lineCount: SAMPLE.split("\n").length,
    source: "browser",
    ...overrides,
  };
}

describe("tokenizeWords", () => {
  it("splits latin words case-insensitively", () => {
    expect(tokenizeWords("Hello World HELLO")).toEqual(["hello", "world", "hello"]);
  });

  it("segments Thai into dictionary words (no spaces in Thai)", () => {
    // "ยอดขายรวมโต" must NOT be one token — the segmenter recovers
    // "ยอดขาย" + "รวม" + "โต".
    const t = tokenizeWords("ยอดขายรวมโต");
    expect(t).toContain("ยอดขาย");
    expect(t).not.toContain("ยอดขายรวมโต");
  });

  it("returns empty array for empty input", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("countWords / countSentences", () => {
  it("counts latin + thai tokens", () => {
    expect(countWords("gold price rises")).toBe(3);
    // Thai "ยอดขาย" is one word, "ดี" another — the segmenter splits on the
    // dictionary, so this is 2 words, not 1 giant token.
    expect(countWords("ยอดขายดีมาก")).toBeGreaterThanOrEqual(2);
  });

  it("counts sentences by terminator", () => {
    expect(countSentences("One. Two! Three?")).toBe(3);
  });
});

describe("computeStats", () => {
  it("is deterministic", () => {
    const a = computeStats(SAMPLE);
    const b = computeStats(SAMPLE);
    expect(a).toEqual(b);
  });

  it("reports sensible counts", () => {
    const s = computeStats(SAMPLE);
    expect(s.characters).toBe(SAMPLE.length);
    expect(s.words).toBeGreaterThan(20);
    expect(s.uniqueTerms).toBeGreaterThan(10);
    expect(s.uniqueTerms).toBeLessThanOrEqual(s.words);
    expect(s.sentences).toBeGreaterThan(0);
  });
});

describe("detectFormat / analyzeStructure", () => {
  it("detects markdown by extension", () => {
    expect(detectFormat("a.md", "")).toBe("markdown");
  });

  it("detects csv by content", () => {
    expect(detectFormat("data.txt", "a,b,c\n1,2,3")).toBe("csv");
  });

  it("detects json by content", () => {
    expect(detectFormat("data.txt", '{"a":1}')).toBe("json");
  });

  it("extracts markdown outline", () => {
    const s = analyzeStructure("r.md", SAMPLE);
    expect(s.kind).toBe("markdown");
    expect(s.outline?.length).toBe(3);
    expect(s.outline?.[0].text).toBe("รายงานยอดขายไตรมาส 3");
  });

  it("extracts links and emails", () => {
    const s = analyzeStructure("r.md", SAMPLE);
    expect(s.emails).toContain("sales@example.com");
    expect(s.links?.some((l) => l.includes("example.com"))).toBe(true);
  });

  it("parses csv table dimensions", () => {
    const s = analyzeStructure("d.csv", "name,qty,price\nA,1,10\nB,2,20");
    expect(s.kind).toBe("csv");
    expect(s.table?.rows).toBe(2);
    expect(s.table?.columns).toBe(3);
    expect(s.table?.header).toEqual(["name", "qty", "price"]);
  });
});

describe("extractKeywords", () => {
  it("is deterministic and excludes stopwords", () => {
    const a = extractKeywords(SAMPLE, 10);
    const b = extractKeywords(SAMPLE, 10);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(10);
    const terms = a.map((k) => k.term);
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("และ");
  });

  it("ranks higher tf-idf terms first", () => {
    const k = extractKeywords(SAMPLE, 10);
    for (let i = 1; i < k.length; i++) {
      expect(k[i - 1].score).toBeGreaterThanOrEqual(k[i].score);
    }
  });
});

describe("chunkText", () => {
  it("splits long text into overlapping chunks", () => {
    const chunks = chunkText("x".repeat(2000), 800, 150);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startChar).toBe(0);
    expect(chunks[1].startChar).toBe(650); // 800 - 150 overlap
  });

  it("returns empty for empty text", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("keeps total text recoverable", () => {
    const text = "ก".repeat(500);
    const chunks = chunkText(text, 800, 150);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
  });
});

describe("retrieve", () => {
  it("ranks the chunk containing the query term first", () => {
    const chunks = chunkText(
      "ยอดขายเว็บไซต์โตมาก\nอื่นๆ ไม่เกี่ยว\nเว็บไซต์คือช่องทางหลักของเรา",
      40,
      5
    );
    const hits = retrieve(chunks, "เว็บไซต์", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("returns empty when nothing matches", () => {
    const chunks = chunkText(SAMPLE, 800, 150);
    expect(retrieve(chunks, "zzzzzqqqq", 3)).toEqual([]);
  });

  it("returns empty for empty query", () => {
    const chunks = chunkText(SAMPLE, 800, 150);
    expect(retrieve(chunks, "", 3)).toEqual([]);
  });
});

describe("runPipeline", () => {
  it("runs all stages and produces a Thai summary", async () => {
    const res = await runPipeline({ files: [makeFile()] });
    const ids = res.stages.map((s) => s.id);
    expect(ids).toContain("input");
    expect(ids).toContain("extract");
    expect(ids).toContain("stats");
    expect(ids).toContain("structure");
    expect(ids).toContain("keywords");
    expect(ids).toContain("chunk");
    expect(ids).toContain("index");
    expect(ids).toContain("output");
    expect(res.output.summary).toContain("ไม่ใช้ LLM");
    expect(res.output.summary).toContain("report.md");
  });

  it("is fully deterministic — identical input gives identical output", async () => {
    const a = await runPipeline({ files: [makeFile()], query: "ยอดขาย" });
    const b = await runPipeline({ files: [makeFile()], query: "ยอดขาย" });
    expect(a.output.json).toBe(b.output.json);
    expect(a.output.summary).toBe(b.output.summary);
  });

  it("marks the retrieve stage skipped when there is no query", async () => {
    const res = await runPipeline({ files: [makeFile()] });
    const stage = res.stages.find((s) => s.id === "retrieve");
    expect(stage?.status).toBe("skipped");
  });

  it("returns passages when a query is supplied", async () => {
    const res = await runPipeline({ files: [makeFile()], query: "เว็บไซต์" });
    const stage = res.stages.find((s) => s.id === "retrieve");
    expect(stage?.status).toBe("done");
    expect(res.output.data.passages.length).toBeGreaterThan(0);
  });

  it("reports totals in the structured output", async () => {
    const res = await runPipeline({ files: [makeFile()] });
    const totals = res.output.data.totals;
    expect(totals.files).toBe(1);
    expect(totals.words).toBeGreaterThan(0);
    expect(totals.chunks).toBeGreaterThan(0);
    expect(totals.keywords).toBeGreaterThan(0);
  });

  it("emits valid JSON", async () => {
    const res = await runPipeline({ files: [makeFile()] });
    expect(() => JSON.parse(res.output.json)).not.toThrow();
  });

  it("handles an empty file list without throwing", async () => {
    const res = await runPipeline({ files: [] });
    expect(res.output.data.totals.files).toBe(0);
    expect(res.output.summary).toContain("ไม่มีไฟล์");
  });

  it("handles a file that failed to extract", async () => {
    const res = await runPipeline({
      files: [makeFile({ text: "", error: "อ่านไม่ได้" })],
    });
    expect(res.output.data.files[0].error).toBe("อ่านไม่ได้");
  });
});


describe("Thai segmentation", () => {
  it("splits a run into dictionary words", () => {
    const out = segmentThai("ยอดขายรวม");
    expect(out).toContain("ยอดขาย");
  });

  it("prefers the longest match", () => {
    const out = segmentThai("ช่องทางขาย");
    expect(out).toContain("ช่องทางขาย");
    expect(out).not.toContain("ช่องทาง");
  });

  it("falls back to 3-char fragments for unknown words", () => {
    const out = segmentThai("ซิงซิงหวี");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((o) => o.length <= 3)).toBe(true);
  });

  it("never starts a token with a combining mark", () => {
    const out = segmentThai("่ำก");
    expect(out.every((o) => !"่้๊๋์ั".includes(o[0]))).toBe(true);
  });

  it("keeps latin words whole in mixed text", () => {
    const out = segmentMixed("ยอดขาย gold price");
    expect(out).toContain("gold");
    expect(out).toContain("price");
  });
});
