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
    <div className={cn("flex items-start gap-3 mb-6", isUser ? "flex-row-reverse" : "")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
        isUser ? "bg-primary text-white" : "bg-secondary"
      )}>
        {isUser ? (
          <UserIcon className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className={cn(
        "max-w-[85%] rounded-xl p-4 whitespace-pre-wrap break-words",
        isUser
          ? "bg-primary text-white text-right rounded-tr-none rounded-tl-none"
          : "bg-card border border-border text-foreground rounded-bl-none rounded-tl-none"
      )}>
        <div className="prose prose-sm">
          {message.content}
        </div>
      </div>
    </div>
  );
}
