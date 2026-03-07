import * as Phaser from "phaser";

const MAP_URL = "/assets/ClawCartel_Map.tmj";
const ASSETS_BASE = "/assets/";
/** TSX files live in this folder; map sometimes has source without it (e.g. "Diamond-Tile-C.tsx"). URL-safe names (no spaces/commas). */
const TSX_FOLDER = "Claw-Cartel/";

function resolveTsxPath(source: string): string {
  if (source.startsWith(TSX_FOLDER)) return source;
  return TSX_FOLDER + source;
}

/** Image paths: avoid double "Claw Cartel/"; assets live at Claw Cartel/LPC-main/... */
function resolveImagePath(imageSource: string): string {
  if (imageSource.startsWith(TSX_FOLDER)) return imageSource;
  return TSX_FOLDER + imageSource;
}

interface ParsedTsx {
  name: string;
  imageSource: string;
  tilewidth: number;
  tileheight: number;
  columns: number;
  imagewidth: number;
  imageheight: number;
}

function parseTsxFull(xmlText: string): ParsedTsx | null {
  const name = xmlText.match(/<tileset[^>]+name="([^"]+)"/)?.[1];
  const imageSource = xmlText.match(/<image[^>]+source="([^"]+)"/)?.[1];
  const tilewidth = parseInt(xmlText.match(/<tileset[^>]+tilewidth="(\d+)"/)?.[1] ?? "32", 10);
  const tileheight = parseInt(xmlText.match(/<tileset[^>]+tileheight="(\d+)"/)?.[1] ?? "32", 10);
  const columns = parseInt(xmlText.match(/<tileset[^>]+columns="(\d+)"/)?.[1] ?? "0", 10);
  const imagewidth = parseInt(xmlText.match(/<image[^>]+width="(\d+)"/)?.[1] ?? "0", 10);
  const imageheight = parseInt(xmlText.match(/<image[^>]+height="(\d+)"/)?.[1] ?? "0", 10);
  if (!name || !imageSource) return null;
  return { name, imageSource, tilewidth, tileheight, columns, imagewidth, imageheight };
}

export class PreloadScene extends Phaser.Scene {
  /** Tileset names in same order as map's tilesets (for addTilesetImage). */
  private tilesetNames: string[] = [];
  /** Revoke in create() so we don't revoke before the loader finishes using the blob. */
  private mapBlobUrl: string | null = null;

  constructor() {
    super({ key: "PreloadScene" });
  }

  init() {
    this.cameras.main.setBackgroundColor(0x18181b);
    this.createLoadingBar();
  }

  preload() {

    // Load map JSON first to get external tileset sources (TSX paths)
    this.load.json("map-manifest", MAP_URL);
    this.load.on(
      "filecomplete-json-map-manifest",
      (_key: string, _type: string, data: { tilesets?: Array<{ name?: string; image?: string; source?: string }> }) => {
        const tilesets = data.tilesets ?? [];
        const withSource = tilesets.filter((ts) => ts.source);
        if (withSource.length === 0) {
          // Embedded tilesets: preload images and the map
          for (const ts of tilesets) {
            if (ts.image && ts.name) this.load.image(ts.name, ASSETS_BASE + ts.image);
          }
          this.load.tilemapTiledJSON("map", MAP_URL);
          return;
        }
        // External TSX: load each TSX as text; when all done, parse and queue images + map
        this.tilesetNames = [];
        let tsxDone = 0;
        const expectedTsx = withSource.length;
        const onceAllTsx = () => {
          tsxDone++;
          if (tsxDone >= expectedTsx) this.parseTsxAndQueueImages(data);
        };
        this.load.on("filecomplete", (key: string) => {
          if (key.startsWith("tsx-")) onceAllTsx();
        });
        withSource.forEach((_ts, i) => {
          const path = resolveTsxPath(withSource[i].source ?? "");
          this.load.text(`tsx-${i}`, ASSETS_BASE + path);
        });
      }
    );

    // ── Player — Bob spritesheet ─────────────────────────────────────────────
    this.load.spritesheet("player", "/assets/Bob_run_16x16.png", {
      frameWidth: 16,
      frameHeight: 32,
    });

    // ── Agent character spritesheets ────────────────────────────────────────
    const agentChars = ["Adam", "Alex", "Amelia", "Bob"];
    for (const name of agentChars) {
      this.load.spritesheet(`npc-${name.toLowerCase()}`, `/assets/${name}_run_16x16.png`, {
        frameWidth: 16,
        frameHeight: 32,
      });
    }

    this.generateRemotePlayerTexture();
  }

