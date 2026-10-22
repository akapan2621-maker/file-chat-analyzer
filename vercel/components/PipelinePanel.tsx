"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Upload,
  Play,
  Download,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  X,
  Search,
  ChevronRight,
} from "lucide-react";
import { extractFiles, ACCEPTED_EXTENSIONS } from "@/lib/pipeline/extract";
import { runPipeline } from "@/lib/pipeline/run";
import type { ExtractedFile, PipelineResult, StageStatus } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<StageStatus, React.ReactNode> = {
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  skipped: <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function PipelinePanel() {
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setExtracting(true);
    setError(null);
    try {
      const extracted = await extractFiles(picked);
      setFiles((prev) => [...prev, ...extracted]);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, []);

  const run = useCallback(async () => {
    if (!files.length) {
      setError("กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await runPipeline({ files, query: query.trim() || undefined });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [files, query]);

  const downloadJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.output.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const downloadSummary = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.output.summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Pipeline · INPUT → PROCESS → OUTPUT
            </h2>
            <p className="text-xs text-muted-foreground">
              ประมวลผลเอกสารแบบ deterministic ทั้งหมด — ไม่ใช้ LLM เลย
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-lux"
          >
            <Upload className="h-4 w-4" />
            เลือกไฟล์
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFiles}
            className="hidden"
          />
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
          {/* Left: input + stages */}
          <div className="overflow-y-auto border-b border-border p-6 md:border-b-0 md:border-r">
            {/* INPUT */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                INPUT
              </h3>

              <label className="mb-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30">
                <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {extracting ? "กำลังอ่านไฟล์..." : "วางไฟล์หรือคลิกเพื่อเลือก"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  .txt .md .csv .json .pdf (สูงสุด 10 MB)
                </span>
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFiles}
                  className="hidden"
                />
              </label>

              {files.length > 0 && (
                <ul className="mb-4 space-y-1.5">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate text-foreground">{f.name}</span>
                        <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {f.format}
                        </span>
                        {f.error && (
                          <span className="flex-shrink-0 text-[10px] text-destructive">⚠ {f.error}</span>
                        )}
                      </span>
                      <button
                        onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))}
                        className="ml-2 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="คำค้น (ไม่บังคับ — ใช้ค้นคืนข้อมูล)"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                onClick={run}
                disabled={busy || extracting || !files.length}
                className="lux-gradient lux-ink mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {busy ? "กำลังประมวลผล..." : "ประมวลผล"}
              </button>

              {error && (
                <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </section>

            {/* PROCESS stages */}
            {result && (
              <section className="mt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  PROCESS
                </h3>
                <ol className="space-y-1.5">
                  {result.stages.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        {STATUS_ICON[s.status]}
                        <span className="text-xs font-medium text-foreground">{s.title}</span>
                        <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {s.durationMs} ms
                        </span>
                      </div>
                      <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{s.summary}</p>
                      {s.detail && (
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 pl-5 pr-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
                          {s.detail}
                        </pre>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  รวม {result.durationMs} ms · ไม่มีการเรียก LLM
                </p>
              </section>
            )}
          </div>

          {/* Right: output */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                OUTPUT
              </h3>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={downloadSummary}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Download className="h-3 w-3" />
                    .txt
                  </button>
                  <button
                    onClick={downloadJson}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Download className="h-3 w-3" />
                    .json
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!result ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ChevronRight className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    เลือกไฟล์แล้วกด "ประมวลผล" เพื่อดูผลลัพธ์
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    ทุกขั้นตอนคำนวณด้วยตัวเอง ไม่ต้องพึ่ง LLM
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Summary */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-foreground">
                      สรุป (ภาษาไทย)
                    </h4>
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-foreground [font-family:inherit]">
                      {result.output.summary}
                    </pre>
                  </div>

                  {/* Totals */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[
                      ["ไฟล์", result.output.data.totals.files],
                      ["ตัวอักษร", result.output.data.totals.characters],
                      ["คำ", result.output.data.totals.words],
                      ["ชิ้นข้อมูล", result.output.data.totals.chunks],
                      ["คำสำคัญ", result.output.data.totals.keywords],
                    ].map(([label, val]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-center"
                      >
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          {Number(val).toLocaleString("th-TH")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Per-file detail */}
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-foreground">รายละเอียดรายไฟล์</h4>
                    <div className="space-y-2">
                      {result.output.data.files.map((f) => (
                        <div
                          key={f.name}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate text-xs font-medium text-foreground">
                              {f.name}
                            </span>
                            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {f.format}
                            </span>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:grid-cols-4">
                            {[
                              ["คำ", f.stats.words],
                              ["คำไม่ซ้ำ", f.stats.uniqueTerms],
                              ["ประโยค", f.stats.sentences],
                              ["อ่าน", `${f.stats.readingTimeMinutes} นาที`],
                            ].map(([k, v]) => (
                              <div key={String(k)}>
                                <dt className="text-muted-foreground">{k}</dt>
                                <dd className="tabular-nums text-foreground">{v}</dd>
                              </div>
                            ))}
                          </dl>
                          {f.keywords.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {f.keywords.slice(0, 10).map((k) => (
                                <span
                                  key={k.term}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {k.term}
                                  <span className="ml-1 tabular-nums text-primary/70">
                                    {k.count}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Passages */}
                  {result.output.data.passages.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-foreground">
                        ผลการค้นคืน ({result.output.data.passages.length})
                      </h4>
                      <div className="space-y-2">
                        {result.output.data.passages.map((p, i) => (
                          <div
                            key={p.chunkId}
                            className="rounded-lg border border-border bg-background p-3"
                          >
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                                {i + 1}
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                คะแนน {p.score.toFixed(3)}
                              </span>
                              <span className="truncate text-muted-foreground">
                                · {p.matchedTerms.join(", ")}
                              </span>
                            </div>
                            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                              {p.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw JSON */}
                  <details className="rounded-lg border border-border bg-background">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-foreground">
                      ข้อมูล JSON ดิบ
                    </summary>
                    <pre className="max-h-64 overflow-auto border-t border-border p-3 text-[10px] leading-relaxed text-muted-foreground">
                      {result.output.json}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
