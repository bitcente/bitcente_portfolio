import type { Btn, Dir } from "./types";

export const TILE = 16;
// Minimum logical screen size. The real size grows with the window (see useScale).
export const BASE_W = 160;
export const BASE_H = 144;
export const STEP_TIME = 0.24; // seconds per tile (the original games take ~0.27s)
export const ENCOUNTER_RATE = 0.2; // chance per step on tall grass

// 4 greys. An SVG filter maps them to the 4 classic Game Boy greens.
export const PAL = ["#ffffff", "#aaaaaa", "#555555", "#000000"] as const;

export const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// Where a new game starts
export const NEW_GAME = { mapId: "sprout_town", x: 9, y: 9, dir: "down" as Dir };

export const KEYMAP: Record<string, Btn> = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  z: "a",
  j: "a",
  " ": "a",
  x: "b",
  k: "b",
  Escape: "b",
  Backspace: "b",
  Enter: "start",
};