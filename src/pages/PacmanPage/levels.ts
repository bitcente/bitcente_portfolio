// How each level of the arcade plays (from The Pac-Man Dossier): speeds, time the ghosts stay blue, the fruit,
// when Blinky turns into "Cruise Elroy" and the times the ghosts go to their corners

export const FPS = 60
// px per frame of the speed every percentage is a part of (75.75 px a second)
export const FULL_SPEED = 75.75757625 / FPS

export type FruitKind = "cherry" | "strawberry" | "orange" | "apple" | "melon" | "galaxian" | "bell" | "key"

export interface Fruit {
  kind: FruitKind
  points: number
}

const FRUITS: Fruit[] = [
  { kind: "cherry", points: 100 },
  { kind: "strawberry", points: 300 },
  { kind: "orange", points: 500 },
  { kind: "orange", points: 500 },
  { kind: "apple", points: 700 },
  { kind: "apple", points: 700 },
  { kind: "melon", points: 1000 },
  { kind: "melon", points: 1000 },
  { kind: "galaxian", points: 2000 },
  { kind: "galaxian", points: 2000 },
  { kind: "bell", points: 3000 },
  { kind: "bell", points: 3000 },
]
export const fruitOf = (level: number): Fruit => FRUITS[level - 1] ?? { kind: "key", points: 5000 }

// seconds the ghosts stay blue, and how many times they flash before they're back to normal, from level 1 up
const FRIGHT = [[6, 5], [5, 5], [4, 5], [3, 5], [2, 5], [5, 5], [2, 5], [2, 5], [1, 3], [5, 5], [2, 5], [1, 3], [1, 3], [3, 5], [1, 3], [1, 3], [0, 0], [1, 3]]

export interface Level {
  // speeds as a part of FULL_SPEED
  pacman: number
  pacmanFright: number
  ghost: number
  ghostTunnel: number
  ghostFright: number
  // dots left when Blinky speeds up, and how fast he goes then (twice: Elroy 1 and Elroy 2)
  elroyDots: [number, number]
  elroySpeed: [number, number]
  // frames the ghosts are blue (0 they only turn around) and frames they flash at the end of it
  frightFrames: number
  flashes: number
  // frames of each period, scatter first, then chase and so on (the last chase goes on forever)
  modes: number[]
  // dots pinky, inky and clyde wait for in the house at the start of the level
  dotLimits: [number, number, number]
  // frames with no dot eaten that send the next ghost out of the house
  idleLimit: number
}

const s = (seconds: number) => Math.round(seconds * FPS)
const ELROY_DOTS = [20, 30, 40, 40, 40, 50, 50, 50, 60, 60, 60, 80, 80, 80, 100, 100, 100, 100]

export function levelOf(level: number): Level {
  const early = level === 1
  const second = level >= 2 && level <= 4
  const late = level >= 21
  const [frightSeconds, flashes] = FRIGHT[level - 1] ?? [0, 0]
  const elroy = ELROY_DOTS[level - 1] ?? 120

  return {
    pacman: early ? .8 : second || late ? .9 : 1,
    pacmanFright: early ? .9 : second ? .95 : 1,
    ghost: early ? .75 : second ? .85 : .95,
    ghostTunnel: early ? .4 : second ? .45 : .5,
    ghostFright: early ? .5 : second ? .55 : .6,
    elroyDots: [elroy, elroy / 2],
    elroySpeed: early ? [.8, .85] : second ? [.9, .95] : [1, 1.05],
    frightFrames: s(frightSeconds),
    flashes,
    modes: early
      ? [s(7), s(20), s(7), s(20), s(5), s(20), s(5)]
      : second
        ? [s(7), s(20), s(7), s(20), s(5), s(1033), 1]
        : [s(5), s(20), s(5), s(20), s(5), s(1037), 1],
    dotLimits: level === 1 ? [0, 30, 60] : level === 2 ? [0, 0, 50] : [0, 0, 0],
    idleLimit: level < 5 ? s(4) : s(3),
  }
}

// levels after which there's a cutscene, and which one
export function intermissionAfter(level: number): 1 | 2 | 3 | null {
  if (level === 2) return 1
  if (level === 5) return 2
  if (level === 9 || level === 13 || level === 17) return 3
  return null
}

// the last level: the counter of levels overflows and half the maze is garbage, it can't be finished
export const KILL_SCREEN = 256
