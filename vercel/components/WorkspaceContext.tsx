"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

// Types
export type ProviderType = "kilo" | "gemini" | "groq" | "openrouter" | "custom";

export interface LLMConfig {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  temperature: number;
  topK: number;
  systemPrompt: string;
}

export interface Space {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  createdAt: number;
}

export interface Document {
  id: string;
  spaceId: string;
  name: string;
  type: string;
  size: number;
  chunkCount: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  sources?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  spaceId?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "kilo",
  baseUrl: "https://api.kilo.ai/api/gateway",
  apiKey: "",
  modelId: "kilo-auto/free",
  temperature: 0.7,
  topK: 5,
  systemPrompt:
    "คุณคือผู้ช่วย AI ที่เชี่ยวชาญด้านการวิเคราะห์ข้อมูล ตอบเป็นภาษาไทย กระชับ ได้ใจความ ใช้ emoji ประกอบได้",
};

const STORAGE_KEY = "ai-workspace-config";
const STORAGE_SPACES = "ai-workspace-spaces";
const STORAGE_DOCUMENTS = "ai-workspace-documents";
const STORAGE_CHATS = "ai-workspace-chats";

interface WorkspaceContextType {
  llmConfig: LLMConfig;
  setLLMConfig: (config: Partial<LLMConfig>) => void;
  spaces: Space[];
  addSpace: (space: Omit<Space, "id" | "createdAt">) => Space;
  updateSpace: (id: string, updates: Partial<Space>) => void;
  deleteSpace: (id: string) => void;
  documents: Document[];
  addDocument: (doc: Omit<Document, "id" | "createdAt">) => Document;
  deleteDocument: (id: string) => void;
  chatSessions: ChatSession[];
  addChatSession: (session: Omit<ChatSession, "id" | "createdAt" | "updatedAt">) => ChatSession;
  updateChatSession: (
    id: string,
    updates: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)
  ) => void;
  deleteChatSession: (id: string) => void;
  getActiveChat: () => ChatSession | undefined;
  setActiveChatId: (id: string | null) => void;
  activeChatId: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  // LLM Config
  const [llmConfig, setLLMConfigState] = useState<LLMConfig>(DEFAULT_LLM_CONFIG);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setLLMConfigState({ ...DEFAULT_LLM_CONFIG, ...JSON.parse(saved) });
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig));
  }, [llmConfig]);

  const setLLMConfig = useCallback(
    (updates: Partial<LLMConfig>) => {
      setLLMConfigState((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  // Spaces
  const [spaces, setSpaces] = useState<Space[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_SPACES);
    if (saved) {
      try {
        setSpaces(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_SPACES, JSON.stringify(spaces));
  }, [spaces]);

  const addSpace = useCallback((space: Omit<Space, "id" | "createdAt">) => {
    const newSpace: Space = { ...space, id: crypto.randomUUID(), createdAt: Date.now() };
    setSpaces((prev) => [...prev, newSpace]);
    return newSpace;
  }, []);

  const updateSpace = useCallback((id: string, updates: Partial<Space>) => {
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const deleteSpace = useCallback((id: string) => {
    setSpaces((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_DOCUMENTS);
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_DOCUMENTS, JSON.stringify(documents));
  }, [documents]);

  const addDocument = useCallback((doc: Omit<Document, "id" | "createdAt">) => {
    const newDoc: Document = { ...doc, id: crypto.randomUUID(), createdAt: Date.now() };
    setDocuments((prev) => [...prev, newDoc]);
    // Update space doc count
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === doc.spaceId ? { ...s, documentCount: s.documentCount + 1 } : s
      )
    );
    return newDoc;
  }, []);

  const deleteDocument = useCallback((id: string) => {
    // Resolve the document OUTSIDE the state updater. Calling setSpaces from
    // inside a setDocuments updater double-fires under StrictMode and
    // decrements the space document count twice.
    const doc = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (doc) {
      setSpaces((prev) =>
        prev.map((s) =>
          s.id === doc.spaceId
            ? { ...s, documentCount: Math.max(0, s.documentCount - 1) }
            : s
        )
      );
    }
  }, [documents]);

  // Chat Sessions
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_CHATS);
    if (saved) {
      try {
        setChatSessions(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_CHATS, JSON.stringify(chatSessions));
  }, [chatSessions]);

  const addChatSession = useCallback(
    (session: Omit<ChatSession, "id" | "createdAt" | "updatedAt">) => {
      const now = Date.now();
      const newSession: ChatSession = {
        ...session,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      setChatSessions((prev) => [newSession, ...prev]);
      setActiveChatId(newSession.id);
      return newSession;
    },
    []
  );

  const updateChatSession = useCallback(
    (
      id: string,
      updates: Partial<ChatSession> | ((prev: ChatSession) => Partial<ChatSession>)
    ) => {
      setChatSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const patch = typeof updates === "function" ? updates(s) : updates;
          return { ...s, ...patch, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  const deleteChatSession = useCallback((id: string) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  }, [activeChatId]);

  const getActiveChat = useCallback(() => {
    if (!activeChatId) return undefined;
    return chatSessions.find((s) => s.id === activeChatId);
  }, [activeChatId, chatSessions]);

  const value = useMemo(
    () => ({
      llmConfig,
      setLLMConfig,
      spaces,
      addSpace,
      updateSpace,
      deleteSpace,
      documents,
      addDocument,
      deleteDocument,
      chatSessions,
      addChatSession,
      updateChatSession,
      deleteChatSession,
      getActiveChat,
      setActiveChatId,
      activeChatId,
    }),
    [
      llmConfig,
      setLLMConfig,
      spaces,
      addSpace,
      updateSpace,
      deleteSpace,
      documents,
      addDocument,
      deleteDocument,
      chatSessions,
      addChatSession,
      updateChatSession,
      deleteChatSession,
      getActiveChat,
      setActiveChatId,
      activeChatId,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
};
