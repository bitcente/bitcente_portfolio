import { useEffect, useMemo, useRef, useState } from "react"
import { useArcadeStore, usePlaying } from "../../arcade/store"
import { isTouchDevice } from "../../utils/Screen"
import { LEADERBOARDS, makesTheBoard, recordScore, useHighScore } from "../../leaderboard"
import NameEntry, { Letters, lettersToName, NAME_LENGTH, nameKey } from "../TetrisPage/NameEntry"
import { VolumeControl } from "../../components/MuteButton"
import Pacman, { Dir, DOWN, LEFT, RIGHT, UP } from "./pacman"
import { drawGame, prepareSprites } from "./draw"
import PacmanSound from "./sound"
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./maze"
import "./pacman.css"

const useLeaderboard = LEADERBOARDS.pacman

const KEYS: Record<string, Dir> = {
  ArrowUp: UP, w: UP,
  ArrowLeft: LEFT, a: LEFT,
  ArrowDown: DOWN, s: DOWN,
  ArrowRight: RIGHT, d: RIGHT,
}
// px a finger has to slide to steer
const SWIPE = 18

// The screen of the arcade scaled up by the biggest whole number of real px that fits, so every px of it is
// a sharp square. On phones in portrait it leaves room for the pad under it
function screenSize(touch: boolean) {
  const ratio = Math.min(window.devicePixelRatio || 1, 3)
  const portrait = window.innerWidth < window.innerHeight
  const height = touch && portrait ? window.innerHeight * .64 : window.innerHeight - 70
  const width = window.innerWidth * .96
  const scale = Math.max(1, Math.floor(Math.min(width * ratio / SCREEN_WIDTH, height * ratio / SCREEN_HEIGHT)))
  return { scale, ratio }
}

const hudOf = (game: Pacman) => ({ status: game.status, score: game.score, level: game.level })

// what the end of a game shows: nothing yet (checking the leaderboard), the name entry for a score that made it,
// the score being saved, or the leaderboard
type Ending = "checking" | "entry" | "saving" | "board"

