"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";

type FileInfo = {
  id: string;
  originalName: string;
  size: number;
  type: string;
  status: "Ready" | "Active" | "Processing";
  addedOn: string;
  addedBy: string;
  content?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: FileInfo[];
};

const MOCK_FILES: FileInfo[] = [
  { id: "f1", originalName: "optimizer_results.csv", size: 124500, type: "text/csv", status: "Ready", addedOn: "12 days ago", addedBy: "akapan2621@gmail.com" },
  { id: "f2", originalName: "single_run_trades.csv", size: 98700, type: "text/csv", status: "Ready", addedOn: "12 days ago", addedBy: "akapan2621@gmail.com" },
  { id: "f3", originalName: "XAUUSD_M5.csv", size: 2456000, type: "text/csv", status: "Ready", addedOn: "16 days ago", addedBy: "akapan2621@gmail.com" },
  { id: "f4", originalName: "XAUUSD_H4.csv", size: 890000, type: "text/csv", status: "Ready", addedOn: "16 days ago", addedBy: "akapan2621@gmail.com" },
];

export default function Home() {
  const [files, setFiles] = useState<FileInfo[]>(MOCK_FILES);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFiles = files.filter(
    (f) =>
      f.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.addedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileSelect = (file: FileInfo) => {
    setSelectedFiles((prev) =>
      prev.some((f) => f.id === file.id)
        ? prev.filter((f) => f.id !== file.id)
        : [...prev, file]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredFiles);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.length === 0) return;
    if (!window.confirm(`ลบไฟล์ที่เลือก ${selectedFiles.length} ไฟล์หรือไม่?`)) return;
    setFiles((prev) => prev.filter((f) => !selectedFiles.some((sf) => sf.id === f.id)));
    setSelectedFiles([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() && selectedFiles.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      files: selectedFiles.length ? selectedFiles : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          apiKey,
          files: selectedFiles.map((f) => ({
            originalName: f.originalName,
            size: f.size,
            type: f.type,
            content: f.content,
          })),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Server error");
      }

      const data = await resp.json();
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply || "ไม่ได้รับคำตอบ" },
      ]);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
      setSelectedFiles([]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="app-container">
      {/* ============ LEFT PANEL: File Manager ============ */}
      <aside className="left-panel">
        <div className="left-header">
          <div className="space-info">
            <div className="space-name">File Chat Analyzer</div>
            <div className="space-desc">จัดการไฟล์และแชทกับ AI รองรับภาษาไทย</div>
          </div>
          <div className="left-actions">
            <button className="icon-btn delete-btn" title="ลบ" onClick={handleDeleteSelected}>
              🗑️
            </button>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="filter-chip">All</span>
          <button className="add-btn">+ Add</button>
        </div>

        <div className="file-table-container">
          <table className="file-table">
            <thead>
              <tr>
                <th className="col-select">
                  {selectedFiles.length === filteredFiles.length && filteredFiles.length > 0 ? (
                    <input type="checkbox" checked onChange={handleSelectAll} />
                  ) : (
                    <input type="checkbox" onChange={handleSelectAll} />
                  )}
                </th>
                <th className="col-name">Name</th>
                <th className="col-status">Status</th>
                <th className="col-added">Added on</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => {
                const isSelected = selectedFiles.some((f) => f.id === file.id);
                return (
                  <tr key={file.id} className={`file-row ${isSelected ? "selected" : ""}`}>
                    <td className="col-select">
                      <input type="checkbox" checked={isSelected} onChange={() => handleFileSelect(file)} />
                    </td>
                    <td className="col-name">
                      <div className="file-icon">
                        {file.type.startsWith("text/") || file.type.includes("csv") ? "📄" : "📎"}
                      </div>
                      <div className="file-name">{file.originalName}</div>
                    </td>
                    <td className="col-status">
                      <span className={`status-badge ${file.status.toLowerCase()}`}>{file.status}</span>
                    </td>
                    <td className="col-added">{file.addedOn}</td>
                    <td className="col-actions">
                      <button className="icon-btn small" title="ลบ" onClick={() => handleDeleteSelected}>
                        …
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedFiles.length > 0 && (
          <div className="selection-bar">
            {selectedFiles.length} ไฟล์ที่เลือก
            <button className="delete-selected-btn" onClick={handleDeleteSelected}>
              ลบที่เลือก
            </button>
          </div>
        )}
      </aside>

      {/* ============ RIGHT PANEL: Chat ============ */}
      <main className="right-panel">
        <div className="chat-header">
          <div className="greeting">
            Here when you need me, <strong>Akapan.</strong>
          </div>
          <div className="quick-actions">
            <select className="quick-select">
              <option>Quick</option>
              <option>Research</option>
              <option>Document</option>
              <option>Analysis</option>
            </select>
            <button className="icon-btn small">+</button>
            <button className="icon-btn small advanced">Advanced</button>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key" style={{ fontSize: "0.85rem", color: "#888", marginRight: "6px" }}>
              API Key:
            </label>
            <input
              id="api-key"
              type="password"
              placeholder="ใส่ API Key (oc_sk_...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                padding: "6px 10px",
                fontSize: "0.85rem",
                border: "1px solid #333",
                borderRadius: "6px",
                background: "#0f172a",
                color: "#fff",
                maxWidth: "220px",
              }}
            />
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="messages-container" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-avatar">{msg.role === "user" ? "👤" : "🤖"}</div>
              <div className="message-content">
                {msg.files?.length && (
                  <div className="attached-files">
                    แนบไฟล์ {msg.files.length} ชิ้น:
                    {msg.files.map((f) => (
                      <span key={f.id} className="file-tag">
                        {f.originalName}
                        {f.size > 0 ? ` (${(f.size / 1024).toFixed(1)} KB)` : ""}
                      </span>
                    ))}
                  </div>
                )}
                <div className="message-text" style={{ whiteSpace: "pre-wrap" }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-text">AI กำลังวิเคราะห์...</div>
              </div>
            </div>
          )}
          <div ref={scrollRef} className="scroll-spacer" />
        </div>

        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="file"
            multiple
            onChange={(e) => {
              const newFiles = Array.from(e.target.files || []).map((file): FileInfo => ({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                originalName: file.name,
                size: file.size,
                type: file.type,
                status: "Processing",
                addedOn: "Just now",
                addedBy: "akapan2621@gmail.com",
              }));
              setSelectedFiles((prev) => [...prev, ...newFiles]);
              e.target.value = "";
            }}
            className="file-input"
          />
          {selectedFiles.length > 0 && (
            <div className="selected-files-chip">
              {selectedFiles.map((f, i) => (
                <span key={i} className="file-chip">
                  {f.originalName}
                  <span onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }} className="chip-remove">
                    ×
                  </span>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="chat-input"
          />
          <button type="submit" disabled={loading} className="send-btn">
            {loading ? "กำลังวิเคราะห์..." : "ส่ง"}
          </button>
        </form>
      </main>
    </div>
  );
}
