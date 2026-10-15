import { COLS, FRUIT_PLACE, MAZE_TOP, ROWS, SCREEN_HEIGHT, SCREEN_WIDTH, TILE, tileAt } from "./maze"
import { FruitKind, fruitOf, KILL_SCREEN } from "./levels"
import Pacman, {
  ATTRACT_CHASE_START, ATTRACT_ENERGIZER_X, DEATH_FRAMES, DEATH_START, Dir, FLASH_FRAMES, FLASH_HALF, LEFT,
  LEVEL_DONE_STILL, RIGHT, START_EMPTY_FRAMES, UP,
} from "./pacman"
import { cutscene, CutsceneSprite } from "./cutscenes"

// Draws the game the size of the arcade screen (224 x 288 px): the canvas is scaled up by a whole number so
// every px of the arcade is a sharp square. Every sprite is drawn here px by px, there's nothing to download

const FONT = "Tickerbit, monospace"
const BLACK = "#000000"
const WALL = "#2121ff"
const WALL_FLASH = "#dedeff"
const DOOR = "#ffb8ff"
const DOT = "#ffb8ae"
const YELLOW = "#ffff00"
const WHITE = "#dedeff"
const RED = "#ff0000"
const CYAN = "#00ffff"
const PINK = "#ffb8ff"
const BLUE = "#2121ff"
export const GHOST_COLORS = [RED, PINK, CYAN, "#ffb852"]
const NICKNAMES = ["SHADOW", "SPEEDY", "BASHFUL", "POKEY"]
const NAMES = ["BLINKY", "PINKY", "INKY", "CLYDE"]
// px of the screen over the maze
const TOP = MAZE_TOP * TILE

type Canvas = HTMLCanvasElement

function blank(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}

// a sprite from rows of characters, each one a colour of the palette ("." is see-through)
function bitmap(rows: string[], palette: Record<string, string>, canvas?: Canvas) {
  const result = canvas ?? blank(rows[0].length, rows.length)
  const ctx = result.getContext("2d")!
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (!palette[key]) return
    ctx.fillStyle = palette[key]
    ctx.fillRect(x, y, 1, 1)
  }))
  return result
}

const cache = new Map<string, Canvas>()
function cached(key: string, make: () => Canvas) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)!
}

/* MAZE */

