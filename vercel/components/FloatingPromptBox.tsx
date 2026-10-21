"use client";

import React, { useState, useRef, FormEvent } from "react";
import { Paperclip, Send, MoreVertical, SendHorizontal } from "lucide-react";

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-4rem)] max-w-4xl">
      {/* Outer luxury container */}
      <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-lg flex flex-col gap-2">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-1">
          <select
            className="text-xs bg-transparent border-none focus:ring-0 text-muted-foreground font-medium"
            defaultValue="Quick"
          >
            <option>Quick</option>
            <option>Pro</option>
            <option>Fast</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMore(!showMore)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-muted-foreground transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inner card */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 relative overflow-hidden">
          {/* Gradient accent top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600" />

          <form onSubmit={onSend} className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={autoResize}
              placeholder="Ask a question..."
              className="flex-1 resize-none border-none focus:ring-0 bg-transparent text-sm text-foreground min-h-[44px] max-h-[120px] leading-6 placeholder-text-muted-foreground"
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
                className="p-2 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={disabled || !value.trim()}
                className={cn(
                  "px-5 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2",
                  disabled || !value.trim()
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600 text-white shadow-lg hover:shadow-purple-500/50 transform hover:scale-[1.02]"
                )}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    กำลังส่ง...
                  </span>
                ) : (
                  <>
                    <SendHorizontal className="w-4 h-4" />
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
