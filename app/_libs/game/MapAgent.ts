import * as Phaser from "phaser";

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

const AGENT_SPEED   = 60;   // pixels per second — slow & casual
const MEETING_ARRIVED_DIST = 8;
const MEETING_LERP_FACTOR = 0.014;
const MEETING_WANDER_RADIUS = 20;
const MEETING_WANDER_INTERVAL_MS_MIN = 1800;
const MEETING_WANDER_INTERVAL_MS_MAX = 3200;
const MEETING_WANDER_LERP = 0.006;
const DIRECTION_DEADZONE = 4;
const FRAME_RATE  = 8;    // animation fps
const SCALE       = 2.5;  // 16px × 2.5 = 40px visible — fits nicely with 48px tiles

const BUBBLE_MAX_LINES = 6;
const BUBBLE_LINE_HEIGHT = 12;
const BUBBLE_PADDING = 6;
const BUBBLE_PADDING_BOTTOM = 12;
const BUBBLE_WIDTH = 140;
const BUBBLE_DISMISS_MS = 10000;
const BUBBLE_TAIL_WIDTH = 14;
const BUBBLE_TAIL_HEIGHT = 10;
const BUBBLE_MAX_CHARS = 115;

/** Truncate to fit bubble (char limit + ellipsis) so word-wrap stays within ~6 lines. */
function truncateToLines(text: string): string {
  if (!text?.trim()) return "";
  const trimmed = text.trim();
  if (trimmed.length <= BUBBLE_MAX_CHARS) return trimmed;
  const cut = trimmed.slice(0, BUBBLE_MAX_CHARS - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "...";
}

// How long (ms) an agent stays in each state before switching
const MIN_WALK_MS = 1000;
const MAX_WALK_MS = 3000;
const MIN_IDLE_MS = 500;
const MAX_IDLE_MS = 2000;

type AgentState = "walking" | "idle";

export type MapAgentConfig = {
  textureKey: string;  // e.g. "npc-adam"
  name: string;
  x: number;
  y: number;
  bounds: { x1: number; y1: number; x2: number; y2: number };
};

export class MapAgent {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private label: Phaser.GameObjects.Text;
  private bubbleBg: Phaser.GameObjects.Graphics | null = null;
  private bubbleMask: Phaser.GameObjects.Graphics | null = null;
  private bubbleText: Phaser.GameObjects.Text | null = null;
  private bubbleDismissCountdownMs = 0;
  private lastDismissedText = "";

  private state: AgentState = "idle";
  private direction: Direction = "down";
  private stateTimer = 0;   // counts down in ms
  private scene: Phaser.Scene;
  private bounds: MapAgentConfig["bounds"];
  readonly name: string;
  private homeX: number;
  private homeY: number;
  private meetingTarget: { x: number; y: number } | null = null;
  private meetingCenter: { x: number; y: number } | null = null;
  private meetingRadius: number | null = null;
  private meetingWanderOffset = { x: 0, y: 0 };
  private meetingWanderTimer = 0;
  private meetingArrived = false;

  constructor(scene: Phaser.Scene, config: MapAgentConfig) {
    this.scene = scene;
    this.bounds = config.bounds;
    this.name = config.name;
    this.homeX = config.x;
    this.homeY = config.y;

    // ── Sprite ─────────────────────────────────────────────────────────────
    this.sprite = scene.physics.add.sprite(config.x, config.y, config.textureKey);
    this.sprite.setScale(SCALE);
    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    // Shrink physics body so agent slides past thin gaps
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
    MapAgent.registerAnims(scene, config.textureKey);

    // Start with a random idle duration so all 4 agents don't sync up
    this.stateTimer = Phaser.Math.Between(0, MAX_IDLE_MS);
    this.playIdle();
  }

  /** When true, agent moves to meeting target and wanders within radius; when false, returns to normal wander. */
  setMeetingTarget(x: number | null, y?: number, centerX?: number, centerY?: number, radius?: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (x === null) {
      this.meetingTarget = null;
      this.meetingCenter = null;
      this.meetingRadius = null;
      this.meetingWanderOffset = { x: 0, y: 0 };
      this.meetingWanderTimer = 0;
      this.meetingArrived = false;
      body.reset(this.sprite.x, this.sprite.y);
      body.setEnable(true);
      this.startIdle();
      return;
    }
    this.meetingTarget = { x, y: y ?? this.sprite.y };
    this.meetingCenter =
      centerX != null && centerY != null ? { x: centerX, y: centerY } : null;
    this.meetingRadius = radius ?? null;
    this.meetingWanderOffset = { x: 0, y: 0 };
    this.meetingArrived = false;
    this.meetingWanderTimer = Phaser.Math.Between(0, MEETING_WANDER_INTERVAL_MS_MAX);
    body.setEnable(false);
  }

  /** Set bubble chat text above the character; max 6 lines then "...". Empty string hides bubble. Auto-dismiss after 10s. */
  setBubbleText(text: string) {
    const display = truncateToLines(text);
    if (!display) {
      this.clearBubble();
      this.lastDismissedText = "";
      return;
    }
    if (!this.bubbleText && display === this.lastDismissedText) return;
    if (!this.bubbleText) {
      this.bubbleBg = this.scene.add.graphics().setDepth(100);
      this.bubbleMask = this.scene.add.graphics();
      this.bubbleText = this.scene.add
        .text(0, 0, display, {
          fontSize: "10px",
          color: "#1a1a1a",
          fontFamily: "monospace",
          wordWrap: { width: BUBBLE_WIDTH - BUBBLE_PADDING * 2 },
          align: "left",
        })
        .setOrigin(0, 0)
        .setDepth(101);
      this.bubbleText.setMask(this.bubbleMask.createGeometryMask());
      this.bubbleDismissCountdownMs = BUBBLE_DISMISS_MS;
    } else {
      if (this.bubbleText.text !== display) {
        this.bubbleText.setText(display);
      }
      this.bubbleDismissCountdownMs = BUBBLE_DISMISS_MS;
    }
    this.syncBubblePosition();
  }

  private clearBubble() {
    if (this.bubbleBg) {
      this.bubbleBg.destroy();
      this.bubbleBg = null;
    }
    if (this.bubbleMask) {
      this.bubbleMask.destroy();
      this.bubbleMask = null;
    }
    if (this.bubbleText) {
      this.lastDismissedText = this.bubbleText.text;
      this.bubbleText.destroy();
      this.bubbleText = null;
    }
    this.bubbleDismissCountdownMs = 0;
  }

  private syncBubblePosition() {
    const bg = this.bubbleBg;
    const mask = this.bubbleMask;
    const bt = this.bubbleText;
    if (!bg || !bt) return;
    const w = BUBBLE_WIDTH;
    const h =
      BUBBLE_MAX_LINES * BUBBLE_LINE_HEIGHT +
      BUBBLE_PADDING +
      BUBBLE_PADDING_BOTTOM;
    const x = this.sprite.x;
    const bubbleBottom = this.sprite.y - 28 - 14;
    const top = bubbleBottom - h;
    const left = x - w / 2;
    const tailTop = bubbleBottom;
    const tailLeft = x - BUBBLE_TAIL_WIDTH / 2;
    const tailRight = x + BUBBLE_TAIL_WIDTH / 2;
    const tailTip = tailTop + BUBBLE_TAIL_HEIGHT;

    bg.clear();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(left, top, w, h, 4);
    bg.fillTriangle(tailLeft, tailTop, tailRight, tailTop, x, tailTip);
    bg.lineStyle(1, 0xcccccc, 0.8);
    bg.strokeRoundedRect(left, top, w, h, 4);
    bg.lineBetween(tailLeft, tailTop, x, tailTip);
    bg.lineBetween(x, tailTip, tailRight, tailTop);

    if (mask) {
      mask.clear();
      mask.fillStyle(0xffffff, 1);
      mask.fillRoundedRect(left, top, w, h, 4);
      mask.fillTriangle(tailLeft, tailTop, tailRight, tailTop, x, tailTip);
    }

    bt.setPosition(left + BUBBLE_PADDING, top + BUBBLE_PADDING);
  }

  // ─── Called every frame from GameScene.update() ──────────────────────────

  update(delta: number) {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.meetingTarget) {
      body.setVelocity(0, 0);
      body.setEnable(false);
      const dx = this.meetingTarget.x - this.sprite.x;
      const dy = this.meetingTarget.y - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!this.meetingArrived && dist <= MEETING_ARRIVED_DIST) this.meetingArrived = true;
      if (this.meetingArrived) {
        this.meetingWanderTimer -= delta;
        if (this.meetingWanderTimer <= 0) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const r = Phaser.Math.FloatBetween(0, MEETING_WANDER_RADIUS);
          this.meetingWanderOffset.x = Math.cos(angle) * r;
          this.meetingWanderOffset.y = Math.sin(angle) * r;
          this.meetingWanderTimer = Phaser.Math.Between(
            MEETING_WANDER_INTERVAL_MS_MIN,
            MEETING_WANDER_INTERVAL_MS_MAX,
          );
        }
        let wx = this.meetingTarget.x + this.meetingWanderOffset.x;
        let wy = this.meetingTarget.y + this.meetingWanderOffset.y;
        if (this.meetingCenter && this.meetingRadius != null) {
          const cdx = wx - this.meetingCenter.x;
          const cdy = wy - this.meetingCenter.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist > this.meetingRadius) {
            const scale = this.meetingRadius / cdist;
            wx = this.meetingCenter.x + cdx * scale;
            wy = this.meetingCenter.y + cdy * scale;
          }
        }
        const wdx = wx - this.sprite.x;
        const wdy = wy - this.sprite.y;
        const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wdist > 0.5) {
          const factor = 1 - Math.exp(-delta * MEETING_WANDER_LERP);
          this.sprite.x += wdx * factor;
          this.sprite.y += wdy * factor;
          if (wdist > DIRECTION_DEADZONE) {
            if (Math.abs(wdy) >= Math.abs(wdx)) this.direction = wdy > 0 ? "down" : "up";
            else this.direction = wdx > 0 ? "right" : "left";
          }
          this.sprite.play(
            `${this.sprite.texture.key}-walk-${this.direction}`,
            true,
          );
        } else if (this.meetingCenter) {
          const cx = this.meetingCenter.x - this.sprite.x;
          const cy = this.meetingCenter.y - this.sprite.y;
          if (Math.abs(cx) > DIRECTION_DEADZONE || Math.abs(cy) > DIRECTION_DEADZONE) {
            if (Math.abs(cy) >= Math.abs(cx)) this.direction = cy > 0 ? "down" : "up";
            else this.direction = cx > 0 ? "right" : "left";
          }
          this.playIdle();
        } else {
          this.playIdle();
        }
      } else {
        const factor = 1 - Math.exp(-delta * MEETING_LERP_FACTOR);
        this.sprite.x += dx * factor;
        this.sprite.y += dy * factor;
        if (dist > DIRECTION_DEADZONE) {
          if (Math.abs(dy) >= Math.abs(dx)) this.direction = dy > 0 ? "down" : "up";
          else this.direction = dx > 0 ? "right" : "left";
        }
        this.sprite.play(
          `${this.sprite.texture.key}-walk-${this.direction}`,
          true,
        );
      }
      this.label.setPosition(this.sprite.x, this.sprite.y - 28);
      if (this.bubbleBg && this.bubbleText) {
        if (this.bubbleDismissCountdownMs > 0) {
          this.bubbleDismissCountdownMs -= delta;
          if (this.bubbleDismissCountdownMs <= 0) this.clearBubble();
          else this.syncBubblePosition();
        } else {
          this.syncBubblePosition();
        }
      }
      return;
    }

    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      if (this.state === "idle") this.startWalking();
      else this.startIdle();
    }

    this.label.setPosition(this.sprite.x, this.sprite.y - 28);

    if (this.bubbleBg && this.bubbleText) {
      if (this.bubbleDismissCountdownMs > 0) {
        this.bubbleDismissCountdownMs -= delta;
        if (this.bubbleDismissCountdownMs <= 0) this.clearBubble();
        else this.syncBubblePosition();
      } else {
        this.syncBubblePosition();
      }
    }

    if (this.state === "walking") {
      const blocked =
        body.blocked.left ||
        body.blocked.right ||
        body.blocked.up ||
        body.blocked.down;
      if (blocked) this.startWalkingAfterBlock();
      this.clampToBounds();
    }
  }

  destroy() {
    this.bubbleBg?.destroy();
    this.bubbleMask?.destroy();
    this.bubbleText?.destroy();
    this.sprite.destroy();
    this.label.destroy();
  }

  // ─── State transitions ────────────────────────────────────────────────────

  private startWalking() {
    this.state = "walking";
    this.stateTimer = Phaser.Math.Between(MIN_WALK_MS, MAX_WALK_MS);
    this.pickDirectionAndVelocity(null);
  }

  /** When blocked, pick a new direction that is not the opposite (avoids 180° spin). */
  private startWalkingAfterBlock() {
    this.state = "walking";
    this.stateTimer = Phaser.Math.Between(MIN_WALK_MS, MAX_WALK_MS);
    const opposite: Direction | null =
      this.direction === "down" ? "up" :
      this.direction === "up" ? "down" :
      this.direction === "left" ? "right" :
      this.direction === "right" ? "left" : null;
    this.pickDirectionAndVelocity(opposite);
  }

  private pickDirectionAndVelocity(avoidDirection: Direction | null) {
    const choices = avoidDirection
      ? DIRECTIONS.filter((d) => d !== avoidDirection)
      : DIRECTIONS;
    this.direction = choices[Phaser.Math.Between(0, choices.length - 1)];

    const vel = AGENT_SPEED;
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
    if (MapAgent.registeredKeys.has(textureKey)) return;
    MapAgent.registeredKeys.add(textureKey);

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
