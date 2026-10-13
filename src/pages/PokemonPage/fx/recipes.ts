import type { Move, PokeType } from "../types";
import type { FxLayer, MoveAnim, MotionId } from "./types";

/**
 * One animation per move. A recipe = how the attacker moves + a timeline of
 * visual layers. To make a new attack, copy a recipe and change the layers,
 * colors and timing (see fx/types.ts for every layer and its options).
 *
 * Colors are mid / dark on purpose: the scene is shown in 4 green shades, so
 * very bright effects would disappear against the light background.
 */
const COLOR = {
  normal: "#6e6e6e",
  fire: "#e0561a",
  fireHot: "#f0902a",
  water: "#2d7fd6",
  waterLight: "#6fb0ee",
  electric: "#d8a800",
  grass: "#2f9e44",
  grassDark: "#1f7a32",
  ice: "#4fb0d8",
  fighting: "#b0402a",
  poison: "#8a3fb0",
  ground: "#8a6a3a",
  flying: "#6f86c8",
  psychic: "#d03a8a",
  bug: "#7a9a20",
  rock: "#7a6a50",
  ghost: "#4a3a6a",
  dragon: "#5a3ad0",
  dark: "#2a2230",
  steel: "#7a8590",
  fairy: "#d070a8",
};

const A = (motion: MotionId, duration: number, hitAt: number, layers: FxLayer[]): MoveAnim => ({
  motion,
  duration,
  hitAt,
  layers,
});

