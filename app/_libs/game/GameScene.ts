import * as Phaser from "phaser";
import { MapAgent, type MapAgentConfig } from "./MapAgent";

const TILE_SIZE_OLD = 48;
const TILE_SIZE_NEW = 32;
const PLAYER_SPEED = 100;
const JOYSTICK_SPEED_FACTOR = 0.55;
const PLAYER_SCALE = 2.5;
const FRAME_RATE = 8;

const ROOM_BOUNDS_48 = {
  x1: 2 * TILE_SIZE_OLD,
  y1: 2 * TILE_SIZE_OLD,
  x2: 27 * TILE_SIZE_OLD,
  y2: 17 * TILE_SIZE_OLD,
};
const ROOM_BOUNDS_32 = {
  x1: 2 * TILE_SIZE_NEW,
  y1: 2 * TILE_SIZE_NEW,
  x2: 38 * TILE_SIZE_NEW,
  y2: 22 * TILE_SIZE_NEW,
};

/** Fixed positions per agent name (48px map). */
const AGENT_POSITIONS_48: Record<string, { x: number; y: number }> = {
  Adam: { x: 4 * TILE_SIZE_OLD + 24, y: 5 * TILE_SIZE_OLD + 24 },
  Alex: { x: 8 * TILE_SIZE_OLD + 24, y: 7 * TILE_SIZE_OLD + 24 },
  Amelia: { x: 14 * TILE_SIZE_OLD + 24, y: 5 * TILE_SIZE_OLD + 24 },
  BOB: { x: 18 * TILE_SIZE_OLD + 24, y: 9 * TILE_SIZE_OLD + 24 },
};
/** Fixed positions per agent name (32px ClawCartel map). */
const AGENT_POSITIONS_32: Record<string, { x: number; y: number }> = {
  Adam: { x: 6 * TILE_SIZE_NEW + 16, y: 6 * TILE_SIZE_NEW + 16 },
  Alex: { x: 12 * TILE_SIZE_NEW + 16, y: 8 * TILE_SIZE_NEW + 16 },
  Amelia: { x: 20 * TILE_SIZE_NEW + 16, y: 6 * TILE_SIZE_NEW + 16 },
  BOB: { x: 26 * TILE_SIZE_NEW + 16, y: 10 * TILE_SIZE_NEW + 16 },
};
const DEFAULT_AGENT_POS_48 = { x: 12 * TILE_SIZE_OLD + 24, y: 8 * TILE_SIZE_OLD + 24 };
const DEFAULT_AGENT_POS_32 = { x: 20 * TILE_SIZE_NEW + 16, y: 12 * TILE_SIZE_NEW + 16 };

