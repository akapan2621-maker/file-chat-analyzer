"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  FileText,
  Search,
  Settings,
  User,
  Plus,
  Trash2,
  Edit,
  ChevronLeft,
  Share2,
  Sparkles,
  MessageCircle,
  GraduationCap,
  FileImage,
  BarChart3,
  Settings as SettingsIcon,
  Workflow,
} from "lucide-react";
import { useWorkspace, Space, ChatSession } from "@/components/WorkspaceContext";
import { cn } from "@/lib/utils";

export function Sidebar({
  onNewChat,
  onOpenPipeline,
}: {
  onNewChat: () => void;
  onOpenPipeline: () => void;
}) {
  const { spaces, addSpace, deleteSpace, chatSessions, activeChatId, setActiveChatId, deleteChatSession } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");

  const handleAddSpace = () => {
    if (!newSpaceName.trim()) return;
    addSpace({
      name: newSpaceName,
      description: "",
      documentCount: 0,
    });
    setNewSpaceName("");
  };

  const handleDeleteSpace = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSpace(id);
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="lux-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <h1 className="lux-gradient-text text-base font-semibold tracking-tight">
              AI Workspace
            </h1>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-lux"
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          {collapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4 rotate-180" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {/* Primary */}
        <div className="mb-2 px-2">
          <button
            onClick={onNewChat}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              activeChatId === "new"
                ? "lux-gradient lux-ink shadow-sm"
                : "text-foreground hover:bg-accent"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            <span className={cn("text-sm font-medium", collapsed && "hidden")}>
              แชทใหม่
            </span>
          </button>

          <div className="mt-4 px-3 py-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              พื้นที่จัดการ
            </label>
            <div className="space-y-1">
              {spaces.map((space) => (
                <div
                  key={space.id}
                  className="flex items-center justify-between group"
                >
                  <button
                    onClick={() => {
                      // Select space
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors",
                      "hover:bg-secondary text-foreground"
                    )}
                  >
                    <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    <span className={cn("text-sm font-medium", collapsed && "hidden")}>
                      {space.name}
                    </span>
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                      {space.documentCount}
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteSpace(e, space.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  type="text"
                  placeholder="พื้นที่ใหม่..."
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                />
                <button
                  onClick={handleAddSpace}
                  className="px-2.5 py-1.5 text-sm text-primary hover:bg-accent rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary */}
        <div className="mt-4 px-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
            เครื่องมือ
          </label>
          <div className="space-y-1">
            <button
              onClick={onOpenPipeline}
              className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary text-foreground transition-colors focus-lux")}
              title="Pipeline · INPUT → PROCESS → OUTPUT (ไม่ใช้ LLM)"
            >
              <Workflow className="w-5 h-5 text-muted-foreground" />
              <span className={cn("text-sm", collapsed && "hidden")}>Pipeline</span>
            </button>
            <button className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary text-foreground transition-colors")}>
              <GraduationCap className="w-5 h-5 text-muted-foreground" />
              <span className={cn("text-sm", collapsed && "hidden")}>Research</span>
            </button>
            <button className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary text-foreground transition-colors")}>
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <span className={cn("text-sm", collapsed && "hidden")}>Analytics</span>
            </button>
            <button className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-secondary text-foreground transition-colors")}>
              <Settings className="w-5 h-5 text-muted-foreground" />
              <span className={cn("text-sm", collapsed && "hidden")}>การตั้งค่า LLM</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Recents */}
      <div className="px-2 py-2 border-t border-border">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block px-2">
          เร็วๆ นี้
        </label>
        <div className="space-y-1 px-1">
          {chatSessions.slice(0, 5).map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between group cursor-pointer"
              onClick={() => setActiveChatId(session.id)}
            >
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors">
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {session.title.charAt(0).toUpperCase()}
                </div>
                <span className={cn("text-sm truncate", collapsed && "hidden")}>
                  {session.title}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChatSession(session.id);
                }}
                className="p-1 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary transition-colors cursor-pointer">
          <div className="lux-gradient lux-ink flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
            AP
          </div>
          <div className={cn("flex-1 min-w-0", collapsed && "hidden")}>
            <p className="text-sm font-medium text-foreground truncate">
              Akapan Rattanadilok Na Phuket
            </p>
            <p className="text-xs text-muted-foreground truncate">
              akapan2621
            </p>
          </div>
          <SettingsIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </aside>
  );
}
