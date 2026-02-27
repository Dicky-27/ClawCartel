import Phaser from "phaser";
import { NPC, type NPCConfig } from "./NPC";

const TILE_SIZE    = 48;
const PLAYER_SPEED = 180;
const PLAYER_SCALE = 2.5;   // 16px × 2.5 = 40px visible
const FRAME_RATE   = 8;

// Walkable area bounds for NPC patrol (cols 2–27, rows 2–17 in pixels)
const ROOM_BOUNDS = {
  x1: 2  * TILE_SIZE,
  y1: 2  * TILE_SIZE,
  x2: 27 * TILE_SIZE,
  y2: 17 * TILE_SIZE,
};

// Bob is the player — use Adam, Alex, Amelia as the 3 NPCs (+ a 4th Bob NPC)
const NPC_CONFIGS: Omit<NPCConfig, "bounds">[] = [
  { textureKey: "npc-adam",   name: "Adam",   x: 4  * TILE_SIZE + 24, y: 5  * TILE_SIZE + 24 },
  { textureKey: "npc-alex",   name: "Alex",   x: 8  * TILE_SIZE + 24, y: 7  * TILE_SIZE + 24 },
  { textureKey: "npc-amelia", name: "Amelia", x: 14 * TILE_SIZE + 24, y: 5  * TILE_SIZE + 24 },
  { textureKey: "npc-bob",    name: "Bob NPC", x: 18 * TILE_SIZE + 24, y: 9  * TILE_SIZE + 24 },
];

// Direction → frame range mapping (LimeZu _run_16x16.png row 0 layout)
const PLAYER_ANIM = {
  down:  { start: 0,  end: 5  },
  up:    { start: 6,  end: 11 },
  left:  { start: 12, end: 17 },
  right: { start: 18, end: 23 },
} as const;

type Dir = keyof typeof PLAYER_ANIM;

export type PlayerData = {
  id: string;
  x: number;
  y: number;
  name: string;
};

export class GameScene extends Phaser.Scene {
  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up:    Phaser.Input.Keyboard.Key;
    down:  Phaser.Input.Keyboard.Key;
    left:  Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Local player (Bob)
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;
  private lastDir: Dir = "down";   // remember last direction for idle pose

  // Remote players — Phase 3 multiplayer
  private otherPlayers: Map<
    string,
    { sprite: Phaser.Physics.Arcade.Sprite; label: Phaser.GameObjects.Text }
  > = new Map();

  // Tilemap layers
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private interiorLayer!: Phaser.Tilemaps.TilemapLayer;

  // NPCs
  private npcs: NPC[] = [];

  // Bridge callback → React (for coords HUD + socket in Phase 3)
  onPositionChange?: (x: number, y: number) => void;

