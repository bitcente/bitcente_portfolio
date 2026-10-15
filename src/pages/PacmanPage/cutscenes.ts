import { center, COLS, TILE } from "./maze"

// The three cutscenes of the arcade, frame by frame:
// 1 (after level 2): Blinky chases pacman off the screen, and a giant pacman chases him back, blue
// 2 (after level 5): Blinky's sheet gets caught on a nail and tears
// 3 (after levels 9, 13 and 17): Blinky in his mended sheet chases pacman, and comes back naked dragging it

export const CUTSCENE_FRAMES: Record<1 | 2 | 3, number> = { 1: 680, 2: 500, 3: 660 }

export type CutsceneSprite =
  | { kind: "pac", x: number, y: number, dir: number }
  | { kind: "bigPac", x: number, y: number }
  | { kind: "blinky", x: number, y: number, dir: number, blue?: boolean, look?: "down" | "front" }
  | { kind: "nail", x: number, y: number }
  // sheet stretched from the back of Blinky to the nail
  | { kind: "stretch", x: number, y: number, length: number }
  // the torn bit left on the nail
  | { kind: "rag", x: number, y: number }
  | { kind: "torn", x: number, y: number, look: "left" | "down" | "front" }
  | { kind: "patched", x: number, y: number }
  | { kind: "naked", x: number, y: number }

const Y = center(17)
const RIGHT_EDGE = COLS * TILE + 16
const LEFT_EDGE = -24
const PAC_SPEED = 1.25
const BLINKY_SPEED = 1.32
const LEFT = 1
const RIGHT = 3

// pacman running from the right edge to the left one, and Blinky a bit behind him
function chase(t: number, blinkyStart: number): CutsceneSprite[] {
  const sprites: CutsceneSprite[] = []
  const pacX = RIGHT_EDGE - t * PAC_SPEED
  if (pacX > LEFT_EDGE) sprites.push({ kind: "pac", x: pacX, y: Y, dir: LEFT })
  const blinkyX = RIGHT_EDGE + blinkyStart - t * BLINKY_SPEED
  if (blinkyX > LEFT_EDGE) sprites.push({ kind: "blinky", x: blinkyX, y: Y, dir: LEFT })
  return sprites
}

// what's on the screen at frame t of a cutscene
export function cutscene(act: 1 | 2 | 3, t: number): CutsceneSprite[] {
  if (act === 1) {
    if (t < 300) return chase(t, 30)
    // back from the left, the other way round
    const back = t - 300
    const sprites: CutsceneSprite[] = []
    const blinkyX = LEFT_EDGE + back * .85
    if (blinkyX < RIGHT_EDGE) sprites.push({ kind: "blinky", x: blinkyX, y: Y, dir: RIGHT, blue: true })
    const bigX = LEFT_EDGE - 60 + back * .9
    if (bigX < RIGHT_EDGE + 20) sprites.push({ kind: "bigPac", x: bigX, y: Y - 8 })
    return sprites
  }

  if (act === 2) {
    const nail = { kind: "nail" as const, x: COLS * TILE / 2, y: Y + 6 }
    // when the back of his sheet gets to the nail
    const caught = 133
    const tear = 240
    const blinkyAt = (frame: number) => RIGHT_EDGE + 40 - frame * BLINKY_SPEED
    if (t < caught) return [nail, ...chase(t, 40).filter((sprite) => sprite.kind === "pac"), { kind: "blinky", x: blinkyAt(t), y: Y, dir: LEFT }]

    const pacX = RIGHT_EDGE - t * PAC_SPEED
    const pac: CutsceneSprite[] = pacX > LEFT_EDGE ? [{ kind: "pac", x: pacX, y: Y, dir: LEFT }] : []
    // stuck: goes on slower and slower while the sheet stretches
    const stuckAt = blinkyAt(caught)
    const pulled = Math.min(t, tear) - caught
    const x = stuckAt - 20 * (1 - Math.exp(-pulled / 40))
    if (t < tear) {
      return [nail, ...pac, { kind: "stretch", x: x + 7, y: Y, length: nail.x - x - 7 }, { kind: "blinky", x, y: Y, dir: LEFT }]
    }
    // torn: Blinky looks at the tear and then at us
    const look = t < tear + 90 ? "left" : t < tear + 180 ? "down" : "front"
    return [nail, { kind: "rag", x: nail.x, y: Y }, ...pac, { kind: "torn", x, y: Y, look }]
  }

  // act 3
  if (t < 300) {
    return chase(t, 30).map((sprite) => sprite.kind === "blinky" ? { kind: "patched", x: sprite.x, y: sprite.y } : sprite)
  }
  const nakedX = LEFT_EDGE - 10 + (t - 300) * .8
  return nakedX < RIGHT_EDGE + 16 ? [{ kind: "naked", x: nakedX, y: Y }] : []
}
