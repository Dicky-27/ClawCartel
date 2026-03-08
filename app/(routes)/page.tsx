"use client";

import { ChatPanel } from "@/app/_components/chats/ChatPanel";
import { MobileJoystick } from "@/app/_components/game/MobileJoystick";
import { useMediaQuery } from "@/app/_hooks/useMediaQuery";
import type { GameScene } from "@/app/_libs/game/GameScene";
import { IdeLayout } from "@/app/_components/IdeLayout";
import { PixelatedLoadingScreen } from "@/app/_components/ui/PixelatedLoadingScreen";
import type { Agent } from "@/app/_data/agents";
import { useAgents } from "@/app/_providers/AgentsProvider";
import { BUILD_STEPPER_PHASES } from "@/app/_constant/chat";
import { useChat } from "@/app/_providers/ChatProvider";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Builder from "../_components/builders/Builder";

/** Show joystick only on mobile viewport (same breakpoint as IdeLayout mobile nav). */
const MOBILE_VIEWPORT = "(max-width: 767px)";
const PhaserGame = dynamic(
  () => import("@/app/_components/game/PhaserGame").then((m) => m.PhaserGame),
  { ssr: false, loading: () => <PixelatedLoadingScreen message="Loading world..." /> },
);

export default function IdeLayoutPage() {
  const sceneRef = useRef<GameScene | null>(null);
  const [agentsPanelOpen, setAgentsPanelOpen] = useState(false);
  const [agentForDialog, setAgentForDialog] = useState<Agent | null>(null);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT);
  const { agents } = useAgents();
  const { step, runId, agentBubbles, phaseKey, hasCodegenPending } = useChat();
  const discussionMode = step === "chat" && !!runId;

  const isBuilding =
    hasCodegenPending ||
    (phaseKey &&
      BUILD_STEPPER_PHASES.indexOf(phaseKey) >= BUILD_STEPPER_PHASES.indexOf("code_generation")) ||
    step === "complete";
  const [builderPanelOpen, setBuilderPanelOpen] = useState(false);
  const [builderClosedWhileBuilding, setBuilderClosedWhileBuilding] = useState(false);
  const builderPanelOpenEffective = isBuilding
    ? !builderClosedWhileBuilding
    : builderPanelOpen;
  const handleBuilderOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setBuilderClosedWhileBuilding(false);
        setBuilderPanelOpen(true);
      } else {
        if (isBuilding) setBuilderClosedWhileBuilding(true);
        else setBuilderPanelOpen(false);
      }
    },
    [isBuilding],
  );
  const wasBuildingRef = useRef(false);
  useEffect(() => {
    if (isBuilding && !wasBuildingRef.current) {
      // Auto-open builder when entering build phase (sync UI with phase)
      // eslint-disable-next-line -- intentional setState on phase transition to auto-open builder panel
      setBuilderClosedWhileBuilding(false);
    }
    wasBuildingRef.current = isBuilding;
  }, [isBuilding]);

  const handleAgentInteract = useCallback(
    (agentName: string) => {
      const agent = agents.find((a) => a.name === agentName);
      if (agent) setAgentForDialog(agent);
    },
    [agents],
  );

  const handleJoystickMove = useCallback((nx: number, ny: number) => {
    sceneRef.current?.setJoystickInput(nx, -ny);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.onAgentInteract = handleAgentInteract;
    return () => {
      scene.onAgentInteract = undefined;
    };
  }, [handleAgentInteract]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="h-full min-h-0 flex-1">
        <IdeLayout
          defaultLeftSize={380}
          defaultRightWidth={300}
          defaultRightOpen={false}
          rightOpen={builderPanelOpenEffective}
          onRightOpenChange={handleBuilderOpenChange}
          onMobileSheetOpenChange={setMobileSheetOpen}
          left={
            <ChatPanel
              agentsPanelOpen={agentsPanelOpen}
              onAgentsPanelOpenChange={setAgentsPanelOpen}
              agentForDialog={agentForDialog}
              onAgentDialogChange={setAgentForDialog}
            />
          }
          right={<Builder />}
          centerClassName="p-6"
        >
          <div className="absolute inset-0">
            <PhaserGame
              sceneRef={sceneRef}
              agentBubbles={agentBubbles}
              agents={agents.map((a) => ({ name: a.name, textureKey: a.textureKey }))}
              discussionMode={discussionMode}
            />
            <MobileJoystick
              enabled={isMobileViewport && !isMobileSheetOpen}
              onMove={handleJoystickMove}
            />
          </div>
        </IdeLayout>
      </div>
    </div>
  );
}
