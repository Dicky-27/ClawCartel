"use client";

import { ChatPanel, DUMMY_CHAT_MESSAGES } from "@/app/_components/chats/ChatPanel";
import type { GameScene } from "@/app/_components/game/scenes/GameScene";
import { IdeLayout } from "@/app/_components/IdeLayout";
import { PixelatedLoadingScreen } from "@/app/_components/ui/PixelatedLoadingScreen";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import Builder from "../_components/builders/Builder";
const PhaserGame = dynamic(
  () => import("@/app/_components/game/PhaserGame").then((m) => m.PhaserGame),
  { ssr: false, loading: () => <PixelatedLoadingScreen message="Loading world..." /> },
);

export default function IdeLayoutPage() {
  const sceneRef = useRef<GameScene | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // This fires every time the local player moves in Phaser
  const handlePositionChange = useCallback((x: number, y: number) => {
    setCoords({ x: Math.round(x), y: Math.round(y) });
  }, []);
  return (
    <div className="bg-background flex h-full min-h-0 w-full flex-col">
      <div className="h-full min-h-0 flex-1">
        <IdeLayout
          defaultLeftSize={380}
          defaultRightWidth={300}
          left={
            <ChatPanel
              initialMessages={DUMMY_CHAT_MESSAGES}
              emptyPlaceholder={
                <>
                  <p>Start a conversation</p>
                  <p className="mt-1 text-xs">Ask anything or describe what you’re building.</p>
                </>
              }
            />
          }
          right={<Builder />}
          
          centerClassName="p-6"
        >
          <div className="absolute inset-0">
            <PhaserGame onPositionChange={handlePositionChange} sceneRef={sceneRef} />
            <div className="absolute top-12 left-1/2 -translate-x-1/2 font-mono text-xs text-white/40">
              {coords.x}, {coords.y}
            </div>
          </div>
        </IdeLayout>
      </div>
    </div>
  );
}

