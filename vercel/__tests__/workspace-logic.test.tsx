/**
 * Behavioural tests for the workspace state logic.
 * Verifies the exact bugs that broke the Vercel build and the chat runtime.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React, { StrictMode } from "react";
import {
  WorkspaceProvider,
  useWorkspace,
  ChatSession,
} from "@/components/WorkspaceContext";

function Probe({ onReady }: { onReady: (api: any) => void }) {
  const api = useWorkspace();
  onReady(api);
  return (
    <div>
      <span data-testid="spaces">{api.spaces.length}</span>
      <span data-testid="docs">{api.documents.length}</span>
      <span data-testid="sessions">{api.chatSessions.length}</span>
      <span data-testid="active">{api.activeChatId ?? "none"}</span>
    </div>
  );
}

function setup() {
  let api: any = null;
  // StrictMode double-invokes state updaters in development — this is what
  // exposed the nested setSpaces-inside-setDocuments bug.
  render(
    <StrictMode>
      <WorkspaceProvider>
        <Probe onReady={(a) => (api = a)} />
      </WorkspaceProvider>
    </StrictMode>
  );
  return () => api;
}

describe("WorkspaceContext — add* return values", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addChatSession returns the created session (not void)", () => {
    const getApi = setup();
    let created: ChatSession = undefined as unknown as ChatSession;
    act(() => {
      created = getApi().addChatSession({ title: "แชทใหม่", messages: [] });
    });
    // Runtime assertion: the value is a real object with the session shape.
    expect(created).toBeDefined();
    expect(typeof created).toBe("object");
    expect(created!.id).toBeTruthy();
    expect(created!.title).toBe("แชทใหม่");
    expect(created!.createdAt).toBeGreaterThan(0);
    // Compile-time assertion: this line only type-checks if the context type
    // declares a ChatSession return value (it used to be `=> void`).
    const typed: ChatSession = getApi().addChatSession({ title: "x", messages: [] });
    expect(typed).toBeDefined();
  });

  it("addSpace returns the created space with an id", () => {
    const getApi = setup();
    let created: any;
    act(() => {
      created = getApi().addSpace({ name: "พื้นที่ 1", description: "", documentCount: 0 });
    });
    expect(created).toBeDefined();
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("พื้นที่ 1");
  });

  it("addDocument returns the created document", () => {
    const getApi = setup();
    let space: any;
    act(() => {
      space = getApi().addSpace({ name: "S", description: "", documentCount: 0 });
    });
    let doc: any;
    act(() => {
      doc = getApi().addDocument({
        spaceId: space.id,
        name: "f.txt",
        type: "text/plain",
        size: 10,
        chunkCount: 1,
      });
    });
    expect(doc).toBeDefined();
    expect(doc.id).toBeTruthy();
    expect(doc.spaceId).toBe(space.id);
  });
});

describe("WorkspaceContext — chat session flow", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("new session becomes active and stores the first message", () => {
    const getApi = setup();
    let created: ChatSession;
    act(() => {
      created = getApi().addChatSession({ title: "ทดสอบ", messages: [] });
    });
    expect(getApi().activeChatId).toBe(created.id);
    expect(getApi().chatSessions).toHaveLength(1);
  });

  it("functional update appends without duplicating the user message", () => {
    const getApi = setup();
    let created: ChatSession;
    act(() => {
      created = getApi().addChatSession({ title: "แชท", messages: [] });
    });

    const userMsg = { id: "u1", role: "user" as const, content: "สวัสดี", createdAt: Date.now() };
    act(() => {
      getApi().updateChatSession(created.id, (prev: ChatSession) => ({
        messages: [...(prev.messages || []), userMsg],
      }));
    });
    expect(getApi().chatSessions[0].messages).toHaveLength(1);

    const botMsg = { id: "a1", role: "assistant" as const, content: "สวัสดีครับ", createdAt: Date.now() };
    act(() => {
      getApi().updateChatSession(created.id, (prev: ChatSession) => ({
        messages: [...(prev.messages || []), botMsg],
      }));
    });

    const msgs = getApi().chatSessions[0].messages;
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m: any) => m.id)).toEqual(["u1", "a1"]);
    // the user message must appear exactly once
    expect(msgs.filter((m: any) => m.id === "u1")).toHaveLength(1);
  });

  it("object-form update still works (backwards compatible)", () => {
    const getApi = setup();
    let created: ChatSession;
    act(() => {
      created = getApi().addChatSession({ title: "แชท", messages: [] });
    });
    act(() => {
      getApi().updateChatSession(created.id, { title: "เปลี่ยนชื่อ" });
    });
    expect(getApi().chatSessions[0].title).toBe("เปลี่ยนชื่อ");
  });
});

describe("WorkspaceContext — document count integrity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("deleteDocument decrements the space count exactly once", () => {
    const getApi = setup();
    let space: any;
    act(() => {
      space = getApi().addSpace({ name: "S", description: "", documentCount: 0 });
    });
    let doc: any;
    act(() => {
      doc = getApi().addDocument({
        spaceId: space.id,
        name: "f.txt",
        type: "text/plain",
        size: 10,
        chunkCount: 1,
      });
    });
    expect(getApi().spaces[0].documentCount).toBe(1);

    act(() => {
      getApi().deleteDocument(doc.id);
    });
    expect(getApi().spaces[0].documentCount).toBe(0);
    expect(getApi().documents).toHaveLength(0);
  });

  it("count never goes negative", () => {
    const getApi = setup();
    let space: any;
    act(() => {
      space = getApi().addSpace({ name: "S", description: "", documentCount: 0 });
    });
    let doc: any;
    act(() => {
      doc = getApi().addDocument({
        spaceId: space.id,
        name: "f.txt",
        type: "text/plain",
        size: 10,
        chunkCount: 1,
      });
    });
    act(() => {
      getApi().deleteDocument(doc.id);
    });
    act(() => {
      getApi().deleteDocument(doc.id);
    });
    expect(getApi().spaces[0].documentCount).toBe(0);
  });
});
