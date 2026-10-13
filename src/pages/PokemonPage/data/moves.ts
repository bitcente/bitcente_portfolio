import type { Move, MoveEffect, PokeType } from "../types";
import { TYPE_EFFECTS } from "./types";

/**
 * Move catalog. To add a move: add a line here, give it an animation in
 * fx/recipes.ts (otherwise it uses the default of its type) and put its id
 * in the learnset of a species (data/species.ts).
 *
 * The 5th argument overrides the default effect of the type:
 *   undefined = use the type's effect (fire burns, electric paralyzes...)
 *   null      = no effect
 *   {...}     = custom effect
 */
const list: [string, string, PokeType, number, number, (MoveEffect | null)?][] = [
  // id,            name,            type,       power, acc,  effect
  ["tackle",        "TACKLE",        "normal",   35, 100],
  ["scratch",       "SCRATCH",       "normal",   40, 100],
  ["slash",         "SLASH",         "normal",   65, 90],
  ["ember",         "EMBER",         "fire",     45, 100],
  ["flamethrower",  "FLAMETHROWER",  "fire",     75, 100, { status: "burn", chance: 0.1 }],
  ["water-gun",     "WATER GUN",     "water",    40, 100],
  ["thunder-shock", "THUNDER SHOCK", "electric", 45, 100],
  ["vine-whip",     "VINE WHIP",     "grass",    45, 100, null],
  ["leaf-cut",      "LEAF CUT",      "grass",    55, 95, null],
  ["absorb",        "ABSORB",        "grass",    30, 100, { drain: 0.5 }],
  ["ice-shard",     "ICE SHARD",     "ice",      45, 100],
  ["rock-smash",    "ROCK SMASH",    "fighting", 40, 100, { stat: { stat: "def", stages: -1, target: "foe" }, chance: 0.5 }],
  ["poison-sting",  "POISON STING",  "poison",   35, 100],
  ["sludge",        "SLUDGE",        "poison",   60, 100],
  ["mud-shot",      "MUD SHOT",      "ground",   50, 95],
  ["earthquake",    "EARTHQUAKE",    "ground",   75, 100],
  ["gust",          "GUST",          "flying",   40, 100],
  ["peck",          "PECK",          "flying",   35, 100],
  ["wing-attack",   "WING ATTACK",   "flying",   55, 100],
  ["confusion",     "CONFUSION",     "psychic",  50, 100],
  ["bug-bite",      "BUG BITE",      "bug",      55, 100],
  ["rock-throw",    "ROCK THROW",    "rock",     50, 90],
  ["shadow-ball",   "SHADOW BALL",   "ghost",    60, 100, null],
  ["lick",          "LICK",          "ghost",    30, 100, { status: "paralysis", chance: 0.3 }],
  ["dragon-breath", "DRAGON BREATH", "dragon",   60, 100, null],
  ["bite",          "BITE",          "dark",     50, 100],
  ["metal-claw",    "METAL CLAW",    "steel",    50, 95],
  ["fairy-wind",    "FAIRY WIND",    "fairy",    40, 100],
];

export const MOVES: Record<string, Move> = Object.fromEntries(
  list.map(([id, name, type, power, accuracy, effect]) => [
    id,
    { id, name, type, power, accuracy, ...(effect !== undefined ? { effect } : {}) } as Move,
  ])
);

/** What a move does after it hits (its own effect, or the default of its type). */
export const effectOf = (m: Move): MoveEffect | undefined =>
  m.effect === undefined ? TYPE_EFFECTS[m.type] : m.effect ?? undefined;