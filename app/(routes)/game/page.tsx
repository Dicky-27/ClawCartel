"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useCallback } from "react";
import type { GameScene } from "@/app/_components/game/scenes/GameScene";

/**
 * PhaserGame MUST be loaded with ssr:false because Phaser accesses
 * window and document — those don't exist during Next.js server rendering.
 */
const PhaserGame = dynamic(
  () => import("@/app/_components/game/PhaserGame").then((m) => m.PhaserGame),
  { ssr: false, loading: () => <GameLoadingScreen /> },
);

export default function GamePage() {
  const sceneRef = useRef<GameScene | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // This fires every time the local player moves in Phaser
  const handlePositionChange = useCallback((x: number, y: number) => {
    setCoords({ x: Math.round(x), y: Math.round(y) });
    // Phase 3: socket.emit("move", { x, y }) goes here
  }, []);

  return (
    // Full-screen container — Phaser fills this, React UI floats on top
    <div className="relative w-screen h-screen bg-[#0d1117] overflow-hidden">

      {/* ── Phaser Canvas ─────────────────────────────────────── */}
      <div className="absolute inset-0">
        <PhaserGame onPositionChange={handlePositionChange} sceneRef={sceneRef} />
      </div>

      {/* ── Top Bar HUD ────────────────────────────────────────── */}
      <header className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-white/70">Clawd Cartel HQ</span>
        </div>

        <div className="text-xs font-mono text-white/40">
          {coords.x}, {coords.y}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-xs font-mono text-white/50 bg-white/10 px-2 py-1 rounded">
            1 online
          </span>
        </div>
      </header>

      {/* ── Controls Legend ────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 text-xs font-mono text-white/40 space-y-0.5 pointer-events-none">
        <p>Move — WASD / Arrow keys</p>
        <p className="text-white/20 text-[10px]">Phase 3: multiplayer via Socket.io</p>
        <p className="text-white/20 text-[10px]">Phase 4: proximity video via WebRTC</p>
      </div>

      {/* ── Online Players Panel (Phase 3 placeholder) ─────────── */}
      <div className="absolute bottom-4 right-4 bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-white/60 w-44 pointer-events-auto">
        <p className="text-white/80 mb-2 font-semibold">Online</p>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-500 flex-shrink-0" />
          <span>You</span>
          <span className="ml-auto text-emerald-400">●</span>
        </div>
        <p className="mt-2 text-white/20 text-[10px]">Other players appear here in Phase 3</p>
      </div>
    </div>
  );
}

function GameLoadingScreen() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1117] gap-3">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-mono text-white/40">Loading world...</p>
    </div>
  );
}
