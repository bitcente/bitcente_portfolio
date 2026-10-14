export const COLS = 10
export const ROWS = 20

export type Status = "title" | "playing" | "paused" | "over"

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

// points per number of lines cleared at once, multiplied by the level
const LINE_SCORES = [0, 100, 300, 500, 800]
const LINES_PER_LEVEL = 10
// ms the cleared lines blink before they're gone
export const CLEAR_TIME = 260
// ms per row a piece falls at level 1, and while down is held
const BASE_SPEED = 800
const SOFT_DROP_SPEED = 45
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
  next = 0
  score = 0
  lines = 0
  level = 1
  status: Status = "title"
  // rows blinking before they're removed, and the ms they have left
  clearing: number[] = []
  clearTimer = 0
  softDrop = false
  // called when something the hud shows has changed
  onChange?: () => void

  private bag: number[] = []
  private dropTimer = 0

  constructor() {
    this.reset()
  }

  private reset() {
    this.board = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0))
    this.piece = null
    this.bag = []
    this.next = this.draw()
    this.score = 0
    this.lines = 0
    this.level = 1
    this.clearing = []
    this.dropTimer = 0
    this.softDrop = false
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

  private spawn() {
    const type = this.next
    const cells = PIECES[type]
    this.next = this.draw()
    this.piece = { type, cells, x: Math.floor((COLS - cells.length) / 2), y: type === 0 ? -1 : 0 }
    this.dropTimer = 0

    if (!this.fits(cells, this.piece.x, this.piece.y)) {
      this.piece = null
      this.status = "over"
    }
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
    this.softDrop = false
    this.onChange?.()
  }

  togglePause() {
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
    if (this.busy) return
    const piece = this.piece!
    if (this.fits(piece.cells, piece.x + dx, piece.y)) piece.x += dx
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
    const y = this.landingY()
    this.score += (y - piece.y) * 2
    piece.y = y
    this.lock()
  }

  private lock() {
    const piece = this.piece!
    piece.cells.forEach((row, cy) => row.forEach((filled, cx) => {
      if (filled && piece.y + cy >= 0) this.board[piece.y + cy][piece.x + cx] = piece.type + 1
    }))
    this.piece = null

    this.clearing = this.board.flatMap((row, y) => (row.every(Boolean) ? [y] : []))
    if (this.clearing.length) {
      this.clearTimer = CLEAR_TIME
      this.onChange?.()
      return
    }
    this.spawn()
  }

  private clear() {
    const cleared = this.clearing.length
    this.board = this.board.filter((_, y) => !this.clearing.includes(y))
    while (this.board.length < ROWS) this.board.unshift(new Array<number>(COLS).fill(0))
    this.clearing = []

    this.score += LINE_SCORES[cleared] * this.level
    this.lines += cleared
    this.level = Math.floor(this.lines / LINES_PER_LEVEL) + 1
    this.spawn()
  }

  private step() {
    const piece = this.piece!
    if (this.fits(piece.cells, piece.x, piece.y + 1)) {
      piece.y++
      if (this.softDrop) {
        this.score++
        this.onChange?.()
      }
      return
    }
    this.lock()
  }

  update(delta: number) {
    if (this.status !== "playing") return

    if (this.clearing.length) {
      this.clearTimer -= delta
      if (this.clearTimer <= 0) this.clear()
      return
    }
    if (!this.piece) return

    const speed = Math.max(60, BASE_SPEED * Math.pow(.84, this.level - 1))
    const interval = this.softDrop ? Math.min(speed, SOFT_DROP_SPEED) : speed
    this.dropTimer += delta
    while (this.dropTimer >= interval && this.piece && !this.clearing.length) {
      this.dropTimer -= interval
      this.step()
    }
  }
}
