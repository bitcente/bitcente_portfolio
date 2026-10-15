import {
  center, COLS, DOOR_Y, freshDots, FRUIT_PLACE, HOUSE_Y, inTunnel, isOpen, MIDDLE_X, noUpTurn, PACMAN_START, TILE,
  tileOf, TOTAL_DOTS,
} from "./maze"
import { FPS, fruitOf, FULL_SPEED, intermissionAfter, KILL_SCREEN, Level, levelOf } from "./levels"
import { CUTSCENE_FRAMES } from "./cutscenes"

// The arcade game, frame by frame at 60 frames a second like the original. Nothing here draws or plays anything:
// draw.ts draws it and sound.ts plays what onSound says

export type Dir = 0 | 1 | 2 | 3
export const UP: Dir = 0
export const LEFT: Dir = 1
export const DOWN: Dir = 2
export const RIGHT: Dir = 3
// also the order the ghosts prefer when two ways are as good
export const DX = [0, -1, 0, 1]
export const DY = [-1, 0, 1, 0]
export const opposite = (dir: Dir) => ((dir + 2) % 4) as Dir

export type Status = "title" | "playing" | "paused" | "over"
// what the machine is doing: the attract screen, the jingle before the first level, READY!, playing, the moment
// a ghost is eaten, pacman dying, the maze flashing once cleared, a cutscene, or GAME OVER
export type Phase = "attract" | "start" | "ready" | "playing" | "ghostEaten" | "dying" | "levelDone" | "intermission" | "gameOver"
export type GameSound = "intro" | "waka" | "fruit" | "ghost" | "death" | "extraLife" | "intermission"
// sound that goes on all the time while playing
export type Ambient = "none" | "siren" | "fright" | "eyes"

export const BLINKY = 0
export const PINKY = 1
export const INKY = 2
export const CLYDE = 3

// frames of each phase
export const START_FRAMES = 258
// of those, the first ones only say PLAYER ONE, without pacman and the ghosts
export const START_EMPTY_FRAMES = 120
const READY_FRAMES = 120
const GHOST_EATEN_FRAMES = 60
// the ghosts stop for a moment before pacman dies, and some time after
export const DEATH_START = 60
export const DEATH_FRAMES = 96
const DEATH_END = DEATH_START + DEATH_FRAMES + 30
// still for a moment, then the maze flashes
export const LEVEL_DONE_STILL = 60
export const FLASH_FRAMES = 12
const LEVEL_DONE_FRAMES = LEVEL_DONE_STILL + FLASH_FRAMES * 8 + 24
const GAME_OVER_FRAMES = 180
// frames the points of an eaten fruit stay
const FRUIT_SCORE_FRAMES = 120
// half a cycle of the blue ghosts flashing at the end
export const FLASH_HALF = 14

const EXTRA_LIFE_AT = 10000
const START_LIVES = 3
// corners the ghosts go to while scattering, outside of the maze (tiles)
const SCATTER: [number, number][] = [[25, -3], [2, -3], [27, 32], [0, 32]]
// tile the eyes of an eaten ghost head for, right over the door
const HOUSE_DOOR_TILE: [number, number] = [13, 11]
// where each ghost goes back to inside the house
const HOME_X = [MIDDLE_X, MIDDLE_X, MIDDLE_X - 2 * TILE, MIDDLE_X + 2 * TILE]
// how far the ghosts waiting in the house bob up and down
const BOB = 4

const mod = (n: number, m: number) => ((n % m) + m) % m

export class Actor {
  x = 0
  y = 0
  dir: Dir = LEFT
  // part of a px moved but not taken yet
  progress = 0

  get col() { return tileOf(this.x) }
  get row() { return tileOf(this.y) }
  get centered() { return mod(this.x, TILE) === 4 && mod(this.y, TILE) === 4 }

  place(x: number, y: number, dir: Dir) {
    this.x = x
    this.y = y
    this.dir = dir
    this.progress = 0
  }

  // one px, coming back from the other side of the tunnel
  advance() {
    this.x += DX[this.dir]
    this.y += DY[this.dir]
    if (this.x < -TILE) this.x += COLS * TILE + 2 * TILE
    if (this.x >= COLS * TILE + TILE) this.x -= COLS * TILE + 2 * TILE
  }
}

