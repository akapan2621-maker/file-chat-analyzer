import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { LLMSettingsModal } from "@/components/LLMSettingsModal";
import { SpacesManager } from "@/components/SpacesManager";
import { WorkspaceProvider } from "@/components/WorkspaceContext";

export default function Page() {
  const [showLLMSettings, setShowLLMSettings] = useState(false);

  useEffect(() => {
    // Initialize workspace on load
  }, []);

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col relative z-10">
          <ChatView onOpenLLMSettings={() => setShowLLMSettings(true)} />
          <LLMSettingsModal
            open={showLLMSettings}
            onOpenChange={(open) => setShowLLMSettings(open)}
          />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