// The walls are lines drawn a few px inside the wall tiles, following the corridors: the blocks inside the maze
// get a single line with round corners, the border of the maze a double line. Each line is the edge of the wall
// shrunk by some px (the px further than that from any corridor), with its corners rounded
function buildMaze(color: string) {
  const canvas = blank(SCREEN_WIDTH, ROWS * TILE)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = color

  // the ghost house is drawn on its own
  const house = (col: number, row: number) => col >= 10 && col <= 17 && row >= 12 && row <= 16
  const solid = (col: number, row: number) => tileAt(col, row) === "#" && !house(col, row)

  // walls joined to the outside of the maze are its border
  const outer = new Set<string>()
  const stack: [number, number][] = [[-2, -2]]
  while (stack.length) {
    const [col, row] = stack.pop()!
    const key = col + "," + row
    if (col < -2 || col > COLS + 1 || row < -2 || row > ROWS + 1 || outer.has(key) || !solid(col, row)) continue
    outer.add(key)
    stack.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1])
  }

  // px from each px of the screen (and a margin around it) to the closest corridor
  const MARGIN = 8
  const width = canvas.width + MARGIN * 2
  const height = canvas.height + MARGIN * 2
  const distance = new Float32Array(width * height)
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x = px - MARGIN + .5
      const y = py - MARGIN + .5
      const col = Math.floor(x / TILE)
      const row = Math.floor(y / TILE)
      let best = 99
      if (!solid(col, row)) best = 0
      else {
        for (let r = row - 2; r <= row + 2; r++) {
          for (let c = col - 2; c <= col + 2; c++) {
            if (solid(c, r)) continue
            const dx = Math.max(c * TILE - x, 0, x - (c + 1) * TILE)
            const dy = Math.max(r * TILE - y, 0, y - (r + 1) * TILE)
            best = Math.min(best, Math.hypot(dx, dy))
          }
        }
      }
      distance[py * width + px] = best
    }
  }

  // the wall shrunk by `inset` px, with its corners rounded `round` px
  const shrunk = (inset: number, round: number) => {
    const inside = new Uint8Array(width * height)
    const reach = Math.ceil(round)
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        search: for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const qx = px + dx
            const qy = py + dy
            if (qx < 0 || qy < 0 || qx >= width || qy >= height || dx * dx + dy * dy > round * round) continue
            if (distance[qy * width + qx] > inset + round) {
              inside[py * width + px] = 1
              break search
            }
          }
        }
      }
    }
    return inside
  }

  const lines: { inside: Uint8Array, border: boolean }[] = [
    { inside: shrunk(3.5, 3), border: false },
    { inside: shrunk(2.5, 1.5), border: true },
    { inside: shrunk(5.5, 1.5), border: true },
  ]
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const border = outer.has(Math.floor(x / TILE) + "," + Math.floor(y / TILE))
      const index = (y + MARGIN) * width + x + MARGIN
      const edge = lines.some(({ inside, border: forBorder }) => (
        forBorder === border && inside[index]
        && (!inside[index - 1] || !inside[index + 1] || !inside[index - width] || !inside[index + width])
      ))
      if (edge) ctx.fillRect(x, y, 1, 1)
    }
  }

  // ghost house: a double line around it, open at the top for the door
  const left = 10 * TILE
  const right = 18 * TILE - 1
  const top = 12 * TILE
  const bottom = 17 * TILE - 1
  const doorLeft = 13 * TILE
  const doorRight = 15 * TILE - 1
  ;[3, 6].forEach((inset) => {
    ctx.fillRect(left + inset, top + inset, doorLeft - left - inset, 1)
    ctx.fillRect(doorRight + 1, top + inset, right - inset - doorRight, 1)
    ctx.fillRect(left + inset, bottom - inset, right - left - inset * 2 + 1, 1)
    ctx.fillRect(left + inset, top + inset, 1, bottom - top - inset * 2 + 1)
    ctx.fillRect(right - inset, top + inset, 1, bottom - top - inset * 2 + 1)
  })
  ctx.fillRect(doorLeft - 1, top + 3, 1, 4)
  ctx.fillRect(doorRight + 1, top + 3, 1, 4)
  ctx.fillStyle = DOOR
  ctx.fillRect(doorLeft, top + 4, doorRight - doorLeft + 1, 2)
  return canvas
}

const maze = (flash: boolean) => cached("maze" + flash, () => buildMaze(flash ? WALL_FLASH : WALL))

const ENERGIZER = ["..####..", ".######.", "########", "########", "########", "########", ".######.", "..####.."]
const energizer = () => cached("energizer", () => bitmap(ENERGIZER, { "#": DOT }))

/* PACMAN */

// mouth (half its angle) of each frame of pacman eating, and the frames in the order they go
const MOUTHS = [.8, .4, 0, .4]
const ANGLES = [-Math.PI / 2, Math.PI, Math.PI / 2, 0]

function pacSprite(dir: Dir, mouth: number, size = 13) {
  return cached(`pac${ dir }${ mouth }${ size }`, () => {
    const canvas = blank(size, size)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = YELLOW
    const radius = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + .5 - radius
        const dy = y + .5 - radius
        if (dx * dx + dy * dy > radius * radius) continue
        let angle = Math.abs(Math.atan2(dy, dx) - ANGLES[dir])
        if (angle > Math.PI) angle = Math.PI * 2 - angle
        if (mouth > 0 && angle < mouth && dx * dx + dy * dy > .5) continue
        ctx.fillRect(x, y, 1, 1)
      }
    }
    return canvas
  })
}

// pacman eating, by the px he has moved
const pacFrame = (dir: Dir, travelled: number, size = 13) => pacSprite(dir, MOUTHS[Math.floor(travelled / 2) % 4], size)

// pacman dying: facing up, his mouth opens all the way round until he's gone, and then a little burst
function deathSprite(frame: number) {
  if (frame < 11) return pacSprite(UP, Math.PI * (frame + 1) / 11.5)
  return cached("burst" + frame, () => {
    const canvas = blank(13, 13)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = YELLOW
    const near = frame === 11 ? 2 : 4
    for (let ray = 0; ray < 8; ray++) {
      const angle = ray * Math.PI / 4
      for (let r = near; r < near + 2; r++) ctx.fillRect(Math.round(6 + Math.cos(angle) * r), Math.round(6 + Math.sin(angle) * r), 1, 1)
    }
    return canvas
  })
}