export default function PacmanPage() {
  const game = useMemo(() => new Pacman(), [])
  const sound = useMemo(() => new PacmanSound(), [])
  const [hud, setHud] = useState(() => hudOf(game))
  const touch = isTouchDevice()
  const [size, setSize] = useState(() => screenSize(touch))
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  const [rank, setRank] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // the game over screen can't be skipped while the name is being written or saved
  const canRestart = hud.status !== "over" || ending === "board"

  const startOrResume = () => {
    if (game.status === "paused") game.togglePause()
    else if (game.status === "title" || (game.status === "over" && canRestart)) game.start()
  }

  const saveScore = () => {
    setEnding("saving")
    useLeaderboard.getState().submit({
      name: lettersToName(letters),
      score: game.score,
      level: game.level,
      duration: game.playTime / 1000,
    })
      .then(setRank)
      .catch((error: Error) => setSaveError(error.message))
      .finally(() => setEnding("board"))
  }

  useEffect(() => {
    game.onChange = () => setHud(hudOf(game))
    game.onSound = (name) => sound.play(name)
    return () => {
      game.onChange = undefined
      game.onSound = undefined
      sound.stop()
    }
  }, [game, sound])

  // the music and the siren stop with the game
  useEffect(() => {
    if (hud.status !== "playing") sound.stop()
  }, [hud.status, sound])

  useEffect(() => {
    if (useLeaderboard.getState().status === "idle") useLeaderboard.getState().refresh()
  }, [])
  // the high score at the top of the screen: the best on the board, or the best played here
  const high = useHighScore("pacman")
  useEffect(() => {
    if (high.score < game.high) return
    game.high = high.score
    game.highName = high.name
  }, [game, high.score, high.name])

  // at the end of a game, the latest leaderboard says whether the score makes it
  useEffect(() => {
    if (hud.status !== "over") return
    recordScore("pacman", game.score)
    setEnding("checking")
    setRank(null)
    setSaveError(null)
    setCursor(0)
    let alive = true
    useLeaderboard.getState().refresh().then(() => {
      if (alive) setEnding(makesTheBoard("pacman", game.score) ? "entry" : "board")
    })
    return () => { alive = false }
  }, [hud.status])

  useEffect(() => {
    const resize = () => setSize(screenSize(touch))
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [touch])

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    canvas.width = SCREEN_WIDTH * size.scale
    canvas.height = SCREEN_HEIGHT * size.scale
    prepareSprites()

    let frame = 0
    let last = performance.now()
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      // a long frame (tab in the background...) doesn't run the game all at once
      game.update(Math.min(time - last, 100))
      last = time
      sound.update(game.ambient(), game.sirenStage)
      // nothing to draw while another arcade machine is being played and this page is hidden
      if (!onScreen.current) return
      ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0)
      drawGame(ctx, game, touch)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [game, sound, size, touch])

  useEffect(() => {
    if (!playing) return

    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault()

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

      // a new game right away, from the start (but not while a name is being written or saved, see above)
      if (key === "r" && !e.repeat && game.status !== "title" && canRestart) {
        sound.stop()
        game.start()
        return
      }

      if (game.status === "playing") {
        // like the joystick: pacman keeps going the way it was last pushed
        if (KEYS[key] !== undefined) game.steer(KEYS[key])
        if (key === "p" && !e.repeat) game.togglePause()
        return
      }
      if (e.repeat) return
      if (key === "Enter" || key === " " || (key === "p" && game.status === "paused")) startOrResume()
    }

    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [game, sound, playing, ending, letters, cursor, canRestart])

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

  // a finger sliding over the screen steers, a tap starts
  const swipe = useRef<{ x: number, y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const from = swipe.current
    if (!from || game.status !== "playing") return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return
    game.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP))
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => { swipe.current = null }

  const pad = (dir: Dir, label: string, name: string) => (
    <button
      className={ "pacman__button pacman__button--" + name.toLowerCase() }
      aria-label={ "Go " + name.toLowerCase() }
      onPointerDown={ (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (game.status === "playing") game.steer(dir)
      } }
    >
      { label }
    </button>
  )

  const width = SCREEN_WIDTH * size.scale / size.ratio
  const height = SCREEN_HEIGHT * size.scale / size.ratio

  return (
    <div className="pacman" onPointerDown={ onPointerDown } onPointerMove={ onPointerMove } onPointerUp={ onPointerUp } onPointerCancel={ onPointerUp }>
      <div className="pacman__screen" onClick={ () => (hud.status === "title" || hud.status === "paused") && startOrResume() }>
        <canvas ref={ canvasRef } style={ { width, height } }></canvas>

        { (hud.status === "paused" || hud.status === "over") && <div className="pacman__overlay" onClick={ () => canRestart && startOrResume() }>
          { hud.status === "paused" && <span className="title-s pacman__yellow">Paused</span> }

          { hud.status === "over" && ending === "checking" && <>
            <span className="title-s pacman__red">Game over</span>
            <span className="text-m">Score { hud.score }</span>
          </> }
          { hud.status === "over" && ending === "entry" && <>
            <span className="title-s pacman__yellow">New high score!</span>
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
            <span className="title-s pacman__yellow">High scores</span>
            { leaderboardStatus === "offline"
              ? <span className="text-s">Leaderboard offline</span>
              : <ol className="pacman__scores text-s">
                {scores.map((entry, index) => (
                  <li className={ index + 1 === rank ? "is-new" : "" } key={ `${ entry.name }${ entry.date }${ index }` }>
                    <span>{ index + 1 }. { entry.name }</span>
                    <span>{ entry.score }</span>
                  </li>
                ))}
                { !scores.length && <li>No scores yet</li> }
              </ol> }
            { saveError && <span className="text-s">Not saved: { saveError }</span> }
            <span className="text-m">Your score { hud.score } · Level { hud.level }</span>
          </> }

          { canRestart && <span className="text-m blink pacman__yellow">
            { touch ? "Tap" : "Press enter" } to { hud.status === "paused" ? "continue" : "play again" }
          </span> }
        </div> }
      </div>

      <div className="pacman__bar text-s">
        <VolumeControl variant="pacman" buttonClassName="pacman__sound text-s" label />
        { !touch && <span>← ↑ → ↓ Move · P Pause · R Restart · Enter Start</span> }
        { touch && hud.status === "playing" && <button
          className="pacman__pause text-s"
          onPointerDown={ (e) => e.stopPropagation() }
          onClick={ () => game.togglePause() }
        >
          Pause
        </button> }
      </div>

      { touch && <div className="pacman__pad">
        { pad(UP, "▲", "Up") }
        { pad(LEFT, "◀", "Left") }
        { pad(RIGHT, "▶", "Right") }
        { pad(DOWN, "▼", "Down") }
      </div> }
    </div>
  )
}