export const MOVE_ANIMS: Record<string, MoveAnim> = {
  /* ---------------- normal ---------------- */
  tackle: A("lunge", 0.6, 0.3, [
    { kind: "burst", at: 0.3, dur: 0.3, shape: "star", color: COLOR.normal, count: 6, size: 0.18, speed: 1.1 },
    { kind: "shake", at: 0.3, dur: 0.2, amp: 0.5 },
  ]),
  scratch: A("lunge", 0.65, 0.3, [
    { kind: "slash", at: 0.28, dur: 0.35, color: COLOR.normal, count: 3, angle: -0.7, length: 1.8 },
    { kind: "burst", at: 0.3, dur: 0.25, shape: "spark", color: COLOR.normal, count: 6, size: 0.1, speed: 1.4 },
  ]),
  slash: A("rush", 0.8, 0.32, [
    { kind: "slash", at: 0.3, dur: 0.3, color: COLOR.normal, angle: -0.8, length: 2.6 },
    { kind: "slash", at: 0.42, dur: 0.3, color: COLOR.normal, angle: 0.8, length: 2.6 },
    { kind: "flash", at: 0.32, dur: 0.12, strength: 0.5 },
    { kind: "shake", at: 0.32, dur: 0.3, amp: 0.9 },
  ]),

  /* ---------------- fire ---------------- */
  ember: A("cast", 0.85, 0.5, [
    { kind: "aura", at: 0, dur: 0.3, color: COLOR.fireHot, on: "user", size: 1.1 },
    { kind: "projectile", at: 0.2, dur: 0.3, shape: "orb", color: COLOR.fire, size: 0.28, arc: 0.4, trail: COLOR.fireHot },
    { kind: "burst", at: 0.5, dur: 0.4, shape: "puff", color: COLOR.fire, count: 8, size: 0.28, speed: 1.0 },
    { kind: "burst", at: 0.5, dur: 0.35, shape: "spark", color: COLOR.fireHot, count: 8, size: 0.1, speed: 1.6 },
  ]),
  flamethrower: A("cast", 1.2, 0.5, [
    { kind: "aura", at: 0, dur: 0.35, color: COLOR.fireHot, on: "user", size: 1.2 },
    { kind: "beam", at: 0.25, dur: 0.8, color: COLOR.fire, width: 0.35 },
    { kind: "burst", at: 0.5, dur: 0.5, shape: "puff", color: COLOR.fire, count: 10, size: 0.35, speed: 1.2 },
    { kind: "burst", at: 0.75, dur: 0.45, shape: "puff", color: COLOR.fireHot, count: 8, size: 0.3, speed: 1.4 },
    { kind: "shake", at: 0.5, dur: 0.6, amp: 0.4 },
  ]),

  /* ---------------- water ---------------- */
  "water-gun": A("cast", 0.9, 0.45, [
    { kind: "projectile", at: 0.15, dur: 0.3, shape: "drop", color: COLOR.water, size: 0.18, count: 5, arc: 0.3, trail: COLOR.waterLight },
    { kind: "burst", at: 0.45, dur: 0.45, shape: "drop", color: COLOR.water, count: 10, size: 0.14, speed: 1.3 },
    { kind: "ring", at: 0.45, dur: 0.4, color: COLOR.waterLight, size: 1.4 },
  ]),

  /* ---------------- electric ---------------- */
  "thunder-shock": A("cast", 0.95, 0.45, [
    { kind: "aura", at: 0, dur: 0.35, color: COLOR.electric, on: "user", size: 1.1 },
    { kind: "bolt", at: 0.4, dur: 0.4, color: COLOR.electric },
    { kind: "flash", at: 0.45, dur: 0.14, strength: 0.6 },
    { kind: "burst", at: 0.45, dur: 0.4, shape: "spark", color: COLOR.electric, count: 12, size: 0.1, speed: 1.6 },
    { kind: "shake", at: 0.45, dur: 0.3, amp: 0.5 },
  ]),

  /* ---------------- grass ---------------- */
  "vine-whip": A("lunge", 0.7, 0.32, [
    { kind: "slash", at: 0.28, dur: 0.35, color: COLOR.grass, angle: -0.5, length: 3.0 },
    { kind: "burst", at: 0.32, dur: 0.4, shape: "leaf", color: COLOR.grass, count: 6, size: 0.18, speed: 1.3 },
  ]),
  "leaf-cut": A("spin", 1.0, 0.55, [
    { kind: "swirl", at: 0, dur: 0.5, shape: "leaf", color: COLOR.grass, count: 8, size: 0.18, on: "user", turns: 2, radius: 1.0 },
    { kind: "projectile", at: 0.35, dur: 0.3, shape: "leaf", color: COLOR.grassDark, size: 0.28, count: 5, arc: 0.3, spin: 12 },
    { kind: "burst", at: 0.6, dur: 0.4, shape: "leaf", color: COLOR.grass, count: 10, size: 0.18, speed: 1.4 },
  ]),
  absorb: A("cast", 1.0, 0.4, [
    { kind: "ring", at: 0, dur: 0.4, color: COLOR.grass, size: 1.1, on: "target", vertical: true },
    { kind: "burst", at: 0.4, dur: 0.3, shape: "orb", color: COLOR.grass, count: 6, size: 0.1, speed: 0.8 },
    { kind: "drain", at: 0.45, dur: 0.55, color: COLOR.grass, count: 6, size: 0.14 },
  ]),

  /* ---------------- ice ---------------- */
  "ice-shard": A("cast", 0.85, 0.42, [
    { kind: "aura", at: 0, dur: 0.25, color: COLOR.ice, on: "user", size: 1.0 },
    { kind: "projectile", at: 0.18, dur: 0.24, shape: "shard", color: COLOR.ice, size: 0.3, count: 3, arc: 0.2, trail: COLOR.ice },
    { kind: "burst", at: 0.42, dur: 0.45, shape: "shard", color: COLOR.ice, count: 12, size: 0.16, speed: 1.5 },
    { kind: "flash", at: 0.42, dur: 0.1, strength: 0.35 },
  ]),

  /* ---------------- fighting ---------------- */
  "rock-smash": A("stomp", 0.85, 0.5, [
    { kind: "ring", at: 0.5, dur: 0.5, color: COLOR.fighting, size: 1.8, count: 2 },
    { kind: "burst", at: 0.5, dur: 0.5, shape: "rock", color: COLOR.rock, count: 8, size: 0.14, speed: 1.4 },
    { kind: "shake", at: 0.5, dur: 0.4, amp: 1.0 },
  ]),

  /* ---------------- poison ---------------- */
  "poison-sting": A("hop", 0.75, 0.38, [
    { kind: "projectile", at: 0.15, dur: 0.23, shape: "dart", color: COLOR.poison, size: 0.2, count: 3, arc: 0.15 },
    { kind: "burst", at: 0.38, dur: 0.45, shape: "puff", color: COLOR.poison, count: 7, size: 0.22, speed: 0.8 },
  ]),
  sludge: A("cast", 1.0, 0.5, [
    { kind: "aura", at: 0, dur: 0.3, color: COLOR.poison, on: "user", size: 1.1 },
    { kind: "projectile", at: 0.25, dur: 0.25, shape: "orb", color: COLOR.poison, size: 0.4, arc: 1.0, trail: COLOR.poison },
    { kind: "burst", at: 0.5, dur: 0.5, shape: "puff", color: COLOR.poison, count: 12, size: 0.3, speed: 1.1 },
    { kind: "ring", at: 0.5, dur: 0.45, color: COLOR.poison, size: 1.6 },
  ]),

  /* ---------------- ground ---------------- */
  "mud-shot": A("hop", 0.85, 0.45, [
    { kind: "projectile", at: 0.2, dur: 0.25, shape: "orb", color: COLOR.ground, size: 0.24, count: 3, arc: 0.9 },
    { kind: "burst", at: 0.45, dur: 0.45, shape: "puff", color: COLOR.ground, count: 8, size: 0.26, speed: 1.0 },
  ]),
  earthquake: A("stomp", 1.2, 0.55, [
    { kind: "ring", at: 0.55, dur: 0.6, color: COLOR.ground, size: 2.6, count: 3 },
    { kind: "burst", at: 0.55, dur: 0.6, shape: "rock", color: COLOR.rock, count: 10, size: 0.16, speed: 1.6 },
    { kind: "shake", at: 0.55, dur: 0.6, amp: 1.6 },
  ]),

  /* ---------------- flying ---------------- */
  gust: A("spin", 0.9, 0.5, [
    { kind: "swirl", at: 0.15, dur: 0.7, shape: "spark", color: COLOR.flying, count: 10, size: 0.1, on: "target", turns: 2.5, radius: 1.0 },
    { kind: "ring", at: 0.5, dur: 0.4, color: COLOR.flying, size: 1.6, vertical: true },
  ]),
  peck: A("charge", 0.6, 0.34, [
    { kind: "burst", at: 0.34, dur: 0.25, shape: "star", color: COLOR.flying, count: 5, size: 0.14, speed: 1.0 },
  ]),
  "wing-attack": A("rush", 0.8, 0.35, [
    { kind: "slash", at: 0.3, dur: 0.3, color: COLOR.flying, count: 2, angle: -0.4, length: 2.4 },
    { kind: "burst", at: 0.35, dur: 0.45, shape: "leaf", color: COLOR.flying, count: 8, size: 0.16, speed: 1.4 },
    { kind: "shake", at: 0.35, dur: 0.25, amp: 0.6 },
  ]),

  /* ---------------- psychic ---------------- */
  confusion: A("cast", 1.1, 0.55, [
    { kind: "aura", at: 0, dur: 0.4, color: COLOR.psychic, on: "user", size: 1.1 },
    { kind: "ring", at: 0.3, dur: 0.7, color: COLOR.psychic, size: 1.8, on: "target", count: 3, vertical: true },
    { kind: "swirl", at: 0.4, dur: 0.6, shape: "star", color: COLOR.psychic, count: 6, size: 0.12, on: "target", turns: 1.5, radius: 0.9 },
  ]),

  /* ---------------- bug ---------------- */
  "bug-bite": A("charge", 0.75, 0.42, [
    { kind: "jaws", at: 0.3, dur: 0.22, color: COLOR.bug },
    { kind: "burst", at: 0.5, dur: 0.35, shape: "spark", color: COLOR.bug, count: 7, size: 0.1, speed: 1.2 },
  ]),

  /* ---------------- rock ---------------- */
  "rock-throw": A("hop", 0.95, 0.55, [
    { kind: "fall", at: 0.2, dur: 0.5, shape: "rock", color: COLOR.rock, count: 4, size: 0.3 },
    { kind: "burst", at: 0.55, dur: 0.45, shape: "puff", color: COLOR.rock, count: 8, size: 0.24, speed: 1.0 },
    { kind: "shake", at: 0.55, dur: 0.3, amp: 0.7 },
  ]),

  /* ---------------- ghost ---------------- */
  "shadow-ball": A("cast", 1.0, 0.55, [
    { kind: "aura", at: 0, dur: 0.35, color: COLOR.ghost, on: "user", size: 1.1 },
    { kind: "projectile", at: 0.25, dur: 0.3, shape: "orb", color: COLOR.ghost, size: 0.42, arc: 0.3, trail: COLOR.ghost },
    { kind: "burst", at: 0.55, dur: 0.45, shape: "puff", color: COLOR.ghost, count: 10, size: 0.3, speed: 1.1 },
    { kind: "flash", at: 0.55, dur: 0.15, color: "#000000", strength: 0.5 },
  ]),
  lick: A("lunge", 0.7, 0.35, [
    { kind: "swirl", at: 0.2, dur: 0.5, shape: "puff", color: COLOR.ghost, count: 5, size: 0.2, on: "target", turns: 1, radius: 0.7 },
    { kind: "burst", at: 0.35, dur: 0.35, shape: "star", color: COLOR.ghost, count: 5, size: 0.14, speed: 0.9 },
  ]),

  /* ---------------- dragon ---------------- */
  "dragon-breath": A("cast", 1.1, 0.5, [
    { kind: "aura", at: 0, dur: 0.35, color: COLOR.dragon, on: "user", size: 1.2 },
    { kind: "beam", at: 0.25, dur: 0.7, color: COLOR.dragon, width: 0.28 },
    { kind: "swirl", at: 0.3, dur: 0.6, shape: "spark", color: COLOR.dragon, count: 8, size: 0.1, on: "user", turns: 2, radius: 0.8 },
    { kind: "burst", at: 0.5, dur: 0.45, shape: "puff", color: COLOR.dragon, count: 9, size: 0.3, speed: 1.2 },
    { kind: "shake", at: 0.5, dur: 0.4, amp: 0.5 },
  ]),

  /* ---------------- dark ---------------- */
  bite: A("charge", 0.8, 0.45, [
    { kind: "jaws", at: 0.32, dur: 0.22, color: COLOR.dark },
    { kind: "burst", at: 0.5, dur: 0.35, shape: "star", color: COLOR.dark, count: 7, size: 0.14, speed: 1.1 },
    { kind: "shake", at: 0.52, dur: 0.2, amp: 0.5 },
  ]),

  /* ---------------- steel ---------------- */
  "metal-claw": A("rush", 0.85, 0.35, [
    { kind: "slash", at: 0.3, dur: 0.35, color: COLOR.steel, count: 3, angle: -0.9, length: 2.2 },
    { kind: "flash", at: 0.34, dur: 0.1, strength: 0.4 },
    { kind: "burst", at: 0.35, dur: 0.4, shape: "star", color: COLOR.steel, count: 8, size: 0.14, speed: 1.5 },
    { kind: "shake", at: 0.35, dur: 0.25, amp: 0.6 },
  ]),

  /* ---------------- fairy ---------------- */
  "fairy-wind": A("spin", 0.95, 0.5, [
    { kind: "swirl", at: 0.1, dur: 0.7, shape: "star", color: COLOR.fairy, count: 9, size: 0.13, on: "target", turns: 2, radius: 1.0 },
    { kind: "burst", at: 0.5, dur: 0.45, shape: "star", color: COLOR.fairy, count: 10, size: 0.14, speed: 1.4 },
    { kind: "ring", at: 0.5, dur: 0.45, color: COLOR.fairy, size: 1.7, vertical: true },
  ]),
};