export class Pac extends Actor {
  // px moved, for the mouth
  travelled = 0
  // frames it stops after eating
  stall = 0
}

export type GhostState = "house" | "leaving" | "active" | "eyes" | "entering"

export class Ghost extends Actor {
  state: GhostState = "house"
  frightened = false
  // turns around as soon as it can
  reverse = false
  // dots eaten while it's the next one to leave the house
  dots = 0
  constructor(public id: number) {
    super()
  }
}

// the chase of the attract screen: pacman eats an energizer and then the four ghosts
export interface AttractChase {
  pacX: number
  pacDir: number
  ghosts: { x: number, eaten: boolean }[]
  frightened: boolean
  combo: number
  freeze: number
  // points of the ghost just eaten, where it was
  score: { points: number, x: number } | null
  // frame it finished
  done: number
}

// the frames of the attract screen: names of the ghosts first, then the chase
export const ATTRACT_CHASE_START = 560
export const ATTRACT_ENERGIZER_X = center(4)
const ATTRACT_LOOP = 160

// random numbers that come out the same in every game, like the ones the blue ghosts use in the arcade
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state >> 16
  }
}

export default class Pacman {
  status: Status = "title"
  phase: Phase = "attract"
  // frames into the phase, and since the machine was turned on
  timer = 0
  frame = 0

  level = 1
  score = 0
  high = 0
  // who made the high score, when it comes from the leaderboard (null once this game beats it)
  highName: string | null = null
  // pacman being played counts
  lives = START_LIVES
  extraLife = false
  // ms played, pauses not counted
  playTime = 0

  dots = freshDots()
  dotsLeft = TOTAL_DOTS
  dotsEaten = 0

  pac = new Pac()
  ghosts = [BLINKY, PINKY, INKY, CLYDE].map((id) => new Ghost(id))
  // the scatter and chase periods: even indexes scatter
  modeIndex = 0
  modeTimer = 0
  frightTimer = 0
  // ghosts eaten with the same energizer
  combo = 0
  // after a life is lost the ghosts leave the house with one counter for all, until clyde is out
  globalDots: number | null = null
  // frames since the last dot was eaten
  idle = 0
  // after a life is lost Blinky stops being Elroy until clyde is out of the house
  elroySuspended = false
  fruitTimer = 0
  fruitScoreTimer = 0
  // points of the ghost just eaten, shown where it was while everything stops
  eatenScore: { points: number, x: number, y: number, id: number } | null = null
  intermission: 1 | 2 | 3 | null = null
  attract: AttractChase = this.newChase()
  // way the player is pushing the joystick
  desired: Dir | null = null

  settings: Level = levelOf(1)
  private rng = random(1)
  private pending = 0

  onChange?: () => void
  onSound?: (sound: GameSound) => void

  start() {
    this.score = 0
    this.level = 1
    this.lives = START_LIVES
    this.extraLife = false
    this.playTime = 0
    this.desired = null
    this.setupLevel()
    this.resetActors()
    this.setPhase("start")
    this.status = "playing"
    this.onSound?.("intro")
    this.onChange?.()
  }

  // back to the attract screen
  reset() {
    this.status = "title"
    this.setPhase("attract")
    this.attract = this.newChase()
    this.onChange?.()
  }

  pause() {
    if (this.status !== "playing") return
    this.status = "paused"
    this.onChange?.()
  }

  togglePause() {
    if (this.status === "paused") this.status = "playing"
    else if (this.status === "playing") this.status = "paused"
    else return
    this.onChange?.()
  }

  steer(dir: Dir | null) {
    this.desired = dir
  }

  // runs the frames that fit in the ms since the last call
  update(ms: number) {
    if (this.status === "paused") return
    if (this.status === "playing") this.playTime += ms
    this.pending += ms
    const step = 1000 / FPS
    while (this.pending >= step) {
      this.pending -= step
      this.tick()
    }
  }

  // Cruise Elroy: Blinky gets faster (1, then 2) when few dots are left, and chases even while the others scatter
  get elroy() {
    if (this.elroySuspended) return 0
    const [first, second] = this.settings.elroyDots
    return this.dotsLeft <= second ? 2 : this.dotsLeft <= first ? 1 : 0
  }

  get scattering() {
    return this.modeIndex % 2 === 0
  }

