"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { LLMSettingsModal } from "@/components/LLMSettingsModal";
import { SpacesManager } from "@/components/SpacesManager";
import { WorkspaceProvider, useWorkspace } from "@/components/WorkspaceContext";

function PageContent() {
  const { addChatSession } = useWorkspace();
  const [showLLMSettings, setShowLLMSettings] = useState(false);

  useEffect(() => {
    // Initialize workspace on load
  }, []);

  const handleNewChat = () => {
    addChatSession({
      title: "แชทใหม่",
      messages: [],
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onNewChat={handleNewChat} />
      <div className="flex-1 flex flex-col relative z-10">
        <ChatView onOpenLLMSettings={() => setShowLLMSettings(true)} />
        <LLMSettingsModal
          open={showLLMSettings}
          onOpenChange={(open) => setShowLLMSettings(open)}
        />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <WorkspaceProvider>
      <PageContent />
    </WorkspaceProvider>
  );
}