const MEETING_CENTER_X_48 = 15 * TILE_SIZE_OLD + 24;
const MEETING_CENTER_Y_48 = 10 * TILE_SIZE_OLD + 24;
const MEETING_CENTER_X_32 = 20 * TILE_SIZE_NEW + 16;
const MEETING_CENTER_Y_32 = 12 * TILE_SIZE_NEW + 16;
const MEETING_RADIUS_48 = 88;
const MEETING_RADIUS_32 = 100;
const MEETING_ANGLES = [0, 72, 144, 216, 288];

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
  /** All layers the player/agents collide with (Wall, Interior, Section, etc.). */
  private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];

  private agents: MapAgent[] = [];
  private agentBubbles: Record<string, string> = {};
  private discussionMode = false;

  /** Set in buildTilemap from the loaded map. */
  private roomBounds = ROOM_BOUNDS_48;
  private agentPositions = AGENT_POSITIONS_48;
  private defaultAgentPos = DEFAULT_AGENT_POS_48;
  private meetingCenterX = MEETING_CENTER_X_48;
  private meetingCenterY = MEETING_CENTER_Y_48;
  private meetingRadius = MEETING_RADIUS_48;
  private tileSize = TILE_SIZE_OLD;

  onPositionChange?: (x: number, y: number) => void;
  onAgentInteract?: (agentName: string) => void;

  /** Set by PhaserGame so create() can read initial agents (scene not ready until create). */
  agentsConfigRef?: { current: Array<{ name: string; textureKey: string }> | undefined };

  setAgentBubbles(bubbles: Record<string, string>) {
    this.agentBubbles = bubbles ?? {};
  }

  setDiscussionMode(on: boolean) {
    if (this.discussionMode === on) return;
    this.discussionMode = on;
    const deg = (d: number) => (d * Math.PI) / 180;
    const { meetingCenterX, meetingCenterY, meetingRadius } = this;
    const center = on ? this.findOpenSpawnNear(meetingCenterX, meetingCenterY) : null;
    this.agents.forEach((agent, i) => {
      if (on && center) {
        const angle = deg(MEETING_ANGLES[i % MEETING_ANGLES.length]);
        const idealX = center.x + meetingRadius * Math.cos(angle);
        const idealY = center.y + meetingRadius * Math.sin(angle);
        const { x, y } = this.findOpenSpawnNear(idealX, idealY, 128);
        agent.setMeetingTarget(x, y, center.x, center.y, meetingRadius);
      } else {
        agent.setMeetingTarget(null);
      }
    });
  }

  /** Create/update map agents from API data. Only recreates when the list of names actually changes. */
  setAgentConfigs(agents: Array<{ name: string; textureKey: string }>) {
    const newNames = agents.map((a) => a.name).join(",");
    const curNames = this.agents.map((a) => a.name).join(",");
    if (newNames === curNames && this.agents.length === agents.length) return;

    for (const a of this.agents) a.destroy();
    this.agents = [];
    const pos = (name: string) =>
      this.agentPositions[name] ?? this.defaultAgentPos;
    for (const a of agents) {
      const raw = pos(a.name);
      const { x, y } = this.findWalkableNear(raw.x, raw.y);
      const config: MapAgentConfig = {
        textureKey: a.textureKey,
        name: a.name,
        x,
        y,
        bounds: this.roomBounds,
      };
      const agent = new MapAgent(this, config);
      this.agents.push(agent);
      agent.sprite.setInteractive({ useHandCursor: true });
      agent.sprite.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.onAgentInteract?.(a.name);
      });
      for (const layer of this.collisionLayers) {
        this.physics.add.collider(agent.sprite, layer);
      }
    }
    if (this.discussionMode) {
      const deg = (d: number) => (d * Math.PI) / 180;
      const { meetingCenterX, meetingCenterY, meetingRadius } = this;
      const center = this.findOpenSpawnNear(meetingCenterX, meetingCenterY);
      const cx = center.x;
      const cy = center.y;
      this.agents.forEach((agent, i) => {
        const angle = deg(MEETING_ANGLES[i % MEETING_ANGLES.length]);
        const idealX = cx + meetingRadius * Math.cos(angle);
        const idealY = cy + meetingRadius * Math.sin(angle);
        const { x, y } = this.findOpenSpawnNear(idealX, idealY, 128);
        agent.setMeetingTarget(x, y, cx, cy, meetingRadius);
      });
    }
  }

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
    this.setupInput();
    this.setupCollisions();
    this.setupCamera();
    // Create map agents from ref (set by PhaserGame); physics only exists after create()
    this.setAgentConfigs(this.agentsConfigRef?.current ?? []);

    this.onPositionChange?.(this.player.x, this.player.y);
  }

  update(_time: number, delta: number) {
    this.handleMovement();
    this.syncNameTagPosition();
    for (const agent of this.agents) {
      agent.setBubbleText(this.agentBubbles[agent.name] ?? "");
      agent.update(delta);
    }
  }

  // ─── Tilemap ─────────────────────────────────────────────────────────────────

  private buildTilemap() {
    const map = this.make.tilemap({ key: "map" });
    const names: string[] = this.registry.get("tilesetNames") ?? [];
    // Add tilesets by index (names from PreloadScene TSX parsing, or embedded map tileset name)
    const tilesets = (map.tilesets ?? [])
      .map((ts, i) => {
        const name = names[i] ?? ts.name;
        if (!name || !this.textures.exists(name)) return null;
        return map.addTilesetImage(name, name);
      })
      .filter((t): t is Phaser.Tilemaps.Tileset => t != null);

    const isClawCartel = map.tileWidth === 32 && map.width === 40 && map.height === 24;
    if (!isClawCartel || tilesets.length === 0) {
      this.cameras.main.setBackgroundColor(0x18181b);
      this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
      this.registry.set("worldW", map.widthInPixels);
      this.registry.set("worldH", map.heightInPixels);
      this.wallLayer = null as unknown as Phaser.Tilemaps.TilemapLayer;
      this.interiorLayer = null as unknown as Phaser.Tilemaps.TilemapLayer;
      this.collisionLayers = [];
      return;
    }

    {
      this.tileSize = TILE_SIZE_NEW;
      this.roomBounds = ROOM_BOUNDS_32;
      this.agentPositions = AGENT_POSITIONS_32;
      this.defaultAgentPos = DEFAULT_AGENT_POS_32;
      this.meetingCenterX = MEETING_CENTER_X_32;
      this.meetingCenterY = MEETING_CENTER_Y_32;
      this.meetingRadius = MEETING_RADIUS_32;

      const layerOrder = [
        "Terrain / Floor",
        "Terrain / Floor 2",
        "Floor",
        "Floor 2",
        "Wall",
        "Fences",
        "Poster",
        "Chest",
        "Chest 2",
        "Dust",
        "Barrel",
        "Barrel",
        "Lumber/Lumber",
        "Lumber/Lumber 2",
        "Rug",
        "Chair",
        "Table",
        "Long Table",
        "Chair 2",
        "Lighting",
        "Wine",
        "Cabinet",
        "Dust 2",
        "Skeletons",
        "Smith 2",
        "Section 2",
        "Stairs 2",
        "Stairs",
        "Fences 2",
        "Smith",
        "Fences 3",
        "Section",
        "Drain",
        "Fire",
        "Stairs",
        "Plant",
      ];

      let depth = 0;
      for (const name of layerOrder) {
        const layer = map.createLayer(name, tilesets);
        if (layer) layer.setDepth(depth++);
      }

      const walkableLayerNames = [
        "Terrain / Floor",
        "Terrain / Floor 2",
        "Floor",
        "Floor 2",
      ];
      const solidLayerNames = layerOrder.filter(
        (name) => !walkableLayerNames.includes(name),
      );

      const wallLayer = map.getLayer("Wall")?.tilemapLayer;
      this.wallLayer = wallLayer ?? map.createLayer("Wall", tilesets)!;
      this.wallLayer.setCollisionByExclusion([-1]);

      this.interiorLayer = map.getLayer("Fences")?.tilemapLayer ?? this.wallLayer;
      if (this.interiorLayer !== this.wallLayer) {
        this.interiorLayer.setCollisionByExclusion([-1]);
      }

      this.collisionLayers = [this.wallLayer, this.interiorLayer];
      for (const name of solidLayerNames) {
        const layer = map.getLayer(name)?.tilemapLayer;
        if (layer && !this.collisionLayers.includes(layer)) {
          layer.setCollisionByExclusion([-1]);
          this.collisionLayers.push(layer);
        }
      }
    }

    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.registry.set("worldW", worldW);
    this.registry.set("worldH", worldH);
  }

  /** True if no collision layer has a solid tile at this world point. */
  private isWalkable(wx: number, wy: number): boolean {
    if (!this.collisionLayers.length) return true;
    for (const layer of this.collisionLayers) {
      const tile = layer.getTileAtWorldXY(wx, wy);
      if (tile && tile.index !== -1) return false;
    }
    return true;
  }

  /** Return a walkable point at or near (wx, wy), within maxRadius. */
  private findWalkableNear(wx: number, wy: number, maxRadius = 128): { x: number; y: number } {
    const step = this.tileSize;
    if (this.isWalkable(wx, wy)) return { x: wx, y: wy };
    for (let r = step; r <= maxRadius; r += step) {
      for (let dx = -r; dx <= r; dx += step) {
        for (let dy = -r; dy <= r; dy += step) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = wx + dx;
          const ny = wy + dy;
          if (this.isWalkable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x: wx, y: wy };
  }

  /** True if (wx, wy) is walkable and has clearance (no solid tile within clearance px in cardinals). */
  private isInOpenArea(wx: number, wy: number, clearance = 48): boolean {
    if (!this.isWalkable(wx, wy)) return false;
    return (
      this.isWalkable(wx + clearance, wy) &&
      this.isWalkable(wx - clearance, wy) &&
      this.isWalkable(wx, wy + clearance) &&
      this.isWalkable(wx, wy - clearance)
    );
  }

  /** Like findWalkableNear but only returns a point with clearance (not against furniture). */
  private findOpenSpawnNear(wx: number, wy: number, maxRadius = 224): { x: number; y: number } {
    const step = this.tileSize;
    if (this.isInOpenArea(wx, wy)) return { x: wx, y: wy };
    for (let r = step; r <= maxRadius; r += step) {
      for (let dx = -r; dx <= r; dx += step) {
        for (let dy = -r; dy <= r; dy += step) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = wx + dx;
          const ny = wy + dy;
          if (this.isInOpenArea(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return this.findWalkableNear(wx, wy, maxRadius);
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
    const worldW = this.registry.get("worldW") ?? 0;
    const worldH = this.registry.get("worldH") ?? 0;
    const { x: spawnX, y: spawnY } = this.findOpenSpawnNear(worldW / 2, worldH / 2);

    this.player = this.physics.add.sprite(spawnX, spawnY, "player");
    this.player.setScale(PLAYER_SCALE);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    // Tight physics body so player doesn't catch on tile corners
    this.player.setBodySize(10, 10);

    // Start facing down (idle pose = first frame of down animation)
    this.player.setFrame(PLAYER_ANIM.down.start);

    this.playerNameTag = this.add
      .text(spawnX, spawnY - 28, "", {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#6366f1cc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11)
      .setVisible(false);
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

  // ─── Collisions ──────────────────────────────────────────────────────────────

  private setupCollisions() {
    for (const layer of this.collisionLayers) {
      this.physics.add.collider(this.player, layer);
    }
    for (const agent of this.agents) {
      for (const layer of this.collisionLayers) {
        this.physics.add.collider(agent.sprite, layer);
      }
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
