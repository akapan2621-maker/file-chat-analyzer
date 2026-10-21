"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useWorkspace, ChatMessage, ChatSession } from "@/components/WorkspaceContext";
import { ChatMessage as ChatMessageComponent } from "@/components/ChatMessage";
import { FloatingPromptBox } from "@/components/FloatingPromptBox";
import { Sparkles, Bot, User as UserIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function ChatView({ onOpenLLMSettings }: { onOpenLLMSettings: () => void }) {
  const { getActiveChat, activeChatId, setActiveChatId, addChatSession, updateChatSession, spaces, llmConfig } = useWorkspace();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = getActiveChat();
    if (active) {
      setMessages(active.messages);
    } else {
      setMessages([]);
    }
  }, [activeChatId, getActiveChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const createNewChat = useCallback(() => {
    setMessages([]);
    setLoading(false);
    setError(null);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && streamingMessage.length === 0) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    // Ensure active chat exists
    let active = getActiveChat();
    if (!active || active.id === "new") {
      // addChatSession returns the created session — use it directly.
      // Do NOT read chatSessions[0]: that array is stale in this closure and
      // would point at a previous session (or undefined) right after creation.
      active = addChatSession({
        title: input.slice(0, 50) || "แชทใหม่",
        messages: [userMessage],
      });
      setActiveChatId(active.id);
    } else {
      // Functional update: read the LATEST messages from state instead of the
      // stale `active` snapshot, otherwise concurrent sends drop messages.
      updateChatSession(active.id, (prev) => ({
        messages: [...(prev.messages || []), userMessage],
      }));
    }

    try {
      // Call API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          modelId: llmConfig.modelId,
          temperature: llmConfig.temperature,
          systemPrompt: llmConfig.systemPrompt,
          apiKey: llmConfig.apiKey,
          baseUrl: llmConfig.baseUrl,
        }),
      });

      if (!response.ok) {
        // Surface the server's actual error message (e.g. missing API key, LLM error)
        let detail = `Server error (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody?.error) detail = errBody.error;
        } catch {
          // non-JSON error body — keep the generic message
        }
        throw new Error(detail);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingMessage(fullContent);
        }
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingMessage("");
      setLoading(false);

      if (active) {
        // Append only the assistant message. The user message was already
        // added above; re-adding it here would duplicate it in the history.
        updateChatSession(active.id, (prev) => ({
          messages: [...(prev.messages || []), assistantMessage],
        }));
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
      setLoading(false);
      setStreamingMessage("");
    }
  };

  const active = getActiveChat();

  return (
    <div className="flex-1 flex flex-col bg-background relative z-10">
      {/* Header */}
      <header className="z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="lux-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {active?.title || "แชทใหม่"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {spaces.find((s) => s.id === active?.spaceId)?.name || "ไม่ได้เลือกพื้นที่"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onOpenLLMSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-lux"
            title="ตั้งค่า LLM"
          >
            <UserIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="relative flex-1 overflow-y-auto px-6 pb-40 pt-6" ref={messagesEndRef}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="lux-gradient mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="lux-gradient-text mb-2 text-2xl font-light tracking-tight">
              Ready when you are, Akapan.
            </h2>
            <p className="text-sm text-muted-foreground">
              เริ่มต้นโดยส่งข้อความหรืออัปโหลดไฟล์
            </p>
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center">
            <div className="lux-border max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}

        {streamingMessage && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-foreground whitespace-pre-wrap">{streamingMessage}</div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Prompt */}
      <FloatingPromptBox
        value={input}
        onChange={setInput}
        onSend={handleSend}
        loading={loading}
        disabled={loading}
      />
    </div>
  );
}