  // the blue ghosts flash white at the end
  get flashing() {
    return this.frightTimer > 0 && this.frightTimer <= this.settings.flashes * FLASH_HALF * 2
  }

  ambient(): Ambient {
    if (this.status !== "playing" || (this.phase !== "playing" && this.phase !== "ghostEaten")) return "none"
    if (this.ghosts.some((ghost) => ghost.state === "eyes" || ghost.state === "entering")) return "eyes"
    if (this.frightTimer > 0) return "fright"
    return "siren"
  }

  // how high the siren goes, higher with less dots left (0 to 4)
  get sirenStage() {
    const eaten = TOTAL_DOTS - this.dotsLeft
    return Math.min(4, Math.floor(eaten / (TOTAL_DOTS / 5)))
  }

  private setPhase(phase: Phase) {
    this.phase = phase
    this.timer = 0
  }

  private setupLevel() {
    this.settings = levelOf(this.level)
    this.dots = freshDots()
    this.dotsLeft = TOTAL_DOTS
    this.dotsEaten = 0
    // the right half of the last level is garbage: its dots can't be eaten, so it never ends
    if (this.level >= KILL_SCREEN) this.dots.forEach((row) => row.fill(0, COLS / 2))
    this.ghosts.forEach((ghost) => { ghost.dots = 0 })
    this.globalDots = null
    this.elroySuspended = false
    this.fruitTimer = 0
    this.fruitScoreTimer = 0
  }

  private resetActors() {
    this.pac.place(PACMAN_START.x, PACMAN_START.y, LEFT)
    this.pac.stall = 0
    this.pac.travelled = 0
    const [blinky, pinky, inky, clyde] = this.ghosts
    blinky.place(MIDDLE_X, DOOR_Y, LEFT)
    blinky.state = "active"
    pinky.place(MIDDLE_X, HOUSE_Y, DOWN)
    inky.place(HOME_X[INKY], HOUSE_Y, UP)
    clyde.place(HOME_X[CLYDE], HOUSE_Y, UP)
    ;[pinky, inky, clyde].forEach((ghost) => { ghost.state = "house" })
    this.ghosts.forEach((ghost) => {
      ghost.frightened = false
      ghost.reverse = false
    })
    this.modeIndex = 0
    this.modeTimer = this.settings.modes[0]
    this.frightTimer = 0
    this.idle = 0
    this.fruitTimer = 0
    this.eatenScore = null
  }

  private tick() {
    this.frame++
    this.timer++

    switch (this.phase) {
      case "attract":
        this.attractTick()
        break
      case "start":
        if (this.timer >= START_FRAMES) this.setPhase("playing")
        break
      case "ready":
        if (this.timer >= READY_FRAMES) this.setPhase("playing")
        break
      case "playing":
        this.playTick()
        break
      case "ghostEaten":
        if (this.timer >= GHOST_EATEN_FRAMES) {
          this.eatenScore = null
          this.setPhase("playing")
        }
        break
      case "dying":
        if (this.timer === DEATH_START) this.onSound?.("death")
        if (this.timer >= DEATH_END) this.afterDeath()
        break
      case "levelDone":
        if (this.timer >= LEVEL_DONE_FRAMES) {
          this.intermission = intermissionAfter(this.level)
          if (this.intermission) {
            this.setPhase("intermission")
            this.onSound?.("intermission")
          } else this.nextLevel()
        }
        break
      case "intermission":
        if (this.timer >= CUTSCENE_FRAMES[this.intermission ?? 1]) this.nextLevel()
        break
      case "gameOver":
        if (this.timer >= GAME_OVER_FRAMES && this.status === "playing") {
          this.status = "over"
          this.onChange?.()
        }
        break
    }
  }

  private nextLevel() {
    this.intermission = null
    this.level++
    this.setupLevel()
    this.resetActors()
    this.setPhase("ready")
  }

  private afterDeath() {
    this.lives--
    this.onChange?.()
    if (this.lives <= 0) {
      this.setPhase("gameOver")
      return
    }
    this.resetActors()
    this.globalDots = 0
    this.elroySuspended = true
    this.setPhase("ready")
  }

