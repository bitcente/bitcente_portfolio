import { TILE } from "../../constants";
import { NPC_LAYOUT, PLAYER_SPRITE, TILESET } from "../../sprites";
import type { LoadedSprites, SheetLayout } from "../../sprites";
import type { Dir } from "../../types";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Draws a tile from the tileset. Returns false if `ch` has no sprite (use the fallback). */
export function drawTileSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  ch: string,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  frame: number
): boolean {
  const def = TILESET.tiles[ch];
  if (!def || def.frames.length === 0) return false;
  const n = def.frames.length;
  const index = def.animated
    ? def.frames[mod(frame, n)]
    : def.frames[mod(tx * 7 + ty * 13, n)];
  const { tileSize, columns } = TILESET;
  ctx.drawImage(
    img,
    (index % columns) * tileSize,
    Math.floor(index / columns) * tileSize,
    tileSize,
    tileSize,
    sx,
    sy,
    TILE,
    TILE
  );
  return true;
}

/**
 * Draws one character from a sprite sheet (the player or an NPC): picks the
 * row of the direction (mirroring the left row for "right") and the column
 * of the walk cycle: idle, then step A / step B (alternating per tile) for
 * the first part of each tile, then idle again.
 */
export function drawSheetSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layout: SheetLayout,
  x: number,
  y: number,
  dir: Dir,
  moving: boolean,
  /** 0..1 progress of the current step */
  progress: number,
  /** flips every step: decides whether this tile uses step frame A or B */
  parity: number
) {
  const { frameW, frameH, offsetX, offsetY, rows, idleFrame, walkFrames, stepFraction } = layout;

  // Use the row of this direction, or mirror the left row for "right".
  let row = rows[dir];
  let flip = false;
  if (row === undefined && dir === "right") {
    row = rows.left;
    flip = true;
  }
  row ??= rows.down ?? 0;

  const col =
    moving && progress < stepFraction ? walkFrames[parity % walkFrames.length] : idleFrame;
  const dx = x + offsetX;
  const dy = y + offsetY;

  if (flip) {
    ctx.save();
    ctx.translate(dx + frameW, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, col * frameW, row * frameH, frameW, frameH, 0, 0, frameW, frameH);
    ctx.restore();
  } else {
    ctx.drawImage(img, col * frameW, row * frameH, frameW, frameH, dx, dy, frameW, frameH);
  }
}

/** Draws an NPC / trainer from its sprite sheet. */
export function drawNpcSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  dir: Dir,
  moving = false,
  progress = 0,
  parity = 0
) {
  drawSheetSprite(ctx, img, NPC_LAYOUT, x, y, dir, moving, progress, parity);
}

/** Draws the player from the sprite sheet, plus the tall grass over the feet. */
export function drawPlayerSprite(
  ctx: CanvasRenderingContext2D,
  sprites: LoadedSprites,
  x: number,
  y: number,
  dir: Dir,
  moving: boolean,
  progress: number,
  parity: number,
  inGrass: boolean
) {
  drawSheetSprite(ctx, sprites.player!, PLAYER_SPRITE, x, y, dir, moving, progress, parity);

  // Tall grass covers the feet
  const h = TILESET.grassOverlayHeight;
  const grass = TILESET.tiles["G"];
  if (inGrass && h > 0 && grass && sprites.tileset) {
    const { tileSize, columns } = TILESET;
    const index = grass.frames[0];
    const k = tileSize / TILE;
    ctx.drawImage(
      sprites.tileset,
      (index % columns) * tileSize,
      Math.floor(index / columns) * tileSize + tileSize - h * k,
      tileSize,
      h * k,
      x,
      y + TILE - h,
      TILE,
      h
    );
  }
}