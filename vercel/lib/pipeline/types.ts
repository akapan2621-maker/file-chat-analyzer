/**
 * Pipeline types — the explicit contract for the
 * INPUT → PROCESS → OUTPUT workflow.
 *
 * Every stage is deterministic: the same input always produces the same
 * output. No LLM is involved in any stage.
 */

export type StageId =
  | "input"
  | "extract"
  | "normalize"
  | "tokenize"
  | "stats"
  | "structure"
  | "keywords"
  | "chunk"
  | "index"
  | "retrieve"
  | "output";

export type StageStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface StageResult {
  id: StageId;
  /** Thai title shown in the UI */
  title: string;
  status: StageStatus;
  /** One-line summary of what this stage produced */
  summary: string;
  /** Multi-line detail (optional) */
  detail?: string;
  /** Machine-readable payload for the stage */
  data?: unknown;
  /** Wall-clock duration in ms */
  durationMs: number;
}

export type FileFormat = "txt" | "md" | "csv" | "json" | "pdf" | "unknown";

export interface ExtractedFile {
  id: string;
  name: string;
  format: FileFormat;
  /** Bytes as reported by the browser */
  size: number;
  /** Raw text after extraction ("" when extraction failed) */
  text: string;
  /** Number of lines in the raw text */
  lineCount: number;
  /** Extraction problem, if any */
  error?: string;
  /** Where the text came from */
  source: "browser" | "server";
}

export interface TextStats {
  characters: number;
  charactersNoSpace: number;
  words: number;
  uniqueTerms: number
  sentences: number;
  lines: number;
  paragraphs: number;
  avgWordLength: number;
  readingTimeMinutes: number;
  thaiTerms: number;
  latinTerms: number;
  numericTerms: number;
}

export interface StructureInfo {
  kind: "markdown" | "csv" | "json" | "plain";
  /** Markdown heading outline */
  outline?: { level: number; text: string }[];
  /** CSV table dimensions + header */
  table?: { rows: number; columns: number; header: string[]; delimiter: string };
  /** JSON shape description */
  json?: { type: string; keys?: string[]; length?: number; sample?: unknown };
  /** Lines that look like a URL / email / date */
  links?: string[];
  emails?: string[];
}

export interface Keyword {
  term: string;
  /** tf-idf score */
  score: number;
  /** raw term frequency in the whole document */
  count: number;
  /** document frequency across pseudo-documents (chunks) */
  df: number;
}

export interface Chunk {
  id: string;
  index: number;
  text: string;
  startChar: number;
  endChar: number;
  tokenCount: number;
}

export interface RetrievedPassage {
  chunkId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface PipelineInput {
  /** Files supplied by the user */
  files: ExtractedFile[];
  /** Free-text query for the retrieval stage */
  query?: string;
  /** Top-K passages to retrieve */
  topK?: number;
  /** Number of keywords to extract */
  topKeywords?: number;
}

export interface PipelineOutput {
  /** Final human-readable Thai summary */
  summary: string;
  /** Machine-readable result — stable JSON shape */
  data: {
    files: {
      name: string;
      format: FileFormat;
      size: number;
      stats: TextStats;
      structure: StructureInfo;
      keywords: Keyword[];
      chunkCount: number;
      error?: string;
    }[];
    query?: string;
    passages: RetrievedPassage[];
    totals: {
      files: number;
      characters: number;
      words: number;
      chunks: number;
      keywords: number;
    };
  };
  /** JSON string of `data`, ready to download */
  json: string;
}

export interface PipelineResult {
  stages: StageResult[];
  output: PipelineOutput;
  /** Total wall-clock time for the whole pipeline */
  durationMs: number;
}
