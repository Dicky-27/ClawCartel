import * as Phaser from "phaser";
import { MapAgent, type MapAgentConfig } from "./MapAgent";

const TILE_SIZE = 48;
const PLAYER_SPEED = 100;
const JOYSTICK_SPEED_FACTOR = 0.55;
const PLAYER_SCALE = 2.5;
const FRAME_RATE = 8;

const ROOM_BOUNDS = {
  x1: 2 * TILE_SIZE,
  y1: 2 * TILE_SIZE,
  x2: 27 * TILE_SIZE,
  y2: 17 * TILE_SIZE,
};

const AGENT_CONFIGS: Omit<MapAgentConfig, "bounds">[] = [
  { textureKey: "npc-adam", name: "Adam", x: 4 * TILE_SIZE + 24, y: 5 * TILE_SIZE + 24 },
  { textureKey: "npc-alex", name: "Alex", x: 8 * TILE_SIZE + 24, y: 7 * TILE_SIZE + 24 },
  { textureKey: "npc-amelia", name: "Amelia", x: 14 * TILE_SIZE + 24, y: 5 * TILE_SIZE + 24 },
  { textureKey: "npc-bob", name: "BOB", x: 18 * TILE_SIZE + 24, y: 9 * TILE_SIZE + 24 },
];

const PLAYER_ANIM = {
  down: { start: 0, end: 5 },
  up: { start: 6, end: 11 },
  left: { start: 12, end: 17 },
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
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;
  private lastDir: Dir = "down"; // remember last direction for idle pose

  private otherPlayers: Map<
    string,
    { sprite: Phaser.Physics.Arcade.Sprite; label: Phaser.GameObjects.Text }
  > = new Map();

  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private interiorLayer!: Phaser.Tilemaps.TilemapLayer;

  private agents: MapAgent[] = [];

  onPositionChange?: (x: number, y: number) => void;
  onAgentInteract?: (agentName: string) => void;

  private joystickVx = 0;
  private joystickVy = 0;
  setJoystickInput(nx: number, ny: number) {
    this.joystickVx = nx;
    this.joystickVy = ny;
  }

  constructor() {
    super({ key: "GameScene" });
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  create() {
    this.buildTilemap();
    this.registerPlayerAnims();
    this.createPlayer();
    this.createAgents();
    this.setupInput();
    this.setupCollisions();
    this.setupCamera();

    this.onPositionChange?.(this.player.x, this.player.y);
  }

  update(_time: number, delta: number) {
    this.handleMovement();
    this.syncNameTagPosition();
    for (const agent of this.agents) agent.update(delta);
  }

  // ─── Tilemap ─────────────────────────────────────────────────────────────────

  private buildTilemap() {
    const map = this.make.tilemap({ key: "map" });

    const roomTiles = map.addTilesetImage("room-builder", "room-builder")!;
    const interiorTiles = map.addTilesetImage("interiors", "interiors")!;

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
    // Store world size for camera setup (camera bounds set in setupCamera)
    this.registry.set("worldW", worldW);
    this.registry.set("worldH", worldH);
  }

  // ─── Player animations ────────────────────────────────────────────────────────

  private registerPlayerAnims() {
    for (const [dir, { start, end }] of Object.entries(PLAYER_ANIM)) {
      this.anims.create({
        key: `player-walk-${dir}`,
        frames: this.anims.generateFrameNumbers("player", { start, end }),
        frameRate: FRAME_RATE,
        repeat: -1,
      });
    }
  }

  // ─── Player ──────────────────────────────────────────────────────────────────

  private createPlayer() {
    // Spawn in the center of the open floor area (col 15, row 10)
    const spawnX = 15 * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = 10 * TILE_SIZE + TILE_SIZE / 2;

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
    const worldW: number = this.registry.get("worldW");
    const worldH: number = this.registry.get("worldH");

    // Expand camera bounds far beyond the world so the camera can center on
    // the player regardless of where they stand — including map edges.
    // Without this, Phaser clamps the view to (0,0) when the viewport is
    // larger than the world, pushing the entire map into the top-left corner.
    this.cameras.main.setBounds(-worldW, -worldH, worldW * 3, worldH * 3);

    // Smooth lerp follow (0.1 = eases toward player, not instant snap)
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private setupInput() {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Block ALL keyboard events from reaching Phaser when a form element is focused.
    // We intercept at the capture phase (fires before Phaser's listeners) and call
    // stopPropagation() so Phaser never sees the event — no per-key config needed.
    const isFormElement = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
    };

    const blockForPhaser = (e: KeyboardEvent) => {
      if (isFormElement()) e.stopPropagation();
    };

    // true = capture phase, so we fire before Phaser's bubble-phase listeners
    document.addEventListener("keydown", blockForPhaser, true);
    document.addEventListener("keyup", blockForPhaser, true);

    // Stop the player when focus enters a form element
    const onFocusIn = () => {
      if (isFormElement()) {
        const body = this.player?.body as Phaser.Physics.Arcade.Body | undefined;
        body?.setVelocity(0, 0);
        this.player?.stop();
        this.player?.setFrame(PLAYER_ANIM[this.lastDir].start);
      }
    };
    document.addEventListener("focusin", onFocusIn);

    // Clean up when this scene shuts down
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("keydown", blockForPhaser, true);
      document.removeEventListener("keyup", blockForPhaser, true);
      document.removeEventListener("focusin", onFocusIn);
    });
  }

  private handleMovement() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    const useJoystick = this.joystickVx !== 0 || this.joystickVy !== 0;

    let vx = 0;
    let vy = 0;
    let dir: Dir | null = null;

    if (useJoystick) {
      vx = this.joystickVx * PLAYER_SPEED * JOYSTICK_SPEED_FACTOR;
      vy = this.joystickVy * PLAYER_SPEED * JOYSTICK_SPEED_FACTOR;
      if (vx !== 0 || vy !== 0) {
        if (Math.abs(vx) >= Math.abs(vy)) dir = vx > 0 ? "right" : "left";
        else dir = vy > 0 ? "down" : "up";
      }
    } else {
      const up = this.cursors.up.isDown || this.wasd.up.isDown;
      const down = this.cursors.down.isDown || this.wasd.down.isDown;
      const left = this.cursors.left.isDown || this.wasd.left.isDown;
      const right = this.cursors.right.isDown || this.wasd.right.isDown;

      if (left) {
        vx = -PLAYER_SPEED;
        dir = "left";
      } else if (right) {
        vx = PLAYER_SPEED;
        dir = "right";
      }

      if (up) {
        vy = -PLAYER_SPEED;
        if (!dir) dir = "up";
      } else if (down) {
        vy = PLAYER_SPEED;
        if (!dir) dir = "down";
      }

      if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
      }
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

  // ─── Map agents ─────────────────────────────────────────────────────────────

  private createAgents() {
    for (const config of AGENT_CONFIGS) {
      const agent = new MapAgent(this, { ...config, bounds: ROOM_BOUNDS });
      this.agents.push(agent);
      // Click agent → notify React (e.g. open agents panel)
      agent.sprite.setInteractive({ useHandCursor: true });
      agent.sprite.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.onAgentInteract?.(config.name);
      });
    }
  }

  // ─── Collisions ──────────────────────────────────────────────────────────────

  private setupCollisions() {
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.player, this.interiorLayer);
    for (const agent of this.agents) {
      this.physics.add.collider(agent.sprite, this.wallLayer);
      this.physics.add.collider(agent.sprite, this.interiorLayer);
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