/* GHOSTS */

const GHOST_BODY = [
  ".....####.....",
  "...########...",
  "..##########..",
  ".############.",
  ".############.",
  ".############.",
  "##############",
  "##############",
  "##############",
  "##############",
  "##############",
  "##############",
]
// the skirt waves between two shapes
const GHOST_FEET = [
  ["##.###..###.##", "#...##..##...#"],
  ["####.####.####", ".##...##...##."],
]
const EYE_WHITE = [".##.", "####", "####", "####", ".##."]
// where the whites and the pupils of the eyes go, looking up, left, down, right (the Dir) and straight ahead
const EYES: Record<Dir | "front", { whites: number[][], pupils: number[][] }> = {
  0: { whites: [[2, 1], [8, 1]], pupils: [[3, 1], [9, 1]] },
  1: { whites: [[1, 3], [7, 3]], pupils: [[1, 5], [7, 5]] },
  2: { whites: [[2, 4], [8, 4]], pupils: [[3, 7], [9, 7]] },
  3: { whites: [[3, 3], [9, 3]], pupils: [[5, 5], [11, 5]] },
  front: { whites: [[2, 3], [8, 3]], pupils: [[3, 5], [9, 5]] },
}
const FRIGHT_FACE = [
  "", "", "", "", "",
  "....##..##....",
  "....##..##....",
  "", "",
  "..##..##..##..",
  ".#..##..##..#.",
]

function eyes(ctx: CanvasRenderingContext2D, look: Dir | "front") {
  const { whites, pupils } = EYES[look]
  whites.forEach(([x, y]) => EYE_WHITE.forEach((row, dy) => [...row].forEach((on, dx) => {
    if (on !== "#") return
    ctx.fillStyle = WHITE
    ctx.fillRect(x + dx, y + dy, 1, 1)
  })))
  ctx.fillStyle = BLUE
  pupils.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2))
}

function ghostBody(color: string, feet: number) {
  return bitmap([...GHOST_BODY, ...GHOST_FEET[feet]], { "#": color })
}

const ghostSprite = (id: number, look: Dir | "front", feet: number) => cached(`ghost${ id }${ look }${ feet }`, () => {
  const canvas = ghostBody(GHOST_COLORS[id], feet)
  eyes(canvas.getContext("2d")!, look)
  return canvas
})

// blue, or white flashing at the end
const frightSprite = (white: boolean, feet: number) => cached(`fright${ white }${ feet }`, () => {
  const canvas = ghostBody(white ? WHITE : BLUE, feet)
  return bitmap(FRIGHT_FACE.map((row) => row.padEnd(14, ".")), { "#": white ? RED : DOT }, canvas)
})

const eyesSprite = (dir: Dir) => cached("eyes" + dir, () => {
  const canvas = blank(14, 14)
  eyes(canvas.getContext("2d")!, dir)
  return canvas
})

/* FRUITS */

const FRUIT_PALETTE: Record<string, string> = {
  r: RED, w: "#ffffff", b: "#de9751", g: "#21de00", G: "#007f00", o: "#ffb851", y: YELLOW, c: CYAN, B: BLUE,
}

const FRUIT_ART: Partial<Record<FruitKind, string[]>> = {
  strawberry: [
    "....gwgg....",
    "...gggggg...",
    "..rrrggrrr..",
    ".rrwrrrrwrr.",
    ".rrrrrwrrrr.",
    ".rwrrrrrrwr.",
    ".rrrrwrrrrr.",
    "..rrrrrrwr..",
    "..rwrrrrrr..",
    "...rrrwrr...",
    "....rrrr....",
    ".....rr.....",
  ],
  galaxian: [
    ".....rr.....",
    "....rrrr....",
    "...yyyyyy...",
    "B..yyyyyy..B",
    "BB.yyyyyy.BB",
    "BBByyyyyyBBB",
    "BB..yyyy..BB",
    "B....yy....B",
    ".....yy.....",
    ".....yy.....",
    "............",
    "............",
  ],
  bell: [
    ".....yy.....",
    "....yyyy....",
    "...yyyyyy...",
    "..yyyywyyy..",
    "..yyywyyyy..",
    "..yyywyyyy..",
    ".yyyyyyyyyy.",
    ".yyyyyyyyyy.",
    "yyyyyyyyyyyy",
    "yyyyyyyyyyyy",
    "....cwwc....",
    ".....cc.....",
  ],
  key: [
    "...cccccc...",
    "..cc.cc.cc..",
    "..cccccccc..",
    "...cccccc...",
    ".....ww.....",
    ".....ww.....",
    ".....wwww...",
    ".....ww.....",
    ".....wwww...",
    ".....ww.....",
    ".....www....",
    "......w.....",
  ],
}

