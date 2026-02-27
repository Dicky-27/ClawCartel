import Phaser from "phaser";

// ─── Animation frame layout for _run_16x16.png (24 cols × 2 rows) ────────────
// LimeZu Moderninteriors character run sheet row 0:
//   walk-down(0-5), walk-up(6-11), walk-left(12-17), walk-right(18-23)
const ANIM_FRAMES = {
  down:  { start: 0,  end: 5  },
  up:    { start: 6,  end: 11 },
  left:  { start: 12, end: 17 },
  right: { start: 18, end: 23 },
} as const;

type Direction = keyof typeof ANIM_FRAMES;

const DIRECTIONS: Direction[] = ["down", "left", "right", "up"];

const NPC_SPEED   = 60;   // pixels per second — slow & casual
const FRAME_RATE  = 8;    // animation fps
const SCALE       = 2.5;  // 16px × 2.5 = 40px visible — fits nicely with 48px tiles

// How long (ms) an NPC stays in each state before switching
const MIN_WALK_MS = 1000;
const MAX_WALK_MS = 3000;
const MIN_IDLE_MS = 500;
const MAX_IDLE_MS = 2000;

type NPCState = "walking" | "idle";

export type NPCConfig = {
  textureKey: string;  // e.g. "npc-adam"
  name: string;
  x: number;
  y: number;
  // Walkable area bounds (in pixels) — NPC stays inside this box
  bounds: { x1: number; y1: number; x2: number; y2: number };
};

export class NPC {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private label: Phaser.GameObjects.Text;

  private state: NPCState = "idle";
  private direction: Direction = "down";
  private stateTimer = 0;   // counts down in ms
  private scene: Phaser.Scene;
  private bounds: NPCConfig["bounds"];

  constructor(scene: Phaser.Scene, config: NPCConfig) {
    this.scene = scene;
    this.bounds = config.bounds;

    // ── Sprite ─────────────────────────────────────────────────────────────
    this.sprite = scene.physics.add.sprite(config.x, config.y, config.textureKey);
    this.sprite.setScale(SCALE);
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    // Shrink physics body so NPC slides past thin gaps
    this.sprite.setBodySize(10, 10);

    // ── Name label ─────────────────────────────────────────────────────────
    this.label = scene.add
      .text(config.x, config.y - 28, config.name, {
        fontSize: "10px",
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#00000099",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(11);

    // ── Register directional walk animations (once per texture key) ────────
    NPC.registerAnims(scene, config.textureKey);

    // Start with a random idle duration so all 4 NPCs don't sync up
    this.stateTimer = Phaser.Math.Between(0, MAX_IDLE_MS);
    this.playIdle();
  }

  // ─── Called every frame from GameScene.update() ──────────────────────────

  update(delta: number) {
    this.stateTimer -= delta;

    if (this.stateTimer <= 0) {
      // Toggle between walking and idle
      if (this.state === "idle") {
        this.startWalking();
      } else {
        this.startIdle();
      }
    }

    // Sync label above sprite
    this.label.setPosition(this.sprite.x, this.sprite.y - 28);

    // If NPC walked into a wall (velocity blocked by physics), pick a new direction
    if (this.state === "walking") {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      const blocked = body.blocked.left || body.blocked.right ||
                      body.blocked.up   || body.blocked.down;
      if (blocked) this.startWalking();

      // If NPC walked out of bounds, reverse
      this.clampToBounds();
    }
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }

  // ─── State transitions ────────────────────────────────────────────────────

  private startWalking() {
    this.state = "walking";
    this.stateTimer = Phaser.Math.Between(MIN_WALK_MS, MAX_WALK_MS);

    // Pick a random direction
    this.direction = DIRECTIONS[Phaser.Math.Between(0, 3)];

    const vel = NPC_SPEED;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this.direction) {
      case "down":  body.setVelocity(0,    vel);  break;
      case "up":    body.setVelocity(0,   -vel);  break;
      case "left":  body.setVelocity(-vel,  0);   break;
      case "right": body.setVelocity(vel,   0);   break;
    }

    this.sprite.play(`${this.sprite.texture.key}-walk-${this.direction}`, true);
  }

  private startIdle() {
    this.state = "idle";
    this.stateTimer = Phaser.Math.Between(MIN_IDLE_MS, MAX_IDLE_MS);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.playIdle();
  }

  private playIdle() {
    // Show the first frame of the current walk direction as idle pose
    const frames = ANIM_FRAMES[this.direction];
    this.sprite.setFrame(frames.start);
  }

  private clampToBounds() {
    const { x1, y1, x2, y2 } = this.bounds;
    if (this.sprite.x < x1 || this.sprite.x > x2 ||
        this.sprite.y < y1 || this.sprite.y > y2) {
      this.startWalking(); // pick a new direction
    }
  }

  // ─── Static: register Phaser animations once per texture key ─────────────

  private static registeredKeys = new Set<string>();

  static registerAnims(scene: Phaser.Scene, textureKey: string) {
    if (NPC.registeredKeys.has(textureKey)) return;
    NPC.registeredKeys.add(textureKey);

    for (const [dir, { start, end }] of Object.entries(ANIM_FRAMES)) {
      scene.anims.create({
        key: `${textureKey}-walk-${dir}`,
        frames: scene.anims.generateFrameNumbers(textureKey, { start, end }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }
  }
}