  private playTick() {
    const settings = this.settings

    // the scatter and chase periods only run while the ghosts aren't blue, and they turn around with each change
    if (this.frightTimer === 0 && this.modeIndex < settings.modes.length) {
      if (--this.modeTimer <= 0) {
        this.modeIndex++
        this.modeTimer = settings.modes[this.modeIndex] ?? Infinity
        this.reverseGhosts()
      }
    }
    if (this.frightTimer > 0 && --this.frightTimer === 0) {
      this.ghosts.forEach((ghost) => { ghost.frightened = false })
    }

    this.releaseGhosts()

    this.movePac()
    if (this.phase !== "playing") return
    if (this.collide()) return

    this.ghosts.forEach((ghost) => {
      ghost.progress += this.ghostSpeed(ghost)
      while (ghost.progress >= 1) {
        ghost.progress--
        this.stepGhost(ghost)
      }
    })
    if (this.collide()) return

    if (this.fruitTimer > 0) {
      this.fruitTimer--
      if (this.pac.row === tileOf(FRUIT_PLACE.y) && Math.abs(this.pac.x - FRUIT_PLACE.x) <= 4) {
        this.fruitTimer = 0
        this.fruitScoreTimer = FRUIT_SCORE_FRAMES
        this.addScore(fruitOf(this.level).points)
        this.onSound?.("fruit")
      }
    }
    if (this.fruitScoreTimer > 0) this.fruitScoreTimer--
  }

  private addScore(points: number) {
    this.score += points
    if (this.score > this.high) {
      this.high = this.score
      this.highName = null
    }
    if (!this.extraLife && this.score >= EXTRA_LIFE_AT) {
      this.extraLife = true
      this.lives++
      this.onSound?.("extraLife")
    }
  }

  /* PACMAN */

  private movePac() {
    const pac = this.pac
    if (pac.stall > 0) {
      pac.stall--
      return
    }
    const speed = this.frightTimer > 0 ? this.settings.pacmanFright : this.settings.pacman
    pac.progress += speed * FULL_SPEED
    while (pac.progress >= 1) {
      pac.progress--
      if (this.stepPac()) pac.travelled++
    }
    this.eat()
  }

  // one px. Turns can be taken a few px before or after the centre of the tile, cutting the corner (cornering):
  // pacman moves along both ways at once until it's back in the middle of the corridor
  private stepPac() {
    const pac = this.pac
    const want = this.desired
    if (want !== null && want !== pac.dir) {
      if (want === opposite(pac.dir) || isOpen(pac.col + DX[want], pac.row + DY[want])) pac.dir = want
    }
    if (pac.centered && !isOpen(pac.col + DX[pac.dir], pac.row + DY[pac.dir])) return false

    pac.advance()
    if (DX[pac.dir] === 0) pac.x -= Math.sign(mod(pac.x, TILE) - 4)
    else pac.y -= Math.sign(mod(pac.y, TILE) - 4)
    return true
  }

  private eat() {
    const { col, row } = this.pac
    const dot = this.dots[row]?.[col]
    if (!dot) return
    this.dots[row][col] = 0
    this.dotsLeft--
    this.dotsEaten++
    this.idle = 0
    // stops for a frame on every dot, three on an energizer
    this.pac.stall = dot === 2 ? 3 : 1
    this.addScore(dot === 2 ? 50 : 10)
    this.onSound?.("waka")

    if (this.globalDots !== null) this.globalDots++
    else {
      const next = this.nextToLeave()
      if (next) next.dots++
    }
    if (this.dotsEaten === 70 || this.dotsEaten === 170) this.fruitTimer = Math.round(FPS * 9.33) + (this.rng() % 40)
    if (dot === 2) this.energize()

    if (this.dotsLeft === 0) {
      this.fruitTimer = 0
      this.setPhase("levelDone")
    }
  }

  private energize() {
    this.combo = 0
    const { frightFrames } = this.settings
    this.frightTimer = frightFrames
    this.ghosts.forEach((ghost) => {
      if (ghost.state === "active") ghost.reverse = true
      if (frightFrames > 0 && ghost.state !== "eyes" && ghost.state !== "entering") ghost.frightened = true
    })
  }

