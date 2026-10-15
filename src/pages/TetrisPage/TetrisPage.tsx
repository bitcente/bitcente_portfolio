import { useEffect, useMemo, useRef, useState } from "react"
import { useArcadeStore, usePlaying } from "../../arcade/store"
import { isTouchDevice } from "../../utils/Screen"
import { makesTheBoard, useLeaderboard } from "../../leaderboard"
import Tetris, { CLEAR_TIME, COLS, QUEUE_SIZE, ROWS, shapeOf } from "./tetris"
import NameEntry, { Letters, lettersToName, NAME_LENGTH, nameKey } from "./NameEntry"
import { popBonus, shake } from "./effects"
import { SpeakerIcon, useMuteButton } from "../../components/MuteButton"
import { Sound, soundBoard } from "../../classes/SoundBoard"
import type { GameSound } from "./tetris"
import "./tetris.css"

// the 4 greens of the web, from dark to light
const PALETTE = ["#0D1403", "#576833", "#7F8E5A", "#A8B987"]
const BOARD_COLOR = "#97a876"
type Action = "left" | "right" | "down" | "rotate" | "drop" | "hold"

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

// volume most of the sounds play at, and the one of a piece landing, which is heard all the time
const QUIET = .45
const QUIETEST = .2

// music while a game is being played (not paused), looped
const MUSIC = "/audio/tetris/tetris_music.mp3"
const MUSIC_VOLUME = .15

// semitones the line sound goes up with every step of the bonus, and the most it can go up (two octaves)
const LINE_PITCH_STEP = 2
const MAX_LINE_PITCH = 24

// sound and volume (0 to 1) of what happens in the game. Moving and rotating are silent
const SOUNDS: Partial<Record<GameSound, [Sound, number]>> = {
  land: [Sound.TetrisLand, QUIETEST],
  line: [Sound.TetrisLine, QUIET],
  pause: [Sound.TetrisPause, QUIET],
  over: [Sound.TetrisGameOver, QUIET],
}

// a piece centred in a box 4 blocks wide and 2 high, or the box empty
function drawPreview(canvas: HTMLCanvasElement | null, type: number | null, size: number) {
  if (!canvas) return
  const block = Math.max(6, Math.round(size * .7))
  const ctx = prepare(canvas, block * 4, block * 2)
  if (!ctx) return
  ctx.clearRect(0, 0, block * 4, block * 2)
  if (type === null) return

  const rows = shapeOf(type).filter((row) => row.some(Boolean))
  const columns = shapeOf(type)[0].map((_, x) => x).filter((x) => rows.some((row) => row[x]))
  const left = (4 - columns.length) / 2 - columns[0]
  const top = (2 - rows.length) / 2
  rows.forEach((row, y) => row.forEach((filled, x) => {
    if (filled) drawBlock(ctx, (left + x) * block, (top + y) * block, block, type)
  }))
}

const hudOf = (game: Tetris) => ({
  score: game.score,
  lines: game.lines,
  level: game.level,
  status: game.status,
  queue: [...game.queue],
  hold: game.hold,
})

// what the game over screen shows: nothing yet (checking the leaderboard), the name entry for a score that made
// it, the score being saved, or the leaderboard
type Ending = "checking" | "entry" | "saving" | "board"

