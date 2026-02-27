import Phaser from "phaser";

const TILE_SIZE = 32;
const PLAYER_SPEED = 160;
const WORLD_COLS = 40;
const WORLD_ROWS = 30;

// Simple map layout — 0=floor, 1=wall
// You can later replace this with a Tiled JSON tilemap
const MAP_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

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
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Player
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerNameTag!: Phaser.GameObjects.Text;

  // World
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private furnitureGroup!: Phaser.Physics.Arcade.StaticGroup;

  // Other players (multiplayer - populated via socket later)
  private otherPlayers: Map<
    string,
    { sprite: Phaser.Physics.Arcade.Sprite; label: Phaser.GameObjects.Text }
  > = new Map();

  // Position emit callback (called on every move, wired up to socket in Phase 3)
  onPositionChange?: (x: number, y: number) => void;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    const worldWidth = WORLD_COLS * TILE_SIZE;
    const worldHeight = WORLD_ROWS * TILE_SIZE;

    // Set physics world bounds to the full map size
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.buildMap();
    this.buildFurniture();
    this.createPlayer();
    this.setupCamera(worldWidth, worldHeight);
    this.setupInput();
    this.setupCollisions();

    // Emit initial position
    this.onPositionChange?.(this.player.x, this.player.y);
  }

  update() {
    this.handleMovement();
    this.updateNameTagPosition();
  }

  // ─── Map Building ────────────────────────────────────────────────────────────

  private buildMap() {
    this.wallGroup = this.physics.add.staticGroup();

    for (let row = 0; row < MAP_LAYOUT.length; row++) {
      for (let col = 0; col < MAP_LAYOUT[row].length; col++) {
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;

        if (MAP_LAYOUT[row][col] === 1) {
          const wall = this.wallGroup.create(x, y, "wall") as Phaser.Physics.Arcade.Sprite;
          wall.setImmovable(true);
        } else {
          this.add.image(x, y, "floor");
        }
      }
    }

    // Fill remaining area below the defined map with floor tiles
    for (let row = MAP_LAYOUT.length; row < WORLD_ROWS; row++) {
      for (let col = 0; col < WORLD_COLS; col++) {
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;
        this.add.image(x, y, "floor");
      }
    }
  }

  private buildFurniture() {
    this.furnitureGroup = this.physics.add.staticGroup();

    const furnitureLayout = [
      // [col, row, texture, isCollidable]
      [2, 2, "desk", true],
      [2, 3, "chair", false],
      [4, 2, "desk", true],
      [4, 3, "chair", false],
      [11, 2, "desk", true],
      [11, 3, "chair", false],
      [14, 2, "desk", true],
      [14, 3, "chair", false],
      [2, 8, "plant", true],
      [17, 8, "plant", true],
      [10, 8, "desk", true],
      [10, 9, "chair", false],
    ] as [number, number, string, boolean][];

    for (const [col, row, texture, collidable] of furnitureLayout) {
      const x = col * TILE_SIZE + TILE_SIZE / 2;
      const y = row * TILE_SIZE + TILE_SIZE / 2;
      if (collidable) {
        this.furnitureGroup.create(x, y, texture);
      } else {
        this.add.image(x, y, texture);
      }
    }
  }

  // ─── Player ──────────────────────────────────────────────────────────────────

  private createPlayer() {
    const spawnX = 5 * TILE_SIZE;
    const spawnY = 9 * TILE_SIZE;

    this.player = this.physics.add.sprite(spawnX, spawnY, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Name tag that follows the player
    this.playerNameTag = this.add
      .text(spawnX, spawnY - 24, "You", {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
        backgroundColor: "#6366f1cc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11);
  }

  private updateNameTagPosition() {
    if (!this.player || !this.playerNameTag) return;
    this.playerNameTag.setPosition(this.player.x, this.player.y - 24);
  }

  // ─── Camera ──────────────────────────────────────────────────────────────────

  private setupCamera(worldWidth: number, worldHeight: number) {
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private handleMovement() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    let vx = 0;
    let vy = 0;

    if (left) vx = -PLAYER_SPEED;
    else if (right) vx = PLAYER_SPEED;

    if (up) vy = -PLAYER_SPEED;
    else if (down) vy = PLAYER_SPEED;

    // Normalize diagonal movement so you don't move faster diagonally
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    body.setVelocity(vx, vy);

    const moved = vx !== 0 || vy !== 0;
    if (moved) {
      this.onPositionChange?.(this.player.x, this.player.y);
    }
  }

  // ─── Collisions ──────────────────────────────────────────────────────────────

  private setupCollisions() {
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.furnitureGroup);
  }

  // ─── Multiplayer API (called from React/Socket in Phase 3) ───────────────────

  /** Adds or updates a remote player sprite on the map */
  upsertRemotePlayer(data: PlayerData) {
    if (this.otherPlayers.has(data.id)) {
      const { sprite, label } = this.otherPlayers.get(data.id)!;
      sprite.setPosition(data.x, data.y);
      label.setPosition(data.x, data.y - 24);
    } else {
      const sprite = this.physics.add.sprite(data.x, data.y, "other-player");
      sprite.setDepth(10);
      const label = this.add
        .text(data.x, data.y - 24, data.name, {
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

  /** Removes a remote player (they disconnected) */
  removeRemotePlayer(id: string) {
    const entry = this.otherPlayers.get(id);
    if (entry) {
      entry.sprite.destroy();
      entry.label.destroy();
      this.otherPlayers.delete(id);
    }
  }

  /** Returns local player position (used to send to server) */
  getPlayerPosition() {
    return { x: this.player.x, y: this.player.y };
  }
}
