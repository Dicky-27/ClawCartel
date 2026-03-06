"use client";

import { ChatPanel } from "@/app/_components/chats/ChatPanel";
import { MobileJoystick } from "@/app/_components/game/MobileJoystick";
import { useMediaQuery } from "@/app/_hooks/useMediaQuery";
import type { GameScene } from "@/app/_libs/game/GameScene";
import { IdeLayout } from "@/app/_components/IdeLayout";
import { PixelatedLoadingScreen } from "@/app/_components/ui/PixelatedLoadingScreen";
import { getAgentByName } from "@/app/_data/agents";
import type { Agent } from "@/app/_data/agents";
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
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [agentsPanelOpen, setAgentsPanelOpen] = useState(false);
  const [agentForDialog, setAgentForDialog] = useState<Agent | null>(null);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const isMobileViewport = useMediaQuery(MOBILE_VIEWPORT);

  const handlePositionChange = useCallback((x: number, y: number) => {
    setCoords({ x: Math.round(x), y: Math.round(y) });
  }, []);

  const handleAgentInteract = useCallback((agentName: string) => {
    const agent = getAgentByName(agentName);
    if (agent) setAgentForDialog(agent);
  }, []);

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
            <PhaserGame onPositionChange={handlePositionChange} sceneRef={sceneRef} />
            <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 font-mono text-xs text-white/40">
              {coords.x}, {coords.y}
            </div>
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