export default function TetrisPage() {
  const game = useMemo(() => new Tetris(), [])
  const [hud, setHud] = useState(() => hudOf(game))
  const [size, setSize] = useState(blockSize)

  const boardRef = useRef<HTMLCanvasElement>(null)
  const queueRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const boardWrapRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLCanvasElement>(null)

  const touch = isTouchDevice()
  const mute = useMuteButton()
  // the keyboard is only for this game while its arcade machine is the one being played
  const playing = usePlaying()
  const settled = useArcadeStore((state) => state.settled)
  const onScreen = useRef(true)
  onScreen.current = playing || !settled

  const scores = useLeaderboard((state) => state.scores)
  const leaderboardStatus = useLeaderboard((state) => state.status)
  const [ending, setEnding] = useState<Ending>("checking")
  const [letters, setLetters] = useState<Letters>(() => new Array(NAME_LENGTH).fill(0))
  const [cursor, setCursor] = useState(0)
  // position the last score got on the leaderboard, and why it couldn't be saved
  const [rank, setRank] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const startOrResume = () => {
    if (game.status === "paused") game.togglePause()
    else if (game.status !== "playing") game.start()
  }

  const saveScore = () => {
    setEnding("saving")
    useLeaderboard.getState().submit({
      name: lettersToName(letters),
      score: game.score,
      lines: game.lines,
      level: game.level,
      duration: game.playTime / 1000,
    })
      .then(setRank)
      .catch((error: Error) => setSaveError(error.message))
      .finally(() => setEnding("board"))
  }

  // the game over screen can't be skipped while the name is being written or saved
  const canRestart = hud.status !== "over" || ending === "board"

  // a new game right away, whatever is going on (but not while a name is being written or saved)
  const restart = () => {
    if (!canRestart) return
    music.currentTime = 0
    game.start()
  }

  useEffect(() => {
    game.onChange = () => setHud(hudOf(game))
    // the bonus pops out and the board shakes, harder the bigger the bonus
    game.onLines = (lines, combo) => {
      const board = boardWrapRef.current
      if (!board) return
      popBonus(board, combo - lines, combo)
      shake(board, combo)
    }
    // straight to the sound board, every sound of a sliding piece counts
    game.onSound = (sound, combo) => {
      const entry = SOUNDS[sound]
      if (!entry) return
      // higher for every step of the bonus
      const semitones = combo ? Math.min((combo - 1) * LINE_PITCH_STEP, MAX_LINE_PITCH) : 0
      soundBoard().play(...entry, Math.pow(2, semitones / 12))
    }
    return () => {
      game.onChange = undefined
      game.onLines = undefined
      game.onSound = undefined
    }
  }, [game])

  // only downloaded once somebody actually plays (this page is also loaded by everyone visiting the portfolio)
  const music = useMemo(() => {
    const audio = soundBoard().track(new Audio(MUSIC))
    audio.loop = true
    audio.volume = MUSIC_VOLUME
    audio.preload = "none"
    return audio
  }, [])
  useEffect(() => () => music.pause(), [music])

  // plays while the game runs, stops with it paused (also when the player leaves the machine or the tab) and
  // starts over with every new game
  useEffect(() => {
    if (hud.status === "playing") music.play().catch(() => {})
    else music.pause()
    if (hud.status === "over" || hud.status === "title") music.currentTime = 0
  }, [hud.status, music])

  // loaded before they're needed, so the first move isn't silent
  useEffect(() => {
    Object.values(SOUNDS).forEach(([sound]) => { soundBoard().loadSound(sound).catch(() => {}) })
  }, [])

  useEffect(() => {
    if (useLeaderboard.getState().status === "idle") useLeaderboard.getState().refresh()
  }, [])

  // at the end of a game, the latest leaderboard says whether the score makes it
  useEffect(() => {
    if (hud.status !== "over") return
    setEnding("checking")
    setRank(null)
    setSaveError(null)
    setCursor(0)
    let alive = true
    useLeaderboard.getState().refresh().then(() => {
      if (alive) setEnding(makesTheBoard(game.score) ? "entry" : "board")
    })
    return () => { alive = false }
  }, [hud.status])

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
      // nothing to draw while another arcade machine is being played and this page is hidden
      if (onScreen.current) drawBoard(ctx, game, size)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [game, size])

  // next piece and the one kept aside, each centred in its box
  useEffect(() => {
    // the first one at full size, the ones after it smaller
    queueRefs.current.forEach((canvas, i) => {
      drawPreview(canvas, hud.status === "title" ? null : hud.queue[i], i ? size * .6 : size)
    })
  }, [hud.queue.join(), hud.status, size])
  useEffect(() => {
    drawPreview(holdRef.current, hud.hold, size)
  }, [hud.hold, size])

  useEffect(() => {
    if (!playing) return

    const down = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (game.status !== "playing") {
        if (game.status === "over" && ending === "entry") {
          if (e.key === "Enter") return saveScore()
          const next = nameKey(e.key, letters, cursor)
          if (next) {
            e.preventDefault()
            setLetters(next[0])
            setCursor(next[1])
          }
          return
        }
        if (e.repeat || !canRestart) return
        // not space: the last drop of a lost game would start the next one right away
        if (key === "Enter" || (key === "p" && game.status === "paused")) startOrResume()
        if (key === "r" && game.status === "paused") restart()
        return
      }

      // the game slides the piece itself while left or right is held, the key repeat of the system is ignored
      if (e.repeat) return
      if (key === "ArrowLeft" || key === "a") game.press(-1)
      if (key === "ArrowRight" || key === "d") game.press(1)
      if (key === "ArrowDown" || key === "s") game.softDrop = true
      if (key === "ArrowUp" || key === "w" || key === "x") game.rotate(1)
      if (key === "z") game.rotate(-1)
      if (key === " ") game.hardDrop()
      if (key === "p") game.togglePause()
      if (key === "r") restart()
      if (e.key === "Shift" || key === "c") game.swapHold()
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === "ArrowLeft" || key === "a") game.release(-1)
      if (key === "ArrowRight" || key === "d") game.release(1)
      if (key === "ArrowDown" || key === "s") game.softDrop = false
    }
    const blur = () => game.releaseAll()

    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [game, playing, ending, letters, cursor, canRestart])

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

  // touch buttons work like the keys: left and right slide the piece while held, down drops it faster
  const press = (action: Action) => {
    if (action === "left") game.press(-1)
    if (action === "right") game.press(1)
    if (action === "down") game.softDrop = true
    if (action === "rotate") game.rotate(1)
    if (action === "drop") game.hardDrop()
    if (action === "hold") game.swapHold()
  }
  const release = (action: Action) => {
    if (action === "left") game.release(-1)
    if (action === "right") game.release(1)
    if (action === "down") game.softDrop = false
  }
  useEffect(() => () => game.releaseAll(), [game])

  const button = (action: Action, label: string, name: string) => (
    <button
      className={ "tetris__button tetris__button--" + action }
      aria-label={ name }
      onPointerDown={ (e) => { e.preventDefault(); press(action) } }
      onPointerUp={ () => release(action) }
      onPointerLeave={ () => release(action) }
      onPointerCancel={ () => release(action) }
    >
      { label }
    </button>
  )

  return (
    <div className="tetris">
      <div className="tetris__game">
        <div className="tetris__side">
          <div className="tetris__stat tetris__stat--hold">
            <span className="text-s green-2">Hold</span>
            <canvas ref={ holdRef }></canvas>
          </div>
        </div>

        <div className="tetris__board" ref={ boardWrapRef }>
          <canvas ref={ boardRef }></canvas>

          { hud.status !== "playing" && <div className="tetris__overlay" onClick={ () => canRestart && startOrResume() }>
            { hud.status === "title" && <span className="title-m">Tetris</span> }
            { hud.status === "paused" && <span className="title-s">Paused</span> }

            { hud.status === "over" && ending === "checking" && <>
              <span className="title-s">Game over</span>
              <span className="text-m">Score { hud.score }</span>
            </> }
            { hud.status === "over" && ending === "entry" && <>
              <span className="title-s">New high score!</span>
              <span className="text-m">{ hud.score }</span>
              <span className="text-s">Enter your name</span>
              <NameEntry
                letters={ letters }
                cursor={ cursor }
                touch={ touch }
                onChange={ (next, index) => { setLetters(next); setCursor(index) } }
                onSubmit={ saveScore }
              />
            </> }
            { hud.status === "over" && ending === "saving" && <span className="text-m blink">Saving...</span> }
            { hud.status === "over" && ending === "board" && <>
              <span className="title-s">Leaderboard</span>
              { leaderboardStatus === "offline"
                ? <span className="text-s">Leaderboard offline</span>
                : <ol className="tetris__scores text-s">
                  {scores.map((entry, index) => (
                    <li className={ index + 1 === rank ? "is-new" : "" } key={ `${ entry.name }${ entry.date }${ index }` }>
                      <span>{ index + 1 }. { entry.name }</span>
                      <span>{ entry.score }</span>
                    </li>
                  ))}
                  { !scores.length && <li>No scores yet</li> }
                </ol> }
              { saveError && <span className="text-s">Not saved: { saveError }</span> }
              <span className="text-m">Your score { hud.score }</span>
            </> }

            { canRestart && <span className="text-m blink">
              { touch ? "Tap" : "Press enter" } to { hud.status === "paused" ? "continue" : hud.status === "over" ? "play again" : "start" }
            </span> }
          </div> }
        </div>

        <div className="tetris__hud">
          <div className="tetris__stat tetris__stat--next">
            <span className="text-s green-2">Next</span>
            {Array.from({ length: QUEUE_SIZE }, (_, i) => (
              <canvas ref={ (canvas) => { queueRefs.current[i] = canvas } } key={ i }></canvas>
            ))}
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
          <button className="tetris__sound text-s" { ...mute.props }>
            <SpeakerIcon muted={ mute.muted } />
            { mute.muted ? "Sound off" : "Sound on" }
          </button>
          { (hud.status === "playing" || hud.status === "paused") && <button
            className="tetris__restart text-s"
            // never keeps the focus: space (hard drop) would press it again and restart the game
            onPointerDown={ (e) => e.preventDefault() }
            onClick={ (e) => { e.currentTarget.blur(); restart() } }
          >
            Restart
          </button> }
        </div>
      </div>

      { !touch && <div className="tetris__keys text-s green-2">
        ← → Move · ↑ Rotate · ↓ Soft drop · Space Drop · Shift Hold · P Pause · R Restart
      </div> }

      { touch && <div className="tetris__controls">
        { button("left", "←", "Move left") }
        { button("right", "→", "Move right") }
        { button("down", "↓", "Soft drop") }
        { button("rotate", "↻", "Rotate") }
        { button("drop", "⤓", "Drop") }
        { button("hold", "H", "Hold") }
      </div> }
    </div>
  )
}
