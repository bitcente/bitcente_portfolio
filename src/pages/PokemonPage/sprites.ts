/**
 * Sprite configuration. Put your PNGs in your project's `public/pokemon/` folder:
 *
 *   public/pokemon/player.png    player sprite sheet
 *   public/pokemon/tileset.png   overworld tiles (ground, grass, trees...)
 *
 * If a file is missing the game falls back to the built-in pixel art, so you
 * can replace the player and the tileset independently (even tile by tile).
 *
 * Colors: the 4-color palette filter maps each pixel by brightness, so draw
 * with 4 shades and any art will end up in the palette:
 *   #ffffff (lightest)  #aaaaaa  #555555  #000000 (darkest)
 * Transparent pixels are kept (use them for the player and for tiles on top
 * of other tiles).
 */
import { MAPS } from "./maps";
import type { Dir } from "./types";

// Works with Vite (BASE_URL is "/" unless the app is deployed under a subpath).
const url = (file: string) => `${import.meta.env.BASE_URL}pokemon/${file}`;

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */
/** How a character sprite sheet is laid out (shared by the player and the NPCs). */
export interface SheetLayout {
  frameW: number;
  frameH: number;
  offsetX: number;
  offsetY: number;
  rows: Partial<Record<Dir, number>>;
  idleFrame: number;
  walkFrames: readonly [number, number];
  stepFraction: number;
}

/**
 * Sheet layout (default, 48x66 px, frames of 16x22):
 *
 *            col 0      col 1       col 2
 *   row 0    down idle  down step A down step B
 *   row 1    up   idle  up   step A up   step B
 *   row 2    left idle  left step A left step B
 *
 * There is no row for "right": it is the "left" row mirrored. If you draw a
 * real right-facing row (row 3), add `right: 3` to `rows` below.
 *
 * Walk cycle (like the official games): every tile you walk shows a step
 * frame first (A and B alternate from tile to tile) and then the idle frame,
 * so the sprite goes idle - step A - idle - step B - idle...
 * `stepFraction` is how much of each tile the step frame is shown (0..1).
 *
 * The sprite is anchored to the bottom of its tile: a taller sprite (like
 * this 22px one) simply sticks out above the tile. offsetY = 16 - frameH.
 */
export const PLAYER_SPRITE = {
  src: url("player.png"),
  frameW: 16,
  frameH: 16,
  /** Draw offset from the tile's top-left corner (negative offsetY for sprites taller than a tile). */
  offsetX: 0,
  offsetY: -6,
  rows: { down: 0, up: 1, left: 2 } as Partial<Record<Dir, number>>,
  idleFrame: 0,
  /** Columns used for the two alternating step frames. */
  walkFrames: [1, 2] as const,
  stepFraction: 0.5,
};


/* ------------------------------------------------------------------ */
/* NPCs and trainers                                                   */
/* ------------------------------------------------------------------ */
/**
 * Every character that is not the player (nurses, villagers, trainers, the
 * gym leader) can have its own sprite sheet: public/pokemon/npc_<id>.png,
 * with the SAME layout as player.png (rows down / up / left, columns idle /
 * step A / step B, mirrored for right).
 *
 *   npc_trainer.png      every trainer     (id "trainer")
 *   npc_nurse.png        the nurses        (id "nurse")
 *   npc_villager.png     every villager    (id "villager")
 *   npc_gym_leader.png   LEADER FERRO      (set with `sprite: "gym_leader"` in maps/data.ts)
 *
 * To give one character a sprite of its own, add `sprite: "my_hero"` to its
 * entry in maps/data.ts and save public/pokemon/npc_my_hero.png. A missing
 * sheet falls back to the one of its kind, then to the built-in art.
 */
export const NPC_LAYOUT: SheetLayout = {
  frameW: 16,
  frameH: 22,
  offsetX: 0,
  offsetY: -6,
  rows: { down: 0, up: 1, left: 2 },
  idleFrame: 0,
  walkFrames: [1, 2],
  stepFraction: 0.5,
};

export const npcSheetUrl = (id: string) => url(`npc_${id}.png`);

/** Sheet ids used by the maps, so they can all be loaded at start. */
function npcSheetIds(): string[] {
  const ids = new Set<string>(["trainer", "nurse", "villager"]);
  for (const m of Object.values(MAPS)) {
    for (const t of m.trainers ?? []) ids.add(t.sprite ?? "trainer");
    for (const n of m.npcs ?? []) ids.add(n.sprite ?? n.kind);
  }
  return [...ids];
}

/* ------------------------------------------------------------------ */
/* Tileset                                                             */
/* ------------------------------------------------------------------ */
export interface TileDef {
  /**
   * Tile indices in the tileset (left to right, top to bottom, starting at 0).
   * - several indices + animated: false -> random variant per map position
   *   (repeat an index to make it more common, e.g. [0, 0, 0, 1])
   * - several indices + animated: true  -> frames of an animation
   */
  frames: number[];
  animated?: boolean;
}

/**
 * The map also uses f (flowers), R/Q/E (roofs), H (wall), d/c/y (doors),
 * i (indoor floor), w (indoor wall), k (counter), x (door mat) and n (plant). They use the built-in art until you
 * add an entry for them in `tiles` below (and draw them in your tileset).
 *
 * Default layout (128x16 px, 8 tiles in one row):
 *   0 ground   1 ground (pebble)   2 path A   3 path B
 *   4 tall grass   5 tree   6 water A   7 water B
 */
export const TILESET = {
  src: url("tileset.png"),
  tileSize: 16,
  /** Tiles per row in the image: image width / tileSize. */
  columns: 8,
  /** Map character (see map.ts) -> tile(s). Characters not listed use the built-in art. */
  tiles: {
    ".": { frames: [0, 0, 0, 1] },
    p: { frames: [2, 3] },
    G: { frames: [4] },
    T: { frames: [5] },
    W: { frames: [6, 7], animated: true },
  } as Record<string, TileDef>,
  /** Height in px of the tall-grass tile drawn over the player's feet (0 = off). */
  grassOverlayHeight: 6,
};

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */
export interface LoadedSprites {
  player: HTMLImageElement | null;
  tileset: HTMLImageElement | null;
  /** NPC sheets by id ("trainer", "nurse", "villager", "gym_leader"...). Missing files are not listed. */
  npcs: Record<string, HTMLImageElement>;
}

export const EMPTY_SPRITES: LoadedSprites = { player: null, tileset: null, npcs: {} };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // missing file -> fall back to built-in art
    img.src = src;
  });

let cache: LoadedSprites | null = null;
let pending: Promise<LoadedSprites> | null = null;

export const getCachedSprites = () => cache;

export const loadSprites = () =>
  (pending ??= (async () => {
    const ids = npcSheetIds();
    const [player, tileset, ...sheets] = await Promise.all([
      loadImage(PLAYER_SPRITE.src),
      loadImage(TILESET.src),
      ...ids.map((id) => loadImage(npcSheetUrl(id))),
    ]);
    const npcs: Record<string, HTMLImageElement> = {};
    ids.forEach((id, i) => {
      const img = sheets[i];
      if (img) npcs[id] = img;
    });
    return (cache = { player, tileset, npcs });
  })());