  // pacman and a ghost in the same tile (checked after each moves, so they can still go through each other now
  // and then, like in the arcade)
  private collide() {
    const pac = this.pac
    for (const ghost of this.ghosts) {
      if (ghost.state !== "active" || ghost.col !== pac.col || ghost.row !== pac.row) continue
      if (ghost.frightened) {
        this.combo++
        const points = 200 * 2 ** (this.combo - 1)
        this.addScore(points)
        this.eatenScore = { points, x: ghost.x, y: ghost.y, id: ghost.id }
        ghost.frightened = false
        ghost.state = "eyes"
        this.onSound?.("ghost")
        this.setPhase("ghostEaten")
        return true
      }
      this.fruitTimer = 0
      this.setPhase("dying")
      return true
    }
    return false
  }

  /* GHOSTS */

  private nextToLeave() {
    return [PINKY, INKY, CLYDE].map((id) => this.ghosts[id]).find((ghost) => ghost.state === "house")
  }

  // the ghosts leave the house as pacman eats dots: each one waits for its own count (or, after a life is lost,
  // for a count for all of them), and one goes out anyway whenever pacman goes a while without eating
  private releaseGhosts() {
    const [, pinky, inky, clyde] = this.ghosts
    const next = this.nextToLeave()
    if (this.globalDots !== null) {
      if (this.globalDots === 7 && pinky.state === "house") pinky.state = "leaving"
      else if (this.globalDots === 17 && inky.state === "house") inky.state = "leaving"
      else if (this.globalDots === 32 && clyde.state === "house") this.globalDots = null
    } else if (next && next.dots >= this.settings.dotLimits[next.id - 1]) {
      next.state = "leaving"
    }

    if (++this.idle >= this.settings.idleLimit) {
      this.idle = 0
      const waiting = this.nextToLeave()
      if (waiting) waiting.state = "leaving"
    }
  }

  private reverseGhosts() {
    this.ghosts.forEach((ghost) => {
      if (ghost.state === "active") ghost.reverse = true
    })
  }

  private ghostSpeed(ghost: Ghost) {
    const settings = this.settings
    let speed = settings.ghost
    if (ghost.state === "eyes" || ghost.state === "entering") speed = 2
    else if (ghost.state === "house" || ghost.state === "leaving") speed = .5
    else if (inTunnel(ghost.col, ghost.row)) speed = settings.ghostTunnel
    else if (ghost.frightened) speed = settings.ghostFright
    else if (ghost.id === BLINKY && this.elroy) speed = settings.elroySpeed[this.elroy - 1]
    return speed * FULL_SPEED
  }

  private stepGhost(ghost: Ghost) {
    switch (ghost.state) {
      case "house":
        if (ghost.y <= HOUSE_Y - BOB) ghost.dir = DOWN
        if (ghost.y >= HOUSE_Y + BOB) ghost.dir = UP
        ghost.y += DY[ghost.dir]
        return

      case "leaving":
        // to the middle of the house, then up through the door
        if (ghost.x !== MIDDLE_X && ghost.y !== HOUSE_Y) {
          ghost.dir = ghost.y > HOUSE_Y ? UP : DOWN
          ghost.y += DY[ghost.dir]
        } else if (ghost.x !== MIDDLE_X) {
          ghost.dir = ghost.x > MIDDLE_X ? LEFT : RIGHT
          ghost.x += DX[ghost.dir]
        } else if (ghost.y > DOOR_Y) {
          ghost.dir = UP
          ghost.y--
        } else {
          ghost.state = "active"
          ghost.dir = LEFT
          if (ghost.id === CLYDE) this.elroySuspended = false
        }
        return

      case "entering":
        // the eyes go down into the house and back to their place, where the ghost comes back to life
        if (ghost.y < HOUSE_Y) {
          ghost.dir = DOWN
          ghost.y++
        } else if (ghost.x !== HOME_X[ghost.id]) {
          ghost.dir = ghost.x > HOME_X[ghost.id] ? LEFT : RIGHT
          ghost.x += DX[ghost.dir]
        } else {
          ghost.state = "leaving"
        }
        return

      default:
        if (ghost.reverse) {
          ghost.reverse = false
          ghost.dir = opposite(ghost.dir)
        }
        if (ghost.centered) this.steerGhost(ghost)
        ghost.advance()
        if (ghost.state === "eyes" && ghost.x === MIDDLE_X && ghost.y === DOOR_Y) {
          ghost.state = "entering"
          ghost.dir = DOWN
        }
    }
  }

