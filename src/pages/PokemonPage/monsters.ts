import { MOVES } from "./data/moves";
import { SPECIES } from "./data/species";
import { typeMultiplier } from "./data/types";
import type { Combatant, EncounterEntry, Move, PartyMember, SpeciesData } from "./types";

export const MAX_LEVEL = 100;

/** The creature you start the game with. */
export const STARTER = { speciesId: "emberlin", level: 5 };

/* ---------- stats ---------- */

const statAt = (base: number, level: number) => Math.floor((base * 2 * level) / 100) + 5;
const hpAt = (base: number, level: number) => Math.floor((base * 2 * level) / 100) + level + 10;

export const memberMaxHp = (m: PartyMember) => hpAt(SPECIES[m.speciesId].baseHp, m.level);

/* ---------- experience ---------- */

/** Total experience needed to be at `level` (cubic curve). */
export const expForLevel = (level: number) => level * level * level;

/** 0..1 progress between the current level and the next one. */
export function expProgress(level: number, exp: number) {
  const lo = expForLevel(level);
  const hi = expForLevel(level + 1);
  return Math.min(1, Math.max(0, (exp - lo) / (hi - lo)));
}

/** Experience earned for defeating `enemy` (x1.5 against trainers). */
export const expGain = (enemy: Combatant, trainer: boolean) =>
  Math.max(1, Math.floor(((enemy.baseExp * enemy.level) / 7) * (trainer ? 1.5 : 1)));

/* ---------- building creatures ---------- */

/** Moves known at `level`: the last 4 of the learnset up to that level. */
export const movesAt = (sp: SpeciesData, level: number): Move[] =>
  sp.learnset
    .filter((e) => e.level <= level)
    .map((e) => MOVES[e.move])
    .slice(-4);

export function toCombatant(sp: SpeciesData, level: number): Combatant {
  return {
    speciesId: sp.id,
    name: sp.name,
    kind: sp.kind,
    types: sp.types,
    main: sp.main,
    accent: sp.accent,
    tail: sp.tail,
    level,
    maxHp: hpAt(sp.baseHp, level),
    atk: statAt(sp.baseAtk, level),
    def: statAt(sp.baseDef, level),
    baseExp: sp.baseExp,
    stage: sp.stage ?? 1,
    size: sp.size ?? 1,
    moves: movesAt(sp, level),
  };
}

export function createMember(speciesId: string, level: number): PartyMember {
  return {
    speciesId,
    level,
    exp: expForLevel(level),
    hp: hpAt(SPECIES[speciesId].baseHp, level),
  };
}

/** Picks a wild creature from a map's encounter table. */
export function rollEncounter(entries: EncounterEntry[]): Combatant | null {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) {
      const level = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
      return toCombatant(SPECIES[e.speciesId], level);
    }
  }
  return null;
}

/* ---------- battle ---------- */

/** Multiplier of an attack / defense stage (-6..+6): +1 = x1.5, -1 = x0.67... */
export const stageMultiplier = (stage: number) =>
  stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);

export interface DamageOptions {
  atkStage?: number;
  defStage?: number;
  /** A burned attacker deals half damage. */
  burned?: boolean;
}

export interface DamageResult {
  damage: number;
  /** Type effectiveness: 0 immune, 0.5 weak, 1 normal, 2 super effective... */
  mult: number;
  stab: boolean;
}

/** Damage of `move` from `attacker` to `defender`: level, stats, STAB, type chart, stages, burn. */
export function calcDamage(
  attacker: Combatant,
  move: Move,
  defender: Combatant,
  opts: DamageOptions = {}
): DamageResult {
  const mult = typeMultiplier(move.type, defender.types);
  const stab = attacker.types.includes(move.type);
  if (mult === 0) return { damage: 0, mult, stab };

  const atk = attacker.atk * stageMultiplier(opts.atkStage ?? 0) * (opts.burned ? 0.5 : 1);
  const def = defender.def * stageMultiplier(opts.defStage ?? 0);
  const base = (((2 * attacker.level) / 5 + 2) * move.power * atk) / def / 50 + 2;
  const damage = Math.max(1, Math.floor(base * (stab ? 1.5 : 1) * mult * (0.85 + Math.random() * 0.15)));
  return { damage, mult, stab };
}

/* ---------- items & catching ---------- */

/**
 * Chance (0..1) that a ball catches a wild creature. Full HP gives a third of
 * the species' catch rate; almost no HP gives nearly all of it.
 */
export function catchChance(speciesId: string, hp: number, maxHp: number) {
  const base = SPECIES[speciesId].catchRate ?? 0.8;
  const chance = (base * (3 - (2 * hp) / maxHp)) / 3;
  return Math.min(0.95, Math.max(0.05, chance));
}

/** The member after healing `amount` HP, or null if it would have no effect (fainted or full HP). */
export function healMember(m: PartyMember, amount: number): PartyMember | null {
  const max = memberMaxHp(m);
  if (m.hp <= 0 || m.hp >= max) return null;
  return { ...m, hp: Math.min(max, m.hp + amount) };
}

/* ---------- evolution ---------- */

/** Species this creature evolves into right now (it reached the evolution level), or null. */
export function evolutionOf(m: PartyMember): string | null {
  const evo = SPECIES[m.speciesId]?.evolution;
  return evo && m.level >= evo.level && SPECIES[evo.into] ? evo.into : null;
}

/** The creature after evolving: same level and experience, new species, HP raised by the gain in max HP. */
export function evolveMember(m: PartyMember, into: string): PartyMember {
  const before = memberMaxHp(m);
  const evolved: PartyMember = { ...m, speciesId: into };
  const after = memberMaxHp(evolved);
  return { ...evolved, hp: Math.min(after, m.hp + Math.max(0, after - before)) };
}