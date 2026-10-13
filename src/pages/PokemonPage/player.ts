import type { Dir, PlayerState } from "./types";

export const createPlayerState = (x: number, y: number, dir: Dir = "down"): PlayerState => ({
  x,
  y,
  tx: x,
  ty: y,
  dir,
  moving: false,
  progress: 0,
  parity: 0,
});