/** Used for moves that have no recipe of their own: a simple animation in the color of their type. */
const FALLBACK = (type: PokeType): MoveAnim =>
  A("lunge", 0.65, 0.32, [
    { kind: "burst", at: 0.32, dur: 0.35, shape: "star", color: COLOR[type], count: 8, size: 0.18, speed: 1.2 },
    { kind: "ring", at: 0.32, dur: 0.35, color: COLOR[type], size: 1.3 },
  ]);

export const animFor = (move: Move): MoveAnim => MOVE_ANIMS[move.id] ?? FALLBACK(move.type);

/**
 * The evolution: light and dust gather around the creature until it is
 * covered (0 - 3 s), a flash hides the swap to the new model, then the dust
 * is blown away and rays of light fade out (3 - 4.7 s).
 * Played by components/evolution/EvolutionScene.tsx.
 */
export const EVOLUTION_ANIM: MoveAnim = A("cast", 5.0, 3.0, [
  { kind: "aura", at: 0, dur: 3.0, color: "#ffffff", on: "user", size: 1.5 },
  { kind: "cover", at: 0, dur: 2.9, color: "#9a8a78", count: 22, size: 0.55, radius: 0.9, mode: "gather", on: "user" },
  { kind: "rays", at: 0.4, dur: 2.7, color: "#ffffff", count: 10, length: 3.2, on: "user" },
  { kind: "swirl", at: 0.3, dur: 2.6, shape: "star", color: "#ffffff", count: 14, size: 0.11, on: "user", turns: 3, radius: 1.1 },
  { kind: "ring", at: 0.8, dur: 1.4, color: "#ffffff", size: 2.4, on: "user", count: 3 },
  { kind: "shake", at: 2.4, dur: 0.7, amp: 0.6 },
  { kind: "flash", at: 2.9, dur: 0.4, strength: 1 },
  { kind: "cover", at: 3.0, dur: 1.7, color: "#9a8a78", count: 22, size: 0.55, radius: 0.9, mode: "disperse", on: "user" },
  { kind: "burst", at: 3.0, dur: 1.0, shape: "star", color: "#ffffff", count: 18, size: 0.16, speed: 2.4, on: "user" },
  { kind: "rays", at: 3.0, dur: 1.6, color: "#ffffff", count: 12, length: 3.6, on: "user" },
  { kind: "ring", at: 3.0, dur: 1.1, color: "#ffffff", size: 3.2, on: "user", count: 2 },
  { kind: "aura", at: 3.0, dur: 1.2, color: "#ffffff", on: "user", size: 1.7 },
]);