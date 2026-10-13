import { PAL } from "../../constants";
import type { Dir } from "../../types";

export function drawTile(
  ctx: CanvasRenderingContext2D,
  ch: string,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  frame: number
) {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(sx + x, sy + y, w, h);
  };
  const tuft = (gx: number, gy: number) => {
    r(gx, gy + 2, 1, 3, PAL[3]);
    r(gx + 2, gy, 1, 5, PAL[3]);
    r(gx + 4, gy + 2, 1, 3, PAL[3]);
    r(gx, gy + 4, 5, 1, PAL[2]);
  };
  switch (ch) {
    case "T":
      r(0, 0, 16, 16, PAL[1]);
      r(3, 1, 10, 11, PAL[3]);
      r(1, 3, 14, 7, PAL[3]);
      r(5, 3, 3, 3, PAL[2]);
      r(9, 6, 3, 3, PAL[2]);
      r(7, 12, 2, 4, PAL[2]);
      break;
    case "G":
      r(0, 0, 16, 16, PAL[1]);
      tuft(1, 1);
      tuft(9, 0);
      tuft(5, 6);
      tuft(11, 8);
      tuft(0, 10);
      break;
    case "W": {
      r(0, 0, 16, 16, PAL[2]);
      const o = frame % 2 === 0 ? 0 : 3;
      r(2 + o, 4, 5, 1, PAL[1]);
      r(9 - o, 10, 5, 1, PAL[1]);
      break;
    }
    case "p":
      r(0, 0, 16, 16, PAL[0]);
      if ((tx + ty) % 2 === 0) r(4, 5, 2, 1, PAL[1]);
      else r(10, 10, 2, 1, PAL[1]);
      break;
    case "f": // flowers
      r(0, 0, 16, 16, PAL[0]);
      for (const [fx, fy] of [[3, 4], [10, 3], [6, 11], [12, 12]]) {
        r(fx, fy - 1, 1, 3, PAL[2]);
        r(fx - 1, fy, 3, 1, PAL[2]);
        r(fx, fy, 1, 1, PAL[3]);
      }
      break;
    case "R": // roof
      r(0, 0, 16, 16, PAL[2]);
      r(0, 4, 16, 1, PAL[3]);
      r(0, 9, 16, 1, PAL[3]);
      r(0, 14, 16, 2, PAL[3]);
      r(3, 2, 1, 1, PAL[1]);
      r(11, 7, 1, 1, PAL[1]);
      break;
    case "Q": // gym roof (checkered)
      r(0, 0, 16, 16, PAL[3]);
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) r(i * 4, j * 4, 4, 4, PAL[2]);
      break;
    case "E": // center roof (cross)
      r(0, 0, 16, 16, PAL[2]);
      r(6, 3, 4, 10, PAL[0]);
      r(3, 6, 10, 4, PAL[0]);
      break;
    case "H": // house wall with window
      r(0, 0, 16, 16, PAL[0]);
      r(4, 4, 8, 7, PAL[3]);
      r(5, 5, 6, 5, PAL[1]);
      r(7, 5, 2, 5, PAL[3]);
      r(0, 15, 16, 1, PAL[2]);
      break;
    case "d": // closed door
      r(0, 0, 16, 16, PAL[0]);
      r(4, 2, 8, 14, PAL[3]);
      r(5, 3, 6, 13, PAL[2]);
      r(10, 9, 1, 1, PAL[0]);
      break;
    case "c": // center door (glass)
      r(0, 0, 16, 16, PAL[0]);
      r(3, 0, 10, 16, PAL[3]);
      r(4, 1, 8, 15, PAL[1]);
      r(8, 1, 1, 15, PAL[3]);
      break;
    case "y": // gym door
      r(0, 0, 16, 16, PAL[0]);
      r(2, 0, 12, 16, PAL[3]);
      r(3, 1, 10, 15, PAL[2]);
      r(7, 1, 2, 15, PAL[3]);
      break;
    case "i": // indoor floor
      r(0, 0, 16, 16, PAL[0]);
      r(0, 0, 16, 1, PAL[1]);
      r(0, 0, 1, 16, PAL[1]);
      break;
    case "w": // indoor wall
      r(0, 0, 16, 16, PAL[2]);
      r(0, 0, 16, 2, PAL[3]);
      r(0, 8, 16, 1, PAL[3]);
      r(8, 0, 1, 8, PAL[3]);
      r(4, 8, 1, 8, PAL[3]);
      r(12, 8, 1, 8, PAL[3]);
      break;
    case "k": // counter
      r(0, 0, 16, 16, PAL[2]);
      r(0, 0, 16, 5, PAL[0]);
      r(0, 5, 16, 1, PAL[3]);
      r(0, 15, 16, 1, PAL[3]);
      r(3, 8, 4, 5, PAL[1]);
      r(9, 8, 4, 5, PAL[1]);
      break;
    case "x": // door mat
      r(0, 0, 16, 16, PAL[0]);
      r(1, 3, 14, 10, PAL[3]);
      r(2, 4, 12, 8, PAL[2]);
      r(4, 6, 8, 4, PAL[1]);
      break;
    case "n": // potted plant
      r(0, 0, 16, 16, PAL[0]);
      r(2, 1, 12, 9, PAL[2]);
      r(4, 0, 8, 2, PAL[2]);
      r(5, 3, 2, 2, PAL[3]);
      r(9, 5, 2, 2, PAL[3]);
      r(5, 10, 6, 5, PAL[3]);
      r(6, 11, 4, 2, PAL[1]);
      break;
    default:
      r(0, 0, 16, 16, PAL[0]);
      if ((tx * 3 + ty * 5) % 4 === 0) r(5, 6, 1, 1, PAL[1]);
  }
}

