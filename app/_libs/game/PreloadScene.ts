import * as Phaser from "phaser";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    this.createLoadingBar();

    // ── Tilemap ──────────────────────────────────────────────────────────────
    this.load.tilemapTiledJSON("map", "/assets/map.json");

    // ── Tileset images (keys must match "name" in map.json tilesets) ─────────
    this.load.image("room-builder", "/assets/Room_Builder_free_48x48.png");
    this.load.image("interiors",    "/assets/Interiors_free_48x48.png");

    // ── Player — Bob spritesheet ─────────────────────────────────────────────
    // Bob_run_16x16.png: 384×32 → 24 cols × 2 rows, each frame is 16×16 px
    this.load.spritesheet("player", "/assets/Bob_run_16x16.png", {
      frameWidth:  16,
      frameHeight: 32,   // ← MUST be 16, not 32 (2 rows exist but each frame = 1 row)
    });

    // ── Agent character spritesheets (Adam, Alex, Amelia, BOB) ───────────────
    // Same layout: 24 cols × 2 rows, 16×16 per frame
    const agentChars = ["Adam", "Alex", "Amelia", "Bob"];
    for (const name of agentChars) {
      this.load.spritesheet(
        `npc-${name.toLowerCase()}`,
        `/assets/${name}_run_16x16.png`,
        { frameWidth: 16, frameHeight: 32 },  // ← fixed: was incorrectly 32
      );
    }

    // ── Remote player placeholder (multiplayer — Phase 3) ───────────────────
    this.generateRemotePlayerTexture();
  }

  create() {
    this.scene.start("GameScene");
  }

  // ─── Loading Bar ──────────────────────────────────────────────────────────

  private createLoadingBar() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add
      .text(cx, cy - 40, "Loading world...", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, cy, 300, 16, 0x222222);
    const bar = this.add.rectangle(cx - 150, cy, 0, 12, 0xffbc8d); /* theme primary */
    bar.setOrigin(0, 0.5);

    this.load.on("progress", (v: number) => { bar.width = 300 * v; });
  }

  // ─── Remote player texture (simple coloured circle, no spritesheet needed) ─

  private generateRemotePlayerTexture() {
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xf43f5e, 1);
    g.fillCircle(20, 20, 18);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(20, 13, 6);
    g.generateTexture("other-player", 40, 40);
    g.destroy();
  }
}