  constructor() {
    super({ key: "GameScene" });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create() {
    this.buildTilemap();
    this.registerPlayerAnims();
    this.createPlayer();
    this.createNPCs();
    this.setupInput();
    this.setupCollisions();
    this.setupCamera();

    this.onPositionChange?.(this.player.x, this.player.y);
  }

  update(_time: number, delta: number) {
    this.handleMovement();
    this.syncNameTagPosition();
    for (const npc of this.npcs) npc.update(delta);
  }

  // ─── Tilemap ─────────────────────────────────────────────────────────────────

  private buildTilemap() {
    const map = this.make.tilemap({ key: "map" });

    const roomTiles     = map.addTilesetImage("room-builder", "room-builder")!;
    const interiorTiles = map.addTilesetImage("interiors",    "interiors")!;

    const floorLayer = map.createLayer("Floor", roomTiles);
    if (floorLayer) floorLayer.setDepth(0);

    this.wallLayer = map.createLayer("Wall", roomTiles)!;
    this.wallLayer.setDepth(1);
    this.wallLayer.setCollisionByExclusion([-1]);

    // Un-mark the known floor tile IDs so the player can walk on them
    const walkable = [202, 203, 204, 219, 220, 221, 308, 309, 310, 291, 292, 293];
    this.wallLayer.setCollision(walkable, false);

    this.interiorLayer = map.createLayer("Interior", interiorTiles)!;
    this.interiorLayer.setDepth(2);
    this.interiorLayer.setCollisionByExclusion([-1]);

    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
  }

  // ─── Player animations ────────────────────────────────────────────────────────

  private registerPlayerAnims() {
    for (const [dir, { start, end }] of Object.entries(PLAYER_ANIM)) {
      this.anims.create({
        key:       `player-walk-${dir}`,
        frames:    this.anims.generateFrameNumbers("player", { start, end }),
        frameRate: FRAME_RATE,
        repeat:    -1,
      });
    }
  }

  // ─── Player ──────────────────────────────────────────────────────────────────

  private createPlayer() {
    const spawnX = 5 * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = 8 * TILE_SIZE + TILE_SIZE / 2;

    this.player = this.physics.add.sprite(spawnX, spawnY, "player");
    this.player.setScale(PLAYER_SCALE);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    // Tight physics body so player doesn't catch on tile corners
    this.player.setBodySize(10, 10);

    // Start facing down (idle pose = first frame of down animation)
    this.player.setFrame(PLAYER_ANIM.down.start);

    this.playerNameTag = this.add
      .text(spawnX, spawnY - 28, "You", {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#6366f1cc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private syncNameTagPosition() {
    if (!this.player || !this.playerNameTag) return;
    this.playerNameTag.setPosition(this.player.x, this.player.y - 28);
  }

  // ─── Camera ──────────────────────────────────────────────────────────────────

  private setupCamera() {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private handleMovement() {
    const body  = this.player.body as Phaser.Physics.Arcade.Body;
    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    let vx = 0;
    let vy = 0;
    let dir: Dir | null = null;

    // Horizontal takes priority for direction display when moving diagonally
    if (left)       { vx = -PLAYER_SPEED; dir = "left"; }
    else if (right) { vx =  PLAYER_SPEED; dir = "right"; }

    if (up)         { vy = -PLAYER_SPEED; if (!dir) dir = "up"; }
    else if (down)  { vy =  PLAYER_SPEED; if (!dir) dir = "down"; }

    // Normalize diagonal speed
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;

    if (moving && dir) {
      this.lastDir = dir;
      // Play walk animation only if not already playing the right one
      const animKey = `player-walk-${dir}`;
      if (this.player.anims.currentAnim?.key !== animKey) {
        this.player.play(animKey);
      }
      this.onPositionChange?.(this.player.x, this.player.y);
    } else {
      // Stopped — freeze on the first frame of the last direction (idle pose)
      this.player.stop();
      this.player.setFrame(PLAYER_ANIM[this.lastDir].start);
    }
  }

  // ─── NPCs ─────────────────────────────────────────────────────────────────────

  private createNPCs() {
    for (const config of NPC_CONFIGS) {
      this.npcs.push(new NPC(this, { ...config, bounds: ROOM_BOUNDS }));
    }
  }

  // ─── Collisions ──────────────────────────────────────────────────────────────

  private setupCollisions() {
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.player, this.interiorLayer);
    for (const npc of this.npcs) {
      this.physics.add.collider(npc.sprite, this.wallLayer);
      this.physics.add.collider(npc.sprite, this.interiorLayer);
    }
  }

  // ─── Multiplayer API (Phase 3) ────────────────────────────────────────────────

  upsertRemotePlayer(data: PlayerData) {
    if (this.otherPlayers.has(data.id)) {
      const { sprite, label } = this.otherPlayers.get(data.id)!;
      sprite.setPosition(data.x, data.y);
      label.setPosition(data.x, data.y - 28);
    } else {
      const sprite = this.physics.add.sprite(data.x, data.y, "other-player");
      sprite.setDepth(10);
      const label = this.add
        .text(data.x, data.y - 28, data.name, {
          fontSize: "11px",
          color: "#ffffff",
          fontFamily: "monospace",
          backgroundColor: "#f43f5ecc",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(11);
      this.otherPlayers.set(data.id, { sprite, label });
    }
  }

  removeRemotePlayer(id: string) {
    const entry = this.otherPlayers.get(id);
    if (entry) {
      entry.sprite.destroy();
      entry.label.destroy();
      this.otherPlayers.delete(id);
    }
  }

  getPlayerPosition() {
    return { x: this.player.x, y: this.player.y };
  }
}
