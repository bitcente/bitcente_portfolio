import { useEffect, useMemo, useRef, useState } from "react"
import { useArcadeStore, usePlaying } from "../../arcade/store"
import { isTouchDevice } from "../../utils/Screen"
import Tetris, { CLEAR_TIME, COLS, ROWS, shapeOf } from "./tetris"
import "./tetris.css"

// the 4 greens of the web, from dark to light
const PALETTE = ["#0D1403", "#576833", "#7F8E5A", "#A8B987"]
const BOARD_COLOR = "#97a876"
// ms between repeats while a touch button is held
const TOUCH_REPEAT = 90

type Action = "left" | "right" | "down" | "rotate" | "drop"

// biggest block that lets the whole board fit next to (or, in portrait, under) the hud
function blockSize() {
  const portrait = window.innerWidth < window.innerHeight * .8
  const width = window.innerWidth * (portrait ? .62 : .36)
  const height = window.innerHeight * (portrait ? .56 : .8)
  return Math.max(8, Math.floor(Math.min(width / COLS, height / ROWS)))
}

// each piece is drawn with one of 3 patterns, the way a 4 tone screen tells them apart
function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, type: number) {
  const gap = Math.max(1, Math.round(size * .06))
  const inner = size - gap * 2
  ctx.fillStyle = PALETTE[0]
  ctx.fillRect(x + gap, y + gap, inner, inner)

  const pattern = type % 3
  if (pattern === 0) {
    const inset = Math.round(size * .3)
    ctx.fillStyle = PALETTE[1]
    ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2)
  } else if (pattern === 1) {
    const inset = Math.round(size * .22)
    ctx.fillStyle = PALETTE[3]
    ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2)
  } else {
    const inset = Math.round(size * .16)
    const dot = Math.round(size * .38)
    ctx.fillStyle = PALETTE[2]
    ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2)
    ctx.fillStyle = PALETTE[0]
    ctx.fillRect(x + dot, y + dot, size - dot * 2, size - dot * 2)
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, game: Tetris, size: number) {
  ctx.fillStyle = BOARD_COLOR
  ctx.fillRect(0, 0, COLS * size, ROWS * size)

  // the cleared lines blink before they go
  const blink = game.clearing.length > 0 && Math.floor(game.clearTimer / (CLEAR_TIME / 4)) % 2 === 0
  game.board.forEach((row, y) => {
    if (blink && game.clearing.includes(y)) return
    row.forEach((block, x) => {
      if (block) drawBlock(ctx, x * size, y * size, size, block - 1)
    })
  })

  const piece = game.piece
  if (!piece) return

  // outline of where the piece is going to land
  const landing = game.landingY()
  const line = Math.max(1, Math.round(size * .08))
  ctx.strokeStyle = PALETTE[1]
  ctx.lineWidth = line
  piece.cells.forEach((row, cy) => row.forEach((filled, cx) => {
    if (!filled || landing + cy < 0) return
    ctx.strokeRect((piece.x + cx) * size + line * 1.5, (landing + cy) * size + line * 1.5, size - line * 3, size - line * 3)
  }))

  piece.cells.forEach((row, cy) => row.forEach((filled, cx) => {
    if (filled && piece.y + cy >= 0) drawBlock(ctx, (piece.x + cx) * size, (piece.y + cy) * size, size, piece.type)
  }))
}

// canvas with as many real pixels as the screen has, so the blocks stay sharp
function prepare(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.min(window.devicePixelRatio, 2)
  if (canvas.width !== width * ratio) canvas.width = width * ratio
  if (canvas.height !== height * ratio) canvas.height = height * ratio
  canvas.style.width = width + "px"
  canvas.style.height = height + "px"
  const ctx = canvas.getContext("2d")
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}

const hudOf = (game: Tetris) => ({
  score: game.score,
  lines: game.lines,
  level: game.level,
  status: game.status,
  next: game.next,
})

