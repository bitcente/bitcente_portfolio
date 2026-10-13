import { DELTA } from "../constants";
import type { Dir, GameMap, Npc, Pos, Trainer, Warp } from "../types";
import { MAP_LIST } from "./data";

export const MAPS: Record<string, GameMap> = Object.fromEntries(MAP_LIST.map((m) => [m.id, m]));

/** Tiles you cannot walk through. */
export const SOLID_TILES = new Set(["T", "W", "R", "H", "d", "Q", "E", "w", "k", "n"]);

export const mapWidth = (m: GameMap) => m.rows[0].length;
export const mapHeight = (m: GameMap) => m.rows.length;

/** Tile at (x, y); outside the map it is `map.outside` (trees by default). */
export const tileAt = (m: GameMap, x: number, y: number) => m.rows[y]?.[x] ?? m.outside ?? "T";

export const npcAt = (m: GameMap, x: number, y: number): Npc | undefined =>
  m.npcs?.find((n) => n.x === x && n.y === y);

export const isBlocked = (m: GameMap, x: number, y: number) =>
  SOLID_TILES.has(tileAt(m, x, y)) ||
  !!m.trainers?.some((t) => t.x === x && t.y === y) ||
  !!npcAt(m, x, y);

/** The character you would talk to standing at (x, y) facing `dir`, if any. */
export const npcToTalk = (m: GameMap, x: number, y: number, dir: Dir): Npc | undefined => {
  const [dx, dy] = DELTA[dir];
  return m.npcs?.find(
    (n) =>
      (n.x === x + dx && n.y === y + dy) ||
      n.talkFrom?.some((t) => t.x === x && t.y === y && t.dir === dir)
  );
};

export const warpAt = (m: GameMap, x: number, y: number): Warp | undefined =>
  m.warps.find((w) => w.x === x && w.y === y);

export const trainerDir = (t: Trainer): Dir => t.dir ?? "down";

/**
 * Tiles where a trainer spots you: the fixed `trigger` list, or the line of
 * `sight` tiles in front of it (cut short by the first blocked tile).
 */
export function triggerTiles(m: GameMap, t: Trainer): Pos[] {
  if (t.trigger) return t.trigger;
  const [dx, dy] = DELTA[trainerDir(t)];
  const tiles: Pos[] = [];
  for (let i = 1; i <= (t.sight ?? 4); i++) {
    const x = t.x + dx * i;
    const y = t.y + dy * i;
    if (isBlocked(m, x, y)) break;
    tiles.push({ x, y });
  }
  return tiles;
}

/** Undefeated trainer that spots you at (x, y). */
export const triggeredTrainer = (
  m: GameMap,
  x: number,
  y: number,
  defeated: string[]
): Trainer | undefined =>
  m.trainers?.find(
    (t) => !defeated.includes(t.id) && triggerTiles(m, t).some((p) => p.x === x && p.y === y)
  );