  create() {
    if (this.mapBlobUrl) {
      URL.revokeObjectURL(this.mapBlobUrl);
      this.mapBlobUrl = null;
    }
    this.registry.set("tilesetNames", this.tilesetNames);
    this.scene.start("GameScene");
  }

  /**
   * Parse all TSX files from cache, build map JSON with embedded tilesets (Phaser does not
   * support external tilesets), then load the map from a blob URL. Tileset names are stored
   * by map index for GameScene addTilesetImage(name, name).
   */
  private parseTsxAndQueueImages(
    mapData: {
      tilesets?: Array<{ firstgid?: number; source?: string; name?: string; image?: string }>;
      [k: string]: unknown;
    }
  ) {
    const tilesets = mapData.tilesets ?? [];
    const withSource = tilesets.filter((ts) => ts.source);
    const fullIndices = tilesets.map((t, i) => (t.source ? i : -1)).filter((i) => i >= 0);

    this.tilesetNames = new Array(tilesets.length);
    const parsedByIndex: (ParsedTsx | null)[] = [];
    for (let j = 0; j < withSource.length; j++) {
      const text = this.cache.text.get(`tsx-${j}`);
      const parsed = text ? parseTsxFull(text) : null;
      parsedByIndex.push(parsed ?? null);
      if (parsed) {
        const fullIndex = fullIndices[j];
        this.tilesetNames[fullIndex] = parsed.name;
        // Preload each tileset image with key = name so GameScene has textures when it runs.
        // (Phaser's tilemap loader may add these from the embedded map too; same key = cache hit.)
        const imagePath = resolveImagePath(parsed.imageSource);
        this.load.image(parsed.name, ASSETS_BASE + imagePath);
      }
    }

    // Build map JSON with embedded tilesets so Phaser never sees external "source"
    const embedded = JSON.parse(JSON.stringify(mapData)) as typeof mapData;
    const embTilesets = embedded.tilesets ?? [];
    let tsxIdx = 0;
    for (let i = 0; i < embTilesets.length; i++) {
      const ts = embTilesets[i];
      if (!ts.source) continue;
      const parsed = parsedByIndex[tsxIdx++];
      if (!parsed) continue;
      const imagePath = resolveImagePath(parsed.imageSource);
      (ts as Record<string, unknown>).name = parsed.name;
      (ts as Record<string, unknown>).image = ASSETS_BASE + imagePath;
      (ts as Record<string, unknown>).imagewidth = parsed.imagewidth;
      (ts as Record<string, unknown>).imageheight = parsed.imageheight;
      (ts as Record<string, unknown>).tilewidth = parsed.tilewidth;
      (ts as Record<string, unknown>).tileheight = parsed.tileheight;
      (ts as Record<string, unknown>).columns = parsed.columns;
      delete (ts as Record<string, unknown>).source;
    }

    const blob = new Blob([JSON.stringify(embedded)], { type: "application/json" });
    this.mapBlobUrl = URL.createObjectURL(blob);
    this.load.tilemapTiledJSON("map", this.mapBlobUrl);
  }

  private createLoadingBar() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.add
      .text(cx, cy - 40, "Loading world...", {
        fontSize: "16px",
        color: "#e4e4e7",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add.rectangle(cx, cy, 300, 16, 0x27272a);
    const bar = this.add.rectangle(cx - 150, cy, 0, 12, 0xffbc8d);
    bar.setOrigin(0, 0.5);

    this.load.on("progress", (v: number) => { bar.width = 300 * v; });
  }

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
