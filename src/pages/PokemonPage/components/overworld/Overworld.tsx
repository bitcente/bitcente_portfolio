import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { DELTA, PAL, STEP_TIME, TILE } from "../../constants";
import { useSprites } from "../../hooks/useSprites";
import { isBlocked, mapHeight, mapWidth, tileAt } from "../../maps";
import type { Btn, Dir, GameMap, PlayerState, Walker } from "../../types";
import { drawAlert, drawNpc, drawPlayer, drawTile } from "./Drawing";
import { trainerDir } from "../../maps";
import { drawNpcSprite, drawPlayerSprite, drawTileSprite } from "./spriteDrawing";

interface Props {
  /** The player can walk. */
  active: boolean;
  /** Keep repainting even when the player can't walk (trainers walking up to you). */
  animating: boolean;
  /** Characters moved by a cutscene, by id. They replace the position in the map data. */
  walkers: MutableRefObject<Record<string, Walker>>;
  /** Logical size of the screen in game pixels (changes with the window). */
  viewW: number;
  viewH: number;
  map: GameMap;
  player: MutableRefObject<PlayerState>;
  held: MutableRefObject<Set<Btn>>;
  /**
   * Called every time the player finishes a step. Return true if something
   * happened (warp, battle, dialog...): the loop stops and restarts when the
   * parent changes the `map` / `active` props.
   */
  onStepEnd: (x: number, y: number) => boolean;
}

/** Camera follows the player; if the view is bigger than the map it is centered. */
const cameraAxis = (pos: number, view: number, map: number) =>
  map <= view
    ? Math.round((map - view) / 2)
    : Math.round(Math.min(Math.max(pos + TILE / 2 - view / 2, 0), map - view));

/** Tile map canvas. Game loop runs only while `active` is true. */
export function Overworld({
  active,
  animating,
  walkers,
  viewW,
  viewH,
  map,
  player,
  held,
  onStepEnd,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprites = useSprites(); // user sprites (null -> built-in pixel art)

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const mapPxW = mapWidth(map) * TILE;
    const mapPxH = mapHeight(map) * TILE;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const p = player.current;
      const k = p.moving ? p.progress : 0;
      const px = (p.x + (p.tx - p.x) * k) * TILE;
      const py = (p.y + (p.ty - p.y) * k) * TILE;
      const camX = cameraAxis(px, viewW, mapPxW);
      const camY = cameraAxis(py, viewH, mapPxH);
      const frame = Math.floor(now / 450);

      ctx.fillStyle = PAL[0];
      ctx.fillRect(0, 0, viewW, viewH);
      // Tiles outside the map use map.outside (trees by default).
      for (let ty = Math.floor(camY / TILE); ty <= Math.ceil((camY + viewH) / TILE); ty++) {
        for (let tx = Math.floor(camX / TILE); tx <= Math.ceil((camX + viewW) / TILE); tx++) {
          const ch = tileAt(map, tx, ty);
          const sx = tx * TILE - camX;
          const sy = ty * TILE - camY;
          const drawn =
            sprites.tileset && drawTileSprite(ctx, sprites.tileset, ch, sx, sy, tx, ty, frame);
          if (!drawn) drawTile(ctx, ch, sx, sy, tx, ty, frame);
        }
      }

      for (const t of map.trainers ?? []) {
        const w = walkers.current[t.id];
        const tx = w ? w.x : t.x;
        const ty = w ? w.y : t.y;
        const sx = Math.round(tx * TILE) - camX;
        const sy = Math.round(ty * TILE) - camY;
        const dir = w ? w.dir : trainerDir(t);
        const sheet = sprites.npcs[t.sprite ?? "trainer"] ?? sprites.npcs.trainer;
        if (sheet) drawNpcSprite(ctx, sheet, sx, sy, dir, w?.moving, w?.progress, w?.parity);
        else drawNpc(ctx, sx, sy, dir, "trainer", w?.stride ?? 0);
        if (w?.alert) drawAlert(ctx, sx, sy - (sheet ? 8 : 2));
      }
      for (const n of map.npcs ?? []) {
        const sx = n.x * TILE - camX;
        const sy = n.y * TILE - camY;
        const sheet = sprites.npcs[n.sprite ?? n.kind] ?? sprites.npcs[n.kind];
        if (sheet) drawNpcSprite(ctx, sheet, sx, sy, n.dir);
        else drawNpc(ctx, sx, sy, n.dir, n.kind);
      }

      const stride = p.moving ? (Math.floor(p.progress * 2) + p.parity) % 2 : 0;
      const footX = Math.round(p.x + (p.tx - p.x) * (k > 0.5 ? 1 : 0));
      const footY = Math.round(p.y + (p.ty - p.y) * (k > 0.5 ? 1 : 0));
      const inGrass = tileAt(map, footX, footY) === "G";
      const dx = Math.round(px) - camX;
      const dy = Math.round(py) - camY;
      if (sprites.player) {
        drawPlayerSprite(ctx, sprites, dx, dy, p.dir, p.moving, p.progress, p.parity, inGrass);
      } else {
        drawPlayer(ctx, dx, dy - 2, p.dir, stride, inGrass);
      }
    };

    // Not active: just paint one frame (title screen, transition, dialogs).
    if (!active && !animating) {
      draw(performance.now());
      return;
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = player.current;

      if (!active) {
        // cutscene: only repaint, the player can't move
        draw(now);
        raf = requestAnimationFrame(frame);
        return;
      }

      if (p.moving) {
        p.progress += dt / STEP_TIME;
        if (p.progress >= 1) {
          p.x = p.tx;
          p.y = p.ty;
          p.moving = false;
          p.progress = 0;
          p.parity ^= 1;
          // paint the arrival frame first: onStepEnd may teleport the player
          draw(now);
          if (onStepEnd(p.x, p.y)) return;
        }
      }

      if (!p.moving) {
        const h = held.current;
        const dir: Dir | null = h.has("up")
          ? "up"
          : h.has("down")
          ? "down"
          : h.has("left")
          ? "left"
          : h.has("right")
          ? "right"
          : null;
        if (dir) {
          p.dir = dir;
          const [dx, dy] = DELTA[dir];
          if (!isBlocked(map, p.x + dx, p.y + dy)) {
            p.tx = p.x + dx;
            p.ty = p.y + dy;
            p.moving = true;
            p.progress = 0;
          }
        }
      }

      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, animating, walkers, viewW, viewH, map, sprites, player, held, onStepEnd]);

  return (
    <canvas
      ref={ref}
      width={viewW}
      height={viewH}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}