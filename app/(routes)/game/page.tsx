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
    <div className="relative h-full w-full overflow-hidden bg-[#0d1117]">
      {/* ── Phaser Canvas ─────────────────────────────────────── */}
      <div className="absolute inset-0">
        <PhaserGame onPositionChange={handlePositionChange} sceneRef={sceneRef} />
      </div>

      {/* ── Top Bar HUD ────────────────────────────────────────── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="font-mono text-xs text-white/70">Clawd Cartel HQ</span>
        </div>

        <div className="font-mono text-xs text-white/40">
          {coords.x}, {coords.y}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-1 font-mono text-xs text-white/50">
            1 online
          </span>
        </div>
      </header>

      {/* ── Controls Legend ────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-4 left-4 space-y-0.5 font-mono text-xs text-white/40">
        <p>Move — WASD / Arrow keys</p>
        <p className="text-[10px] text-white/20">Phase 3: multiplayer via Socket.io</p>
        <p className="text-[10px] text-white/20">Phase 4: proximity video via WebRTC</p>
      </div>

      {/* ── Online Players Panel (Phase 3 placeholder) ─────────── */}
      <div className="pointer-events-auto absolute right-4 bottom-4 w-44 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/60">
        <p className="mb-2 font-semibold text-white/80">Online</p>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 flex-shrink-0 rounded-full bg-indigo-500" />
          <span>You</span>
          <span className="ml-auto text-emerald-400">●</span>
        </div>
        <p className="mt-2 text-[10px] text-white/20">Other players appear here in Phase 3</p>
      </div>
    </div>
  );
}

function GameLoadingScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      <p className="font-mono text-sm text-white/40">Loading world...</p>
    </div>
  );
}
