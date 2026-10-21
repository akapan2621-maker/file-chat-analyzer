"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useWorkspace, ChatMessage, ChatSession } from "@/components/WorkspaceContext";
import { ChatMessage as ChatMessageComponent } from "@/components/ChatMessage";
import { FloatingPromptBox } from "@/components/FloatingPromptBox";
import { Sparkles, Bot, User as UserIcon } from "lucide-react";

export function ChatView({ onOpenLLMSettings }: { onOpenLLMSettings: () => void }) {
  const { getActiveChat, activeChatId, setActiveChatId, chatSessions, addChatSession, updateChatSession, spaces } = useWorkspace();
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
      const newSession = addChatSession({
        title: input.slice(0, 50) || "แชทใหม่",
        messages: [userMessage],
      });
      active = newSession;
      setActiveChatId(active.id);
    } else {
      updateChatSession(active.id, {
        messages: [...(active.messages || []), userMessage],
      });
    }

    try {
      // Call API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          modelId: "kilo-auto/free",
          temperature: 0.7,
          systemPrompt: "",
          apiKey: "",
          baseUrl: "https://api.kilocode.ai/v1",
        }),
      });

      if (!response.ok) {
        throw new Error("Server error");
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
        updateChatSession(active.id, {
          messages: [...(active.messages || []), userMessage, assistantMessage],
        });
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
      <header className="h-16 border-b border-border bg-card/95 backdrop-blur flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {active?.title || "แชทใหม่"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {spaces.find((s) => s.id === active?.spaceId)?.name || "ไม่ได้เลือกพื้นที่"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenLLMSettings}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground transition-colors"
          >
            <UserIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-6 relative" ref={messagesEndRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600 flex items-center justify-center text-2xl mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-light text-foreground mb-2 tracking-tight">
              Ready when you are, Akapan.
            </h2>
            <p className="text-muted-foreground">
              เริ่มต้นโดยส่งข้อความหรืออัปโหลดไฟล์
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg max-w-md">
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