// the round fruits are drawn from circles
function roundFruit(kind: FruitKind) {
  const canvas = blank(12, 12)
  const ctx = canvas.getContext("2d")!
  const dot = (x: number, y: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, 1, 1)
  }
  const circle = (cx: number, cy: number, r: number, color: (x: number, y: number) => string) => {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) dot(x, y, color(x, y))
      }
    }
  }
  const line = (x0: number, y0: number, x1: number, y1: number, color: string) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = 0; i <= steps; i++) dot(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), color)
  }
  const { r, w, b, g, G, o } = FRUIT_PALETTE

  if (kind === "cherry") {
    line(3, 5, 10, 0, b)
    line(8, 6, 10, 0, b)
    line(10, 0, 11, 0, b)
    circle(3.5, 8, 3.2, () => r)
    circle(8.5, 9, 3.2, () => r)
    dot(2, 7, w)
    dot(7, 8, w)
  } else if (kind === "orange") {
    circle(6, 7, 5, () => o)
    dot(6, 2, b)
    ;[[7, 1], [8, 1], [9, 1], [8, 0]].forEach(([x, y]) => dot(x, y, g))
  } else if (kind === "apple") {
    circle(6, 7, 5, () => r)
    ctx.clearRect(5, 2, 2, 1)
    dot(6, 1, b)
    dot(7, 0, b)
    ;[[3, 5], [3, 6], [4, 4]].forEach(([x, y]) => dot(x, y, w))
  } else {
    circle(6, 6.5, 5.5, (x, y) => (x + y) % 4 === 0 ? G : g)
    ;[[4, 4], [7, 6], [5, 8], [8, 9]].forEach(([x, y]) => dot(x, y, w))
    dot(6, 0, b)
  }
  return canvas
}

const fruitSprite = (kind: FruitKind) => cached("fruit" + kind, () => {
  const art = FRUIT_ART[kind]
  return art ? bitmap(art, FRUIT_PALETTE) : roundFruit(kind)
})

/* TEXT */

// text on the grid of tiles of the screen, a character per tile like the arcade
function print(ctx: CanvasRenderingContext2D, text: string, col: number, row: number, color: string) {
  ctx.fillStyle = color
  ctx.font = `8px ${ FONT }`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ;[...text].forEach((char, i) => ctx.fillText(char, (col + i) * TILE + 4, row * TILE + 4.5))
}

// small text centred on a px of the screen (points)
function printAt(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.font = `7px ${ FONT }`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, x, y + .5)
}

// sprite centred on a px of the screen
function put(ctx: CanvasRenderingContext2D, sprite: Canvas, x: number, y: number) {
  ctx.drawImage(sprite, Math.round(x - Math.floor(sprite.width / 2)), Math.round(y - Math.floor(sprite.height / 2)))
}

/* SCREEN */

function drawHud(ctx: CanvasRenderingContext2D, game: Pacman) {
  const blink = game.status === "playing" && game.phase !== "attract" && Math.floor(game.frame / 16) % 2 === 1
  if (!blink) print(ctx, "1UP", 3, 0, WHITE)
  print(ctx, "HIGH SCORE", 9, 0, WHITE)
  const score = game.score ? String(game.score) : "00"
  print(ctx, score, 7 - score.length, 1, WHITE)
  const high = game.high ? String(game.high) : "00"
  print(ctx, high, 17 - high.length, 1, WHITE)
  // who holds it, while nobody is playing
  if (game.phase === "attract" && game.highName) print(ctx, game.highName, 18, 1, PINK)
}

