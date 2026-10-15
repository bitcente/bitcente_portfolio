export const COLS = 10
export const ROWS = 20

export type Status = "title" | "playing" | "paused" | "over"

// things that happen in the game and have a sound
export type GameSound = "move" | "rotate" | "land" | "line" | "pause" | "over"

// I, O, T, S, Z, J, L
const PIECES: number[][][] = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
]

// Points only come from lines: each one is worth LINE_POINTS times the level, times the bonus. Lines made one
// after the other (in the same piece or in pieces placed one after the other) raise the bonus by COMBO_STEP each,
// a piece that makes no line takes it back to x1
const LINE_POINTS = 100
const COMBO_STEP = .5
// bonus of the line number `combo` of a streak (1 is the first)
export const comboMultiplier = (combo: number) => 1 + COMBO_STEP * Math.max(0, combo - 1)
const LINES_PER_LEVEL = 10
// ms the cleared lines blink before they're gone
export const CLEAR_TIME = 260
// pieces shown coming next
export const QUEUE_SIZE = 3
// ms per row a piece falls at level 1, and while down is held
const BASE_SPEED = 800
// on top of the levels, every new piece falls a bit faster than the one before
const SPEED_UP_PER_PIECE = .997
const SOFT_DROP_SPEED = 45
// holding left or right: ms before the piece starts sliding on its own, and ms between each step after that
// (instead of the key repeat of the system, which is slow and different everywhere)
const SHIFT_DELAY = 150
const SHIFT_REPEAT = 45
// ms a piece can still be moved and rotated once it touches the floor before it's locked, and how many times
// moving or rotating it starts that time again (so it can't be kept from locking forever)
const LOCK_DELAY = 1000
const LOCK_RESETS = 15
// tried in order when a rotation doesn't fit where the piece is
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]

export interface Piece {
  type: number
  cells: number[][]
  x: number
  y: number
}

export const shapeOf = (type: number) => PIECES[type]

function rotated(cells: number[][], direction: number) {
  const size = cells.length
  return cells.map((row, y) => row.map((_, x) => (
    direction > 0 ? cells[size - 1 - x][y] : cells[x][size - 1 - y]
  )))
}

export default class Tetris {
  // 0 is empty, anything else is the type of the piece that left the block there, plus 1
  board: number[][] = []
  piece: Piece | null = null
  // pieces coming next, the first one is the next to fall
  queue: number[] = []
  // piece kept aside to swap with the one falling, null until the first one is kept
  hold: number | null = null
  score = 0
  lines = 0
  level = 1
  status: Status = "title"
  // rows blinking before they're removed, and the ms they have left
  clearing: number[] = []
  clearTimer = 0
  softDrop = false
  // lines made in a row, 0 when the last piece made none
  combo = 0
  // ms spent playing this game, pauses not counted
  playTime = 0
  // called when something the hud shows has changed
  onChange?: () => void
  // called when lines are made, with how many and the combo they took it to
  onLines?: (lines: number, combo: number) => void
  // lines come with the combo they take the streak to, so they can sound higher the bigger the bonus
  onSound?: (sound: GameSound, combo?: number) => void

  private bag: number[] = []
  private dropTimer = 0
  // pieces that have fallen this game, each one a bit faster
  private pieces = 0
  // left and right being held, the last one pressed wins
  private held: number[] = []
  private shiftTime = 0
  private shiftNext = 0
  // ms left before the piece on the floor locks (null while it isn't on the floor)
  private lockTimer: number | null = null
  private lockResets = 0

  constructor() {
    this.reset()
  }

