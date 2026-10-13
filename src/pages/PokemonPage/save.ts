import { NEW_GAME } from "./constants";
import { MAX_TEAM, STARTING_ITEMS } from "./items";
import { SPECIES } from "./data/species";
import { MAPS, isBlocked } from "./maps";
import { MAX_LEVEL, expForLevel, memberMaxHp } from "./monsters";
import type { Dir, Inventory, PartyMember, Respawn, SaveData } from "./types";

const KEY = "pocket-quest-save-v1";
const DIRS: Dir[] = ["up", "down", "left", "right"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function cleanMember(v: unknown): PartyMember | null {
  if (!isObj(v)) return null;
  const { speciesId, level, exp, hp } = v;
  if (typeof speciesId !== "string" || !SPECIES[speciesId]) return null;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return null;
  if (typeof exp !== "number" || typeof hp !== "number") return null;
  const m: PartyMember = {
    speciesId,
    level,
    exp: Math.max(exp, expForLevel(level)),
    hp: 0,
  };
  const max = memberMaxHp(m);
  m.hp = hp > 0 ? Math.min(Math.round(hp), max) : max;
  return m;
}

/** Missing or invalid counts fall back to the starting items (older saves have no inventory). */
function cleanInventory(v: unknown): Inventory {
  const o = isObj(v) ? v : {};
  const n = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isInteger(x) && x >= 0 ? Math.min(x, 99) : fallback;
  return { ball: n(o.ball, STARTING_ITEMS.ball), potion: n(o.potion, STARTING_ITEMS.potion) };
}

const validSpot = (mapId: unknown, x: unknown, y: unknown) =>
  typeof mapId === "string" &&
  !!MAPS[mapId] &&
  typeof x === "number" &&
  typeof y === "number" &&
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < MAPS[mapId].rows[0].length &&
  y < MAPS[mapId].rows.length &&
  !isBlocked(MAPS[mapId], x, y);

const DEFAULT_RESPAWN: Respawn = { mapId: NEW_GAME.mapId, x: NEW_GAME.x, y: NEW_GAME.y };

/** Reads and validates the save; returns null if missing or corrupted. */
export function loadSave(): SaveData | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (!isObj(d) || d.version !== 1) return null;
    if (!validSpot(d.mapId, d.x, d.y)) return null;
    if (!Array.isArray(d.team)) return null;
    const team = d.team
      .map(cleanMember)
      .filter((m): m is PartyMember => m !== null)
      .slice(0, MAX_TEAM);
    if (team.length === 0) return null;

    const r = d.respawn;
    const respawn: Respawn =
      isObj(r) && validSpot(r.mapId, r.x, r.y)
        ? {
            mapId: r.mapId as string,
            x: r.x as number,
            y: r.y as number,
            ...(DIRS.includes(r.dir as Dir) ? { dir: r.dir as Dir } : {}),
          }
        : DEFAULT_RESPAWN;

    return {
      version: 1,
      mapId: d.mapId as string,
      x: d.x as number,
      y: d.y as number,
      dir: DIRS.includes(d.dir as Dir) ? (d.dir as Dir) : "down",
      team,
      inventory: cleanInventory(d.inventory),
      badges: Array.isArray(d.badges) ? d.badges.filter((b): b is string => typeof b === "string") : [],
      defeated: Array.isArray(d.defeated) ? d.defeated.filter((b): b is string => typeof b === "string") : [],
      respawn,
    };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: the game still works, it just won't be saved */
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}