export default function TetrisPage() {
  const game = useMemo(() => new Tetris(), [])
  const [hud, setHud] = useState(() => hudOf(game))
  const [size, setSize] = useState(blockSize)

  const boardRef = useRef<HTMLCanvasElement>(null)
  const nextRef = useRef<HTMLCanvasElement>(null)

  const touch = isTouchDevice()
  // the keyboard is only for this game while its arcade machine is the one being played
  const playing = usePlaying()

  const startOrResume = () => {
    if (game.status === "paused") game.togglePause()
    else if (game.status !== "playing") game.start()
  }

  const act = (action: Action) => {
    if (action === "left") game.move(-1)
    if (action === "right") game.move(1)
    if (action === "rotate") game.rotate(1)
    if (action === "drop") game.hardDrop()
  }

  useEffect(() => {
    game.onChange = () => setHud(hudOf(game))
    return () => { game.onChange = undefined }
  }, [game])

  useEffect(() => {
    const resize = () => setSize(blockSize())
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  // game loop
  useEffect(() => {
    const canvas = boardRef.current
    if (!canvas) return
    const ctx = prepare(canvas, COLS * size, ROWS * size)
    if (!ctx) return

    let frame = 0
    let last = performance.now()
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      // a long frame (tab in the background...) doesn't make the piece fall all at once
      game.update(Math.min(time - last, 100))
      last = time
      drawBoard(ctx, game, size)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [game, size])

  // next piece, centred in its box
  useEffect(() => {
    const canvas = nextRef.current
    if (!canvas) return
    const block = Math.max(6, Math.round(size * .7))
    const ctx = prepare(canvas, block * 4, block * 2)
    if (!ctx) return

    ctx.clearRect(0, 0, block * 4, block * 2)
    if (hud.status === "title") return
    const rows = shapeOf(hud.next).filter((row) => row.some(Boolean))
    const columns = shapeOf(hud.next)[0].map((_, x) => x).filter((x) => rows.some((row) => row[x]))
    const left = (4 - columns.length) / 2 - columns[0]
    const top = (2 - rows.length) / 2
    rows.forEach((row, y) => row.forEach((filled, x) => {
      if (filled) drawBlock(ctx, (left + x) * block, (top + y) * block, block, hud.next)
    }))
  }, [hud.next, hud.status, size])

  useEffect(() => {
    if (!playing) return

    const down = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (game.status !== "playing") {
        if (e.repeat) return
        // not space: the last drop of a lost game would start the next one right away
        if (key === "Enter" || (key === "p" && game.status === "paused")) startOrResume()
        return
      }

      if (key === "ArrowLeft" || key === "a") game.move(-1)
      if (key === "ArrowRight" || key === "d") game.move(1)
      if (key === "ArrowDown" || key === "s") game.softDrop = true
      if (e.repeat) return
      if (key === "ArrowUp" || key === "w" || key === "x") game.rotate(1)
      if (key === "z") game.rotate(-1)
      if (key === " ") game.hardDrop()
      if (key === "p") game.togglePause()
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") game.softDrop = false
    }
    const blur = () => { game.softDrop = false }

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [game, playing])

  // nobody is at the machine once the player steps back into the arcade room, plays another one or leaves the tab
  useEffect(() => {
    if (!playing) game.pause()
  }, [game, playing])
  useEffect(() => {
    const unsubscribe = useArcadeStore.subscribe((state) => {
      if (!state.settled) game.pause()
    })
    const hidden = () => { if (document.hidden) game.pause() }
    document.addEventListener("visibilitychange", hidden)
    return () => {
      unsubscribe()
      document.removeEventListener("visibilitychange", hidden)
    }
  }, [game])

  // a held touch button repeats, like a held key does
  const repeat = useRef<number>()
  const release = () => {
    clearInterval(repeat.current)
    game.softDrop = false
  }
  const press = (action: Action) => {
    release()
    if (action === "down") {
      game.softDrop = true
      return
    }
    act(action)
    if (action === "left" || action === "right") repeat.current = window.setInterval(() => act(action), TOUCH_REPEAT)
  }
  useEffect(() => release, [])

  const button = (action: Action, label: string, name: string) => (
    <button
      className={ "tetris__button tetris__button--" + action }
      aria-label={ name }
      onPointerDown={ (e) => { e.preventDefault(); press(action) } }
      onPointerUp={ release }
      onPointerLeave={ release }
      onPointerCancel={ release }
    >
      { label }
    </button>
  )

  return (
    <div className="tetris">
      <div className="tetris__game">
        <div className="tetris__board">
          <canvas ref={ boardRef }></canvas>

          { hud.status !== "playing" && <div className="tetris__overlay" onClick={ startOrResume }>
            { hud.status === "title" && <span className="title-m">Tetris</span> }
            { hud.status === "paused" && <span className="title-s">Paused</span> }
            { hud.status === "over" && <>
              <span className="title-s">Game over</span>
              <span className="text-m">Score { hud.score }</span>
            </> }
            <span className="text-m blink">
              { touch ? "Tap" : "Press enter" } to { hud.status === "paused" ? "continue" : hud.status === "over" ? "play again" : "start" }
            </span>
          </div> }
        </div>

        <div className="tetris__hud">
          <div className="tetris__stat tetris__stat--next">
            <span className="text-s green-2">Next</span>
            <canvas ref={ nextRef }></canvas>
          </div>
          <div className="tetris__stat">
            <span className="text-s green-2">Score</span>
            <span className="title-s">{ hud.score }</span>
          </div>
          <div className="tetris__stat">
            <span className="text-s green-2">Lines</span>
            <span className="title-s">{ hud.lines }</span>
          </div>
          <div className="tetris__stat">
            <span className="text-s green-2">Level</span>
            <span className="title-s">{ hud.level }</span>
          </div>
        </div>
      </div>

      { !touch && <div className="tetris__keys text-s green-2">
        ← → Move · ↑ Rotate · ↓ Soft drop · Space Drop · P Pause
      </div> }

      { touch && <div className="tetris__controls">
        { button("left", "←", "Move left") }
        { button("right", "→", "Move right") }
        { button("down", "↓", "Soft drop") }
        { button("rotate", "↻", "Rotate") }
        { button("drop", "⤓", "Drop") }
      </div> }
    </div>
  )
}