/** The "!" bubble above a character that has just spotted you. */
export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const bx = x + 4;
  const by = y - 15;
  ctx.fillStyle = PAL[3];
  ctx.fillRect(bx, by, 8, 11);
  ctx.fillStyle = PAL[0];
  ctx.fillRect(bx + 1, by + 1, 6, 9);
  ctx.fillStyle = PAL[3];
  ctx.fillRect(bx + 3, by + 2, 2, 4);
  ctx.fillRect(bx + 3, by + 7, 2, 2);
}

/** Characters other than the player: the player sprite with different clothes. */
export function drawNpc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
  kind: "trainer" | "nurse" | "villager" = "trainer",
  /** 0 or 1: which leg frame to show while walking */
  stride = 0
) {
  const oy = y - 2;
  drawPlayer(ctx, x, oy, dir, stride, false);
  const r = (rx: number, ry: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + rx, oy + ry, w, h);
  };
  if (kind === "trainer") {
    r(3, 0, 10, 3, PAL[2]); // dark cap
    r(3, 0, 10, 1, PAL[3]);
  } else if (kind === "nurse") {
    r(3, 0, 10, 3, PAL[1]); // light hair
    r(3, 0, 10, 1, PAL[3]);
    r(5, 0, 6, 2, PAL[0]); // white cap
    r(7, 0, 2, 1, PAL[3]); // cross
    r(4, 8, 8, 4, PAL[0]); // white dress
    r(7, 8, 2, 4, PAL[1]);
  } else {
    r(3, 0, 10, 3, PAL[1]); // light hair
    r(3, 0, 10, 1, PAL[3]);
    r(4, 8, 8, 4, PAL[1]); // light shirt
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Dir,
  stride: number,
  inGrass: boolean
) {
  const r = (rx: number, ry: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + rx, y + ry, w, h);
  };
  // legs
  r(4, 12 + stride, 3, 4 - stride, PAL[3]);
  r(9, 12 + (1 - stride), 3, 4 - (1 - stride), PAL[3]);
  // body
  r(3, 7, 10, 6, PAL[3]);
  r(4, 8, 8, 4, PAL[2]);
  // head
  r(4, 1, 8, 8, PAL[3]);
  r(5, 3, 6, 5, PAL[0]);
  // cap
  r(3, 0, 10, 3, PAL[3]);
  r(5, 1, 6, 1, PAL[2]);
  // face
  if (dir === "up") r(5, 3, 6, 5, PAL[2]);
  else if (dir === "down") {
    r(6, 5, 1, 2, PAL[3]);
    r(9, 5, 1, 2, PAL[3]);
  } else if (dir === "left") {
    r(5, 5, 1, 2, PAL[3]);
    r(7, 5, 1, 2, PAL[3]);
    r(11, 3, 1, 5, PAL[2]);
  } else {
    r(8, 5, 1, 2, PAL[3]);
    r(10, 5, 1, 2, PAL[3]);
    r(5, 3, 1, 5, PAL[2]);
  }
  // grass covers the feet
  if (inGrass) {
    r(0, 11, 16, 5, PAL[1]);
    for (let i = 0; i < 4; i++) {
      r(i * 4, 11, 1, 5, PAL[3]);
      r(i * 4 + 2, 10, 1, 6, PAL[3]);
    }
    r(0, 15, 16, 1, PAL[2]);
  }
}