  // at the centre of every tile a ghost picks where to go: never back, and the way that leaves it closest (in a
  // straight line) to its target. Blue ghosts pick at random
  private steerGhost(ghost: Ghost) {
    const { col, row } = ghost
    const blue = ghost.frightened
    const options = ([UP, LEFT, DOWN, RIGHT] as Dir[]).filter((dir) => (
      dir !== opposite(ghost.dir)
      && isOpen(col + DX[dir], row + DY[dir])
      && !(dir === UP && ghost.state === "active" && !blue && noUpTurn(col, row))
    ))
    if (!options.length) {
      ghost.dir = opposite(ghost.dir)
      return
    }
    if (blue) {
      let dir = (this.rng() & 3) as Dir
      while (!options.includes(dir)) dir = ((dir + 1) % 4) as Dir
      ghost.dir = dir
      return
    }

    const [targetCol, targetRow] = this.targetOf(ghost)
    let best = Infinity
    options.forEach((dir) => {
      const distance = (col + DX[dir] - targetCol) ** 2 + (row + DY[dir] - targetRow) ** 2
      if (distance < best) {
        best = distance
        ghost.dir = dir
      }
    })
  }

  // tile n tiles in front of pacman. Facing up it's also n tiles to the left: a bug of the arcade, kept
  private ahead(n: number): [number, number] {
    const { col, row, dir } = this.pac
    return [col + DX[dir] * n - (dir === UP ? n : 0), row + DY[dir] * n]
  }

  targetOf(ghost: Ghost): [number, number] {
    if (ghost.state === "eyes") return HOUSE_DOOR_TILE
    const pac = this.pac
    const chasing = !this.scattering || (ghost.id === BLINKY && this.elroy > 0)
    if (!chasing) return SCATTER[ghost.id]

    switch (ghost.id) {
      // Blinky (Shadow) goes straight for pacman
      case BLINKY:
        return [pac.col, pac.row]
      // Pinky (Speedy) for 4 tiles in front of him
      case PINKY:
        return this.ahead(4)
      // Inky (Bashful): twice the way from Blinky to 2 tiles in front of pacman
      case INKY: {
        const [col, row] = this.ahead(2)
        const blinky = this.ghosts[BLINKY]
        return [col * 2 - blinky.col, row * 2 - blinky.row]
      }
      // Clyde (Pokey) chases while he's far, and goes to his corner when he gets within 8 tiles
      default: {
        const far = (ghost.col - pac.col) ** 2 + (ghost.row - pac.row) ** 2 > 64
        return far ? [pac.col, pac.row] : SCATTER[CLYDE]
      }
    }
  }

  /* ATTRACT */

  private newChase(): AttractChase {
    return {
      pacX: COLS * TILE + 12,
      pacDir: -1,
      ghosts: [0, 1, 2, 3].map((i) => ({ x: COLS * TILE + 36 + i * 18, eaten: false })),
      frightened: false,
      combo: 0,
      freeze: 0,
      score: null,
      done: 0,
    }
  }

  private attractTick() {
    const chase = this.attract
    if (chase.done && this.timer > chase.done + ATTRACT_LOOP) {
      this.attract = this.newChase()
      this.timer = 0
      return
    }
    if (this.timer < ATTRACT_CHASE_START || chase.done) return
    if (chase.freeze > 0) {
      if (--chase.freeze === 0) chase.score = null
      return
    }

    chase.pacX += chase.pacDir * FULL_SPEED * (chase.frightened ? .9 : .8)
    chase.ghosts.forEach((ghost) => {
      if (!ghost.eaten) ghost.x += FULL_SPEED * (chase.frightened ? .5 : -.85)
    })

    if (!chase.frightened && chase.pacX <= ATTRACT_ENERGIZER_X) {
      chase.frightened = true
      chase.pacDir = 1
    }
    if (chase.frightened) {
      const caught = chase.ghosts.find((ghost) => !ghost.eaten && Math.abs(ghost.x - chase.pacX) < 4)
      if (caught) {
        caught.eaten = true
        chase.combo++
        chase.score = { points: 200 * 2 ** (chase.combo - 1), x: caught.x }
        chase.freeze = GHOST_EATEN_FRAMES
      }
      if (chase.ghosts.every((ghost) => ghost.eaten) && chase.pacX > COLS * TILE + 16) chase.done = this.timer
    }
  }
}
