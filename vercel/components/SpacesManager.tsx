"use client";

import React, { useState, useCallback } from "react";
import { useWorkspace, Space, Document } from "@/components/WorkspaceContext";
import {
  FileText,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Download,
  Clock,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileChunk {
  id: string;
  text: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
}

export function SpacesManager({ onClose }: { onClose: () => void }) {
  const { spaces, addSpace, deleteSpace, documents, addDocument, deleteDocument, setActiveChatId, addChatSession } = useWorkspace();
  const [newSpaceName, setNewSpaceName] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [fileId: string]: { status: "extracting" | "chunking" | "indexing" | "done"; progress: number } }>({});

  const spaceDocs = selectedSpaceId ? documents.filter((d) => d.spaceId === selectedSpaceId) : [];

  const handleCreateSpace = () => {
    if (!newSpaceName.trim()) return;
    const space = addSpace({
      name: newSpaceName,
      description: "",
      documentCount: 0,
    });
    setNewSpaceName("");
    setSelectedSpaceId(space.id);
  };

  const parseTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const chunkText = (text: string, chunkSize = 800, overlap = 150): FileChunk[] => {
    const chunks: FileChunk[] = [];
    let start = 0;
    let index = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push({
        id: crypto.randomUUID(),
        text: text.slice(start, end),
        chunkIndex: index,
        startChar: start,
        endChar: end,
      });
      index++;
      start = end - overlap;
      if (start < 0) start = 0;
      if (start >= text.length) break;
    }
    return chunks;
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSpaceId) {
      alert("กรุณาเลือกพื้นที่ก่อนอัปโหลดไฟล์");
      return;
    }

    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const fileId = crypto.randomUUID();
      setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "extracting", progress: 0 } }));

      try {
        // Extract text
        setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "extracting", progress: 30 } }));
        const text = await parseTextFile(file);

        // Chunk
        setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "chunking", progress: 60 } }));
        const chunks = chunkText(text);

        // Index (save to localStorage)
        setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "indexing", progress: 90 } }));

        const doc: Omit<Document, "id" | "createdAt"> = {
          spaceId: selectedSpaceId,
          name: file.name,
          type: file.type,
          size: file.size,
          chunkCount: chunks.length,
        };

        addDocument(doc);

        // Simulate indexing delay
        await new Promise((r) => setTimeout(r, 500));

        setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "done", progress: 100 } }));
      } catch (err) {
        console.error(err);
        setUploadProgress((prev) => ({ ...prev, [fileId]: { status: "done", progress: 0 } }));
      }
    }
  };

  const handleDeleteDoc = (id: string) => {
    deleteDocument(id);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[600px] bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-300 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Spaces - ฐานความรู้
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Spaces List */}
          <div className="w-1/3 border-r border-border bg-secondary/50 p-4 overflow-y-auto">
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                พื้นที่จัดการ
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ชื่อพื้นที่ใหม่..."
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
                <button
                  onClick={handleCreateSpace}
                  className="px-3 py-2 bg-primary text-white rounded-lg font-medium text-sm hover:opacity-90 transition-colors"
                >
                  สร้าง
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {spaces.map((space) => (
                <div
                  key={space.id}
                  onClick={() => setSelectedSpaceId(space.id)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                    selectedSpaceId === space.id
                      ? "bg-primary text-white"
                      : "hover:bg-secondary text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">{space.name}</span>
                  </div>
                  <span className="text-xs opacity-70">{space.documentCount} ไฟล์</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSpace(space.id);
                      if (selectedSpaceId === space.id) setSelectedSpaceId(null);
                    }}
                    className="p-1 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {spaces.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  ยังไม่มีพื้นที่จัดการ สร้างพื้นที่แรกได้เลย
                </div>
              )}
            </div>
          </div>

          {/* Right: Documents */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!selectedSpaceId ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-2xl mb-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">เลือกพื้นที่จัดการ</h3>
                <p className="text-muted-foreground text-sm">เลือกพื้นที่จากด้านซ้ายเพื่ออัปโหลดไฟล์</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    ไฟล์ใน "{spaces.find((s) => s.id === selectedSpaceId)?.name}"
                  </h3>
                  <label className="flex items-center gap-2 p-2 border-2 border-dashed border-border rounded-lg hover:bg-secondary cursor-pointer">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">เลือกไฟล์</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.csv,.txt,.md,.json"
                      onChange={handleFiles}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {spaceDocs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      ยังไม่มีไฟล์ในพื้นที่นี้
                    </div>
                  ) : (
                    spaceDocs.map((doc) => {
                      const progress = uploadProgress[doc.id];
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-sm">
                              {doc.type.includes("pdf") ? "📄" : doc.type.includes("csv") ? "📊" : "📝"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground truncate max-w-xs">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.chunkCount} ชิ้น • {(doc.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {progress && progress.status !== "done" ? (
                              <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${progress.progress}%` }}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="p-1.5 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
