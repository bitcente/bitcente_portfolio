import type { MoveEffect, PokeType, Status } from "../types";

export const POKE_TYPES: PokeType[] = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

/**
 * Official effectiveness chart: attacker -> defender -> multiplier.
 * Anything not listed is 1x (normal damage).
 */
const CHART: Record<PokeType, Partial<Record<PokeType, number>>> = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** Damage multiplier of a move type against a (single or dual type) defender. */
export function typeMultiplier(move: PokeType, defender: PokeType[]): number {
  return defender.reduce((m, t) => m * (CHART[move][t] ?? 1), 1);
}

/**
 * The additional effect each type has after it hits, unless the move
 * overrides it (`effect` in data/moves.ts). Types that are not listed
 * (normal, water, flying, ground, rock, fighting, ghost, dragon) just hit.
 */
export const TYPE_EFFECTS: Partial<Record<PokeType, MoveEffect>> = {
  fire:     { status: "burn", chance: 0.2 },
  electric: { status: "paralysis", chance: 0.25 },
  ice:      { status: "freeze", chance: 0.15 },
  poison:   { status: "poison", chance: 0.3 },
  psychic:  { stat: { stat: "def", stages: -1, target: "foe" }, chance: 0.3 },
  dark:     { stat: { stat: "def", stages: -1, target: "foe" }, chance: 0.2 },
  steel:    { stat: { stat: "atk", stages: 1, target: "self" }, chance: 0.2 },
  bug:      { stat: { stat: "atk", stages: -1, target: "foe" }, chance: 0.25 },
  fairy:    { stat: { stat: "atk", stages: -1, target: "foe" }, chance: 0.2 },
  grass:    { drain: 0.25 },
};

/** Types that cannot get a status condition. */
export const STATUS_IMMUNITY: Record<Status, PokeType[]> = {
  burn: ["fire"],
  poison: ["poison", "steel"],
  paralysis: ["electric"],
  freeze: ["ice"],
};

export const STATUS_TEXT: Record<Status, string> = {
  burn: "was burned!",
  poison: "was poisoned!",
  paralysis: "is paralyzed! It may not move!",
  freeze: "was frozen solid!",
};
export const STATUS_TAG: Record<Status, string> = {
  burn: "BRN",
  poison: "PSN",
  paralysis: "PAR",
  freeze: "FRZ",
};

export const typeLabel = (t: PokeType) => t.toUpperCase();

/** Short text for the move info box, e.g. "BURN 20%". */
export function effectLabel(e: MoveEffect | undefined): string {
  if (!e) return "";
  const pct = e.chance !== undefined ? ` ${Math.round(e.chance * 100)}%` : "";
  if (e.status) return `${e.status.toUpperCase()}${pct}`;
  if (e.stat) {
    const who = e.stat.target === "self" ? "OWN" : "FOE";
    return `${who} ${e.stat.stat.toUpperCase()}${e.stat.stages > 0 ? "+" : "-"}${pct}`;
  }
  if (e.drain) return `DRAIN ${Math.round(e.drain * 100)}%`;
  return "";
}