  private reset() {
    this.board = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0))
    this.piece = null
    this.bag = []
    this.queue = Array.from({ length: QUEUE_SIZE }, () => this.draw())
    this.pieces = 0
    this.hold = null
    this.score = 0
    this.lines = 0
    this.level = 1
    this.combo = 0
    this.clearing = []
    this.dropTimer = 0
    this.releaseAll()
    this.playTime = 0
  }

  // every piece shows up once before any of them repeats
  private draw() {
    if (!this.bag.length) {
      this.bag = PIECES.map((_, type) => type)
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]
      }
    }
    return this.bag.pop()!
  }

  private fits(cells: number[][], x: number, y: number) {
    return cells.every((row, cy) => row.every((filled, cx) => {
      if (!filled) return true
      const column = x + cx
      const line = y + cy
      if (column < 0 || column >= COLS || line >= ROWS) return false
      // pieces come in from above the board
      return line < 0 || !this.board[line][column]
    }))
  }

  // a piece at the top of the board, in its starting position
  private entering(type: number): Piece {
    const cells = PIECES[type]
    return { type, cells, x: Math.floor((COLS - cells.length) / 2), y: type === 0 ? -1 : 0 }
  }

  private place(piece: Piece) {
    this.piece = piece
    this.dropTimer = 0
    this.lockTimer = null
    this.lockResets = 0
  }

  private spawn() {
    const piece = this.entering(this.queue.shift()!)
    this.queue.push(this.draw())
    this.pieces++
    this.place(piece)

    if (!this.fits(piece.cells, piece.x, piece.y)) {
      this.piece = null
      this.status = "over"
      this.onSound?.("over")
    }
    this.onChange?.()
  }

  // keeps the falling piece aside and brings the one kept before (or the next one, the first time) to the top
  swapHold() {
    if (this.busy) return
    const current = this.piece!.type
    if (this.hold === null) {
      this.hold = current
      this.spawn()
      return
    }
    const piece = this.entering(this.hold)
    // no room for it up there: nothing changes
    if (!this.fits(piece.cells, piece.x, piece.y)) return
    this.hold = current
    this.place(piece)
    this.onChange?.()
  }

  start() {
    this.reset()
    this.status = "playing"
    this.spawn()
  }

  pause() {
    if (this.status !== "playing") return
    this.status = "paused"
    this.releaseAll()
    this.onChange?.()
  }

  // paused and resumed by the player (the game pausing itself when nobody is looking makes no sound)
  togglePause() {
    if (this.status !== "paused" && this.status !== "playing") return
    this.onSound?.("pause")
    if (this.status === "paused") {
      this.status = "playing"
      this.onChange?.()
      return
    }
    this.pause()
  }

  private get busy() {
    return this.status !== "playing" || !this.piece || this.clearing.length > 0
  }

  move(dx: number) {
    if (this.busy) return false
    const piece = this.piece!
    if (!this.fits(piece.cells, piece.x + dx, piece.y)) return false
    piece.x += dx
    this.moved()
    this.onSound?.("move")
    return true
  }

  // left (-1) or right (1) pressed: one step now, and sliding on its own while it's held
  press(dx: number) {
    this.held = [...this.held.filter((held) => held !== dx), dx]
    this.shiftTime = 0
    this.shiftNext = SHIFT_DELAY
    this.move(dx)
  }

  release(dx: number) {
    this.held = this.held.filter((held) => held !== dx)
    // still holding the other one: it slides that way, but only after the delay
    this.shiftTime = 0
    this.shiftNext = SHIFT_DELAY
  }

  releaseAll() {
    this.held = []
    this.softDrop = false
  }

  // a piece on the floor that is moved or rotated gets its time to lock again
  private moved() {
    if (this.lockTimer === null || this.lockResets >= LOCK_RESETS) return
    this.lockTimer = LOCK_DELAY
    this.lockResets++
  }

  rotate(direction: number) {
    if (this.busy) return
    const piece = this.piece!
    const cells = rotated(piece.cells, direction)
    const kick = KICKS.find(([dx, dy]) => this.fits(cells, piece.x + dx, piece.y + dy))
    if (!kick) return
    piece.cells = cells
    piece.x += kick[0]
    piece.y += kick[1]
    this.moved()
    this.onSound?.("rotate")
  }

  // row the piece would land on if it was dropped right now
  landingY() {
    const piece = this.piece
    if (!piece) return 0
    let y = piece.y
    while (this.fits(piece.cells, piece.x, y + 1)) y++
    return y
  }

  hardDrop() {
    if (this.busy) return
    const piece = this.piece!
    piece.y = this.landingY()
    this.lock()
  }

  private lock() {
    const piece = this.piece!
    piece.cells.forEach((row, cy) => row.forEach((filled, cx) => {
      if (filled && piece.y + cy >= 0) this.board[piece.y + cy][piece.x + cx] = piece.type + 1
    }))
    this.piece = null

    this.clearing = this.board.flatMap((row, y) => (row.every(Boolean) ? [y] : []))
    // lines have their sound, no lines just the piece landing
    if (this.clearing.length) this.onSound?.("line", this.combo + this.clearing.length)
    else this.onSound?.("land")
    if (this.clearing.length) {
      this.clearTimer = CLEAR_TIME
      this.onChange?.()
      return
    }
    // the streak is over
    this.combo = 0
    this.spawn()
  }

  private clear() {
    const cleared = this.clearing.length
    this.board = this.board.filter((_, y) => !this.clearing.includes(y))
    while (this.board.length < ROWS) this.board.unshift(new Array<number>(COLS).fill(0))
    this.clearing = []

    for (let line = 0; line < cleared; line++) {
      this.combo++
      this.score += Math.round(LINE_POINTS * this.level * comboMultiplier(this.combo))
    }
    this.onLines?.(cleared, this.combo)
    this.lines += cleared
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1
    this.spawn()
  }

  // one row down, false when it's already on the floor
  private step() {
    const piece = this.piece!
    if (!this.fits(piece.cells, piece.x, piece.y + 1)) return false
    piece.y++
    return true
  }

  update(delta: number) {
    if (this.status !== "playing") return
    this.playTime += delta

    if (this.clearing.length) {
      this.clearTimer -= delta
      if (this.clearTimer <= 0) this.clear()
      return
    }
    if (!this.piece) return

    // sliding while left or right is held
    const dx = this.held[this.held.length - 1]
    if (dx) {
      this.shiftTime += delta
      while (this.shiftTime >= this.shiftNext) {
        this.shiftNext += SHIFT_REPEAT
        if (!this.move(dx)) break
      }
    }

    const speed = Math.max(60, BASE_SPEED * Math.pow(.84, this.level - 1) * Math.pow(SPEED_UP_PER_PIECE, this.pieces))
    const interval = this.softDrop ? Math.min(speed, SOFT_DROP_SPEED) : speed
    this.dropTimer += delta
    while (this.dropTimer >= interval) {
      this.dropTimer -= interval
      if (!this.step()) {
        this.dropTimer = 0
        break
      }
    }

    // on the floor it waits a moment before it locks, so it can still be slid or turned into place
    const piece = this.piece
    if (this.fits(piece.cells, piece.x, piece.y + 1)) {
      this.lockTimer = null
      return
    }
    this.lockTimer = (this.lockTimer ?? LOCK_DELAY) - delta
    if (this.lockTimer <= 0) this.lock()
  }
}
