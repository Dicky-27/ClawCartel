import Phaser from "phaser";

/**
 * PreloadScene runs before GameScene.
 * Load all textures, atlases, tilemaps, and audio here.
 * Phaser will show a loading bar while assets download.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    // Show a simple loading bar so the screen isn't blank
    this.createLoadingBar();

    // For now we generate textures procedurally (no external image files needed).
    // Later you'll replace these with actual sprite sheets:
    //   this.load.spritesheet("player", "/assets/characters.png", { frameWidth: 48, frameHeight: 48 });
    //   this.load.tilemapTiledJSON("map", "/assets/map.json");
    //   this.load.image("tiles", "/assets/tileset.png");
  }

  create() {
    // Generate placeholder textures programmatically so we can see something immediately
    this.generateTextures();
    this.scene.start("GameScene");
  }

  private createLoadingBar() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const barBg = this.add.rectangle(cx, cy, 300, 20, 0x333333);
    const bar = this.add.rectangle(cx - 150, cy, 0, 16, 0x4ade80);
    bar.setOrigin(0, 0.5);

    this.add
      .text(cx, cy - 30, "Loading...", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      bar.width = 300 * value;
    });
  }

  private generateTextures() {
    // Floor tile - a subtle grid square
    const floorGraphics = this.make.graphics({ x: 0, y: 0 });
    floorGraphics.fillStyle(0x1a2035, 1);
    floorGraphics.fillRect(0, 0, 32, 32);
    floorGraphics.lineStyle(1, 0x2a3045, 0.5);
    floorGraphics.strokeRect(0, 0, 32, 32);
    floorGraphics.generateTexture("floor", 32, 32);
    floorGraphics.destroy();

    // Wall tile - solid darker block
    const wallGraphics = this.make.graphics({ x: 0, y: 0 });
    wallGraphics.fillStyle(0x0d1117, 1);
    wallGraphics.fillRect(0, 0, 32, 32);
    wallGraphics.lineStyle(2, 0x30363d, 1);
    wallGraphics.strokeRect(0, 0, 32, 32);
    wallGraphics.generateTexture("wall", 32, 32);
    wallGraphics.destroy();

    // Player - a colored circle with a direction indicator
    const playerGraphics = this.make.graphics({ x: 0, y: 0 });
    playerGraphics.fillStyle(0x6366f1, 1); // indigo body
    playerGraphics.fillCircle(16, 16, 14);
    playerGraphics.fillStyle(0xffffff, 0.9);
    playerGraphics.fillCircle(16, 12, 5); // head highlight
    playerGraphics.generateTexture("player", 32, 32);
    playerGraphics.destroy();

    // Other player (different color)
    const otherGraphics = this.make.graphics({ x: 0, y: 0 });
    otherGraphics.fillStyle(0xf43f5e, 1); // rose body
    otherGraphics.fillCircle(16, 16, 14);
    otherGraphics.fillStyle(0xffffff, 0.9);
    otherGraphics.fillCircle(16, 12, 5);
    otherGraphics.generateTexture("other-player", 32, 32);
    otherGraphics.destroy();

    // Desk furniture
    const deskGraphics = this.make.graphics({ x: 0, y: 0 });
    deskGraphics.fillStyle(0x7c3aed, 1);
    deskGraphics.fillRoundedRect(2, 8, 60, 32, 4);
    deskGraphics.fillStyle(0x4c1d95, 1);
    deskGraphics.fillRect(4, 36, 8, 8); // desk leg
    deskGraphics.fillRect(54, 36, 8, 8); // desk leg
    deskGraphics.generateTexture("desk", 64, 48);
    deskGraphics.destroy();

    // Chair furniture
    const chairGraphics = this.make.graphics({ x: 0, y: 0 });
    chairGraphics.fillStyle(0x0891b2, 1);
    chairGraphics.fillRoundedRect(4, 4, 24, 24, 4);
    chairGraphics.generateTexture("chair", 32, 32);
    chairGraphics.destroy();

    // Plant decoration
    const plantGraphics = this.make.graphics({ x: 0, y: 0 });
    plantGraphics.fillStyle(0x166534, 1);
    plantGraphics.fillCircle(16, 12, 12);
    plantGraphics.fillStyle(0xb45309, 1);
    plantGraphics.fillRect(12, 22, 8, 10); // pot
    plantGraphics.generateTexture("plant", 32, 32);
    plantGraphics.destroy();
  }
}
