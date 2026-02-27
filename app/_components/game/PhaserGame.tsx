"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import type { GameScene } from "./scenes/GameScene";

type Props = {
  /** Called every time the local player moves — wire to socket in Phase 3 */
  onPositionChange?: (x: number, y: number) => void;
  /** Ref forwarded so parent components can call scene methods (e.g. upsertRemotePlayer) */
  sceneRef?: React.RefObject<GameScene | null>;
};

export function PhaserGame({ onPositionChange, sceneRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    // Phaser touches window/document so it CANNOT run on the server.
    // This useEffect only fires in the browser, so we're safe.
    let game: Phaser.Game;

    async function initPhaser() {
      // Dynamic import keeps Phaser out of the server bundle entirely
      const Phaser = (await import("phaser")).default;
      const { PreloadScene } = await import("./scenes/PreloadScene");
      const { GameScene } = await import("./scenes/GameScene");

      if (!containerRef.current) return;

      const gameScene = new GameScene();

      // Wire the position callback from React into the Phaser scene
      gameScene.onPositionChange = onPositionChange;

      // Expose scene instance to parent via ref
      if (sceneRef) sceneRef.current = gameScene;

      game = new Phaser.Game({
        type: Phaser.AUTO,           // WebGL if available, else Canvas
        parent: containerRef.current,
        width: "100%",
        height: "100%",
        backgroundColor: "#0d1117",
        scene: [PreloadScene, gameScene],
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 }, // top-down, no gravity
            debug: false,             // set true to see hitboxes while developing
          },
        },
        scale: {
          mode: Phaser.Scale.RESIZE, // canvas resizes with the container
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        // Prevent Phaser from stealing keyboard focus from React inputs
        input: {
          keyboard: { capture: [] },
        },
      });

      gameRef.current = game;
    }

    initPhaser();

    return () => {
      // Clean up Phaser when the React component unmounts
      gameRef.current?.destroy(true);
      gameRef.current = null;
      if (sceneRef) sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      // Prevent the browser context menu from showing over the game canvas
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
