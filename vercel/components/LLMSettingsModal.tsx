"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Link,
  Bot,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import { useWorkspace, LLMConfig, ProviderType } from "@/components/WorkspaceContext";
import { cn } from "@/lib/utils";

const PROVIDERS: { id: ProviderType; name: string; description: string; defaultBaseUrl: string }[] = [
  { id: "kilo", name: "Kilo Code AI Gateway", description: "OpenAI-Compatible Gateway (Default)", defaultBaseUrl: "https://api.kilo.ai/api/gateway" },
  { id: "custom", name: "Custom OpenAI-Compatible Endpoint", description: "ตั้งค่า endpoint เอง", defaultBaseUrl: "" },
  { id: "gemini", name: "Google Gemini Direct", description: "เชื่อมต่อ Gemini โดยตรง", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "groq", name: "Groq", description: "ความเร็วสูง ต้นทุนต่ำ", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { id: "openrouter", name: "OpenRouter", description: "รวมโมเดลหลายค่าย", defaultBaseUrl: "https://openrouter.ai/api/v1" },
];

export function LLMSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { llmConfig, setLLMConfig } = useWorkspace();
  const [provider, setProvider] = useState<ProviderType>(llmConfig.provider);
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl || "");
  const [apiKey, setApiKey] = useState(llmConfig.apiKey || "");
  const [modelId, setModelId] = useState(llmConfig.modelId || "kilo-auto/free");
  const [customModel, setCustomModel] = useState("");
  const [temperature, setTemperature] = useState(llmConfig.temperature);
  const [topK, setTopK] = useState(llmConfig.topK);
  const [systemPrompt, setSystemPrompt] = useState(llmConfig.systemPrompt);
  const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const presetModels = [
    "kilo-auto/free",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
    "openai/gpt-4o",
    "deepseek/deepseek-r1",
  ];

  const selectedProvider = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => {
    setBaseUrl(llmConfig.baseUrl || selectedProvider.defaultBaseUrl);
    setApiKey(llmConfig.apiKey);
    setModelId(llmConfig.modelId);
    setTemperature(llmConfig.temperature);
    setTopK(llmConfig.topK);
    setSystemPrompt(llmConfig.systemPrompt);
    setProvider(llmConfig.provider);
  }, [llmConfig]);

  const handleTestConnection = async () => {
    setStatus("testing");
    try {
      const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (resp.ok) setStatus("success");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleSave = () => {
    setLLMConfig({
      provider,
      baseUrl,
      apiKey,
      modelId: customModel || modelId,
      temperature,
      topK,
      systemPrompt,
    });
    onOpenChange(false);
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none transition-opacity duration-300"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            การตั้งค่า LLM & Kilo Code API
          </h2>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-accent rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Provider */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">ผู้ให้บริการ LLM</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const active = provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setBaseUrl(p.defaultBaseUrl);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-2 p-3 rounded-xl border transition-all",
                      active
                        ? "border-primary-500 bg-primary-50 text-primary-600"
                        : "border-border text-muted-foreground hover:border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={selectedProvider.defaultBaseUrl}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ตัวอย่าง: https://api.kilo.ai/api/gateway
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">API Key (Kilo Code)</label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="oc_sk_..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm pr-10 focus:ring-2 focus:ring-primary outline-none"
              />
              <button
                onClick={handleTestConnection}
                disabled={status === "testing"}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors",
                  status === "testing" && "animate-spin"
                )}
              >
                {status === "testing" ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin text-primary" />
                ) : status === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Link className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Model ID */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Model ID</label>
            <div className="flex gap-2">
              <select
                value={presetModels.includes(modelId) ? modelId : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") setModelId(customModel);
                  else setModelId(e.target.value);
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                {presetModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="custom">กำหนดเอง...</option>
              </select>
              {modelId === "custom" || (presetModels.includes(modelId) === false && modelId !== "custom") ? (
                <input
                  type="text"
                  value={customModel || modelId}
                  onChange={(e) => {
                    setCustomModel(e.target.value);
                    setModelId(e.target.value);
                  }}
                  placeholder="claude-3-7-sonnet..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              ) : null}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Temperature</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary h-2 bg-secondary rounded-lg"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>สร้างสรรค์น้อย</span>
              <span>{temperature}</span>
              <span>สร้างสรรค์มาก</span>
            </div>
          </div>

          {/* Top-K */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Top-K Chunks (สำหรับ RAG)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
              placeholder="คุณคือผู้ช่วย AI ที่เชี่ยวชาญ..."
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={handleSave}
            disabled={!apiKey}
            className="bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
          >
            <Save className="w-4 h-4 mr-2" />
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
}