// lives left and the fruits of the last levels, under the maze
function drawBottom(ctx: CanvasRenderingContext2D, game: Pacman) {
  const y = SCREEN_HEIGHT - TILE
  const starting = game.phase === "start" && game.timer < START_EMPTY_FRAMES
  const reserve = Math.min(5, starting ? game.lives : game.lives - 1)
  for (let i = 0; i < reserve; i++) put(ctx, pacSprite(LEFT, .4), 3 * TILE + i * 16, y)

  const first = Math.max(1, game.level - 6)
  for (let level = first; level <= Math.min(game.level, KILL_SCREEN - 1); level++) {
    put(ctx, fruitSprite(fruitOf(level).kind), SCREEN_WIDTH - 4 * TILE - (level - first) * 16, y)
  }
}

// the right half of the last level, the maze memory read as garbage
function drawKillScreen(ctx: CanvasRenderingContext2D) {
  const colors = [WALL, YELLOW, RED, CYAN, PINK, DOT, WHITE, "#ffb852", "#21de00"]
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>/-"
  ctx.fillStyle = BLACK
  ctx.fillRect(COLS / 2 * TILE, TOP, COLS / 2 * TILE, ROWS * TILE)
  for (let row = 0; row < ROWS; row++) {
    for (let col = COLS / 2; col < COLS; col++) {
      const hash = Math.abs(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1
      const color = colors[Math.floor(hash * 97) % colors.length]
      if (hash < .5) print(ctx, chars[Math.floor(hash * 1000) % chars.length], col, row + MAZE_TOP, color)
      else if (hash < .75) {
        ctx.fillStyle = color
        ctx.fillRect(col * TILE + 1, TOP + row * TILE + (Math.floor(hash * 40) % 6), 6, 2)
      }
    }
  }
}

function drawMaze(ctx: CanvasRenderingContext2D, game: Pacman) {
  const flashing = game.phase === "levelDone" && game.timer >= LEVEL_DONE_STILL
  const flashFrame = Math.floor((game.timer - LEVEL_DONE_STILL) / FLASH_FRAMES)
  if (!flashing || flashFrame < 8) ctx.drawImage(maze(flashing && flashFrame % 2 === 0), 0, TOP)

  // the energizers blink while playing
  const blinkOff = game.phase === "playing" && Math.floor(game.frame / 10) % 2 === 1
  game.dots.forEach((row, r) => row.forEach((dot, c) => {
    if (dot === 1) {
      ctx.fillStyle = DOT
      ctx.fillRect(c * TILE + 3, TOP + r * TILE + 3, 2, 2)
    } else if (dot === 2 && !blinkOff) {
      ctx.drawImage(energizer(), c * TILE, TOP + r * TILE)
    }
  }))
  if (game.level >= KILL_SCREEN) drawKillScreen(ctx)
}

// all but the one just eaten, which is its points for a moment
function drawGhosts(ctx: CanvasRenderingContext2D, game: Pacman, eaten?: number) {
  const feet = Math.floor(game.frame / 8) % 2
  // the last ones first, so Blinky is on top
  ;[...game.ghosts].reverse().forEach((ghost) => {
    if (ghost.id === eaten) return
    const y = ghost.y + TOP
    if (ghost.state === "eyes" || ghost.state === "entering") {
      put(ctx, eyesSprite(ghost.dir), ghost.x, y)
      return
    }
    if (ghost.frightened) {
      const white = game.flashing && Math.floor(game.frightTimer / FLASH_HALF) % 2 === 0
      put(ctx, frightSprite(white, feet), ghost.x, y)
      return
    }
    put(ctx, ghostSprite(ghost.id, ghost.dir, feet), ghost.x, y)
  })
}

function drawPlay(ctx: CanvasRenderingContext2D, game: Pacman) {
  const { phase, timer, pac } = game
  drawMaze(ctx, game)

  if (game.fruitTimer > 0) put(ctx, fruitSprite(fruitOf(game.level).kind), FRUIT_PLACE.x, FRUIT_PLACE.y + TOP)
  if (game.fruitScoreTimer > 0) printAt(ctx, String(fruitOf(game.level).points), FRUIT_PLACE.x, FRUIT_PLACE.y + TOP, PINK)

  const starting = phase === "start" && timer < START_EMPTY_FRAMES
  const ghostsShown = !starting && phase !== "gameOver"
    && !(phase === "dying" && timer >= DEATH_START)
    && !(phase === "levelDone" && timer >= LEVEL_DONE_STILL)
  if (ghostsShown) {
    const eaten = phase === "ghostEaten" ? game.eatenScore : null
    drawGhosts(ctx, game, eaten?.id)
    // and pacman isn't there meanwhile
    if (eaten) printAt(ctx, String(eaten.points), eaten.x, eaten.y + TOP, CYAN)
  }

  if (phase === "dying") {
    if (timer < DEATH_START) put(ctx, pacFrame(pac.dir, pac.travelled), pac.x, pac.y + TOP)
    else if (timer < DEATH_START + DEATH_FRAMES) put(ctx, deathSprite(Math.floor((timer - DEATH_START) / 8)), pac.x, pac.y + TOP)
  } else if (!starting && phase !== "gameOver" && phase !== "ghostEaten") {
    // round and closed until the game starts moving
    const sprite = phase === "start" || phase === "ready" ? pacSprite(pac.dir, 0) : pacFrame(pac.dir, pac.travelled)
    put(ctx, sprite, pac.x, pac.y + TOP)
  }

  if (phase === "start" && starting) print(ctx, "PLAYER ONE", 9, 14, CYAN)
  if (phase === "start" || phase === "ready") print(ctx, "READY!", 11, 20, YELLOW)
  if (phase === "gameOver") print(ctx, "GAME OVER", 9, 20, RED)
}

/* ATTRACT */

function drawAttract(ctx: CanvasRenderingContext2D, game: Pacman, touch: boolean) {
  const t = game.timer
  const chase = game.attract
  const feet = Math.floor(game.frame / 8) % 2

  if (t >= 30) print(ctx, "CHARACTER / NICKNAME", 6, 5, WHITE)
  GHOST_COLORS.forEach((color, i) => {
    const start = 60 + i * 90
    const row = 7 + i * 3
    if (t >= start) put(ctx, ghostSprite(i, RIGHT, 0), 4 * TILE, row * TILE + 4)
    if (t >= start + 30) print(ctx, "-" + NICKNAMES[i], 7, row, color)
    if (t >= start + 60) print(ctx, `"${ NAMES[i] }"`, 17, row, color)
  })

  const blinkOff = Math.floor(game.frame / 10) % 2 === 1
  if (t >= 440) {
    ctx.fillStyle = DOT
    ctx.fillRect(10 * TILE + 3, 25 * TILE + 3, 2, 2)
    print(ctx, "10", 12, 25, WHITE)
    print(ctx, "PTS", 15, 25, WHITE)
    if (!blinkOff) ctx.drawImage(energizer(), 10 * TILE, 27 * TILE)
    print(ctx, "50", 12, 27, WHITE)
    print(ctx, "PTS", 15, 27, WHITE)
  }
  if (t >= 500) {
    print(ctx, "© BITCENTE 2026", 6, 31, PINK)
    if (!chase.frightened && !blinkOff) ctx.drawImage(energizer(), ATTRACT_ENERGIZER_X - 4, 20 * TILE)
  }

  if (t >= ATTRACT_CHASE_START) {
    const y = 20 * TILE + 4
    chase.ghosts.forEach((ghost, i) => {
      if (ghost.eaten || ghost.x > SCREEN_WIDTH + 16) return
      put(ctx, chase.frightened ? frightSprite(false, feet) : ghostSprite(i, LEFT, feet), ghost.x, y)
    })
    if (chase.score) printAt(ctx, String(chase.score.points), chase.score.x, y, CYAN)
    else if (chase.pacX < SCREEN_WIDTH + 16) put(ctx, pacFrame(chase.pacDir < 0 ? LEFT : RIGHT, game.frame), chase.pacX, y)
  }

  if (Math.floor(game.frame / 30) % 2 === 0) {
    const prompt = touch ? "TAP TO START" : "PRESS ENTER"
    print(ctx, prompt, Math.floor((COLS - prompt.length) / 2), 33, YELLOW)
  }
}

/* CUTSCENES */

function drawCutsceneSprite(ctx: CanvasRenderingContext2D, sprite: CutsceneSprite, t: number) {
  const feet = Math.floor(t / 8) % 2
  const y = sprite.y + TOP
  switch (sprite.kind) {
    case "pac":
      put(ctx, pacFrame(sprite.dir as Dir, t * 1.25), sprite.x, y)
      break
    case "bigPac":
      put(ctx, pacSprite(RIGHT, MOUTHS[Math.floor(t / 6) % 4], 32), sprite.x, y)
      break
    case "blinky":
      put(ctx, sprite.blue ? frightSprite(false, feet) : ghostSprite(0, sprite.dir as Dir, feet), sprite.x, y)
      break
    case "nail":
      ctx.fillStyle = DOT
      ctx.fillRect(sprite.x - 1, y - 1, 3, 1)
      ctx.fillRect(sprite.x, y, 1, 4)
      break
    case "stretch": {
      // the sheet gets thinner the more it's pulled
      ctx.fillStyle = RED
      const length = Math.max(0, Math.round(sprite.length))
      for (let i = 0; i < length; i++) {
        const height = Math.max(1, Math.round(5 - 4 * i / Math.max(1, length)))
        ctx.fillRect(sprite.x + i, y + 6 - height, 1, height)
      }
      break
    }
    case "rag":
      ctx.fillStyle = RED
      ctx.fillRect(sprite.x - 1, y + 1, 3, 2)
      ctx.fillRect(sprite.x, y + 3, 2, 2)
      break
    case "torn":
      put(ctx, cached("torn" + sprite.look, () => {
        const canvas = ghostBody(RED, 0)
        const c = canvas.getContext("2d")!
        // the sheet is gone at the back, a leg shows
        c.clearRect(10, 9, 4, 5)
        c.fillStyle = DOT
        c.fillRect(10, 10, 2, 4)
        eyes(c, sprite.look === "left" ? LEFT : sprite.look === "down" ? RIGHT : "front")
        return canvas
      }), sprite.x, y)
      break
    case "patched":
      put(ctx, cached("patched" + feet, () => {
        const canvas = ghostBody(RED, feet)
        const c = canvas.getContext("2d")!
        eyes(c, LEFT)
        // the mended tear
        c.fillStyle = DOT
        c.fillRect(9, 9, 4, 3)
        c.fillStyle = RED
        c.fillRect(10, 10, 1, 1)
        c.fillRect(12, 9, 1, 1)
        return canvas
      }), sprite.x, y)
      break
    case "naked": {
      // just a red little body with legs, dragging the sheet behind
      const x = Math.round(sprite.x)
      ctx.fillStyle = RED
      ctx.fillRect(x - 24, y + 2, 12, 4)
      ctx.fillRect(x - 22, y, 6, 2)
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 24 + i * 3, y + 6, 2, 1)
      ctx.fillRect(x - 12, y + 3, 6, 1)
      ctx.fillRect(x - 6, y - 3, 10, 6)
      ctx.fillStyle = WHITE
      ctx.fillRect(x, y - 2, 3, 3)
      ctx.fillStyle = BLUE
      ctx.fillRect(x + 1, y - 1, 2, 2)
      ctx.fillStyle = DOT
      const step = Math.floor(t / 6) % 2
      ;[-5, -1, 3].forEach((leg, i) => ctx.fillRect(x + leg + ((i + step) % 2), y + 3, 1, 3))
      break
    }
  }
}

function drawIntermission(ctx: CanvasRenderingContext2D, game: Pacman) {
  const act = game.intermission ?? 1
  cutscene(act, game.timer).forEach((sprite) => drawCutsceneSprite(ctx, sprite, game.timer))
}

export function drawGame(ctx: CanvasRenderingContext2D, game: Pacman, touch: boolean) {
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = BLACK
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
  drawHud(ctx, game)

  if (game.phase === "attract") return drawAttract(ctx, game, touch)
  if (game.phase === "intermission") drawIntermission(ctx, game)
  else drawPlay(ctx, game)
  drawBottom(ctx, game)
}

// the maze takes a moment to make, better before the first game
export function prepareSprites() {
  maze(false)
  maze(true)
}
