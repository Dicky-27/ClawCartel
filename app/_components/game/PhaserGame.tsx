"use client";

import { useEffect, useRef } from "react";
import type * as Phaser from "phaser";
import type { GameScene } from "../../_libs/game/GameScene";

type AgentConfig = { name: string; textureKey: string };

type Props = {
  /** Called every time the local player moves — wire to socket in Phase 3 */
  onPositionChange?: (x: number, y: number) => void;
  /** Ref forwarded so parent components can call scene methods (e.g. upsertRemotePlayer) */
  sceneRef?: React.RefObject<GameScene | null>;
  /** Last message per agent name for map bubble chat */
  agentBubbles?: Record<string, string>;
  /** Agents from API; map waits for this before showing NPCs */
  agents?: AgentConfig[];
  /** When true, agents gather at meeting spot (discussion); when false, they wander */
  discussionMode?: boolean;
};

export function PhaserGame({
  onPositionChange,
  sceneRef,
  agentBubbles,
  agents = [],
  discussionMode = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const agentBubblesRef = useRef<Record<string, string>>(agentBubbles ?? {});
  const agentsRef = useRef<AgentConfig[]>(agents);

  useEffect(() => {
    agentBubblesRef.current = agentBubbles ?? {};
  }, [agentBubbles]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    // Track whether the cleanup already ran so we can cancel a pending async init.
    // This fixes React 18 StrictMode double-mount: StrictMode unmounts and remounts
    // every component once in development. Because initPhaser is async, the cleanup
    // fires BEFORE the first init resolves — without this flag, the async continues,
    // creates a Phaser game, and a second mount creates another one on top.
    let cancelled = false;

    // Keep a local reference so cleanup can destroy the game even if the async
    // finishes AFTER the cleanup runs (gameRef.current would still be null then).
    let localGame: Phaser.Game | null = null;

    async function initPhaser() {
      const Phaser = (await import("phaser")).default;
      const { PreloadScene } = await import("../../_libs/game/PreloadScene");
      const { GameScene } = await import("../../_libs/game/GameScene");

      // Cleanup ran while we were awaiting — abort, don't create the game.
      if (cancelled || !containerRef.current) return;

      // Guard: never create a second instance if one is already running.
      if (gameRef.current) return;

      const gameScene = new GameScene();
      gameScene.onPositionChange = onPositionChange;
      gameScene.setAgentBubbles(agentBubblesRef.current ?? {});
      gameScene.agentsConfigRef = agentsRef;
      if (sceneRef) sceneRef.current = gameScene;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: "100%",
        height: "100%",
        backgroundColor: "#18181b",
        scene: [PreloadScene, gameScene],
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          keyboard: { capture: [] },
        },
      });

      localGame     = game;
      gameRef.current = game;
    }

    initPhaser();

    return () => {
      cancelled = true;

      // Destroy whichever reference exists — localGame handles the race where
      // the async resolved but gameRef.current wasn't set yet at cleanup time.
      const instance = localGame ?? gameRef.current;
      instance?.destroy(true);

      localGame       = null;
      gameRef.current = null;
      if (sceneRef) sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef?.current?.setAgentBubbles(agentBubbles ?? {});
  }, [agentBubbles, sceneRef]);

  useEffect(() => {
    sceneRef?.current?.setAgentConfigs(agents);
  }, [agents, sceneRef]);

  useEffect(() => {
    sceneRef?.current?.setDiscussionMode(!!discussionMode);
  }, [discussionMode, sceneRef]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
      // Blur any focused input/textarea when the user clicks back into the game
      onPointerDown={() => (document.activeElement as HTMLElement)?.blur()}
    />
  );
}
