"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";
import { Paperclip, Send, MoreVertical, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPromptBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (e: FormEvent) => void;
  loading: boolean;
  disabled: boolean;
}

export function FloatingPromptBox({
  value,
  onChange,
  onSend,
  loading,
  disabled,
}: FloatingPromptBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMore, setShowMore] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend(e as unknown as FormEvent);
    }
  };

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 sm:bottom-6 sm:w-[calc(100%-4rem)]">
      {/* Outer luxury container */}
      <div className="lux-border flex flex-col gap-2 rounded-2xl border border-border bg-muted/70 p-1.5 backdrop-blur-xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-1">
          <select
            className="focus:ring-0 cursor-pointer border-none bg-transparent text-xs font-medium text-muted-foreground focus-lux"
            defaultValue="Quick"
          >
            <option>Quick</option>
            <option>Pro</option>
            <option>Fast</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMore(!showMore)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-lux"
              aria-label="ตัวเลือกเพิ่มเติม"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Inner card */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3">
          {/* Signature gold accent line */}
          <div className="lux-gradient absolute inset-x-0 top-0 h-px" />

          <form onSubmit={onSend} className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={autoResize}
              placeholder="ถามอะไรก็ได้..."
              className="min-h-[44px] max-h-[120px] flex-1 resize-none border-none bg-transparent text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
              disabled={disabled}
              rows={1}
            />

            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  // File upload
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept=".pdf,.csv,.txt,.md,.json";
                  input.click();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-lux disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="submit"
                disabled={disabled || !value.trim()}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 font-medium transition-all duration-200 focus-lux",
                  disabled || !value.trim()
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "lux-gradient lux-ink shadow-lg hover:brightness-110"
                )}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    กำลังส่ง...
                  </span>
                ) : (
                  <>
                    <SendHorizontal className="h-4 w-4" />
                    ส่ง
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
