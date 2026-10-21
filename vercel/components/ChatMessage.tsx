"use client";

import React from "react";
import { ChatMessage } from "@/components/WorkspaceContext";
import { Bot, User as UserIcon, Copy, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("mb-6 flex items-start gap-3", isUser ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUser
            ? "lux-gradient lux-ink"
            : "border border-border bg-muted text-muted-foreground"
        )}
      >
        {isUser ? (
          <UserIcon className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "lux-gradient lux-ink"
            : "lux-border border border-border bg-card text-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
