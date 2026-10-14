import { ComponentType, lazy, Suspense, useEffect, useRef, useState } from "react"
import CrtOverlay from "../components/CrtOverlay"
import PokemonPage from "../pages/PokemonPage/PokemonPage"
import ShowcasePage from "../pages/ShowcasePage/ShowcasePage"
import TetrisPage from "../pages/TetrisPage/TetrisPage"
import { useBitcenteStore } from "../store"
import { isTouchDevice } from "../utils/Screen"
import type { ArcadeScreens } from "./ArcadeRoom"
import { machineFor, MACHINES } from "./layout"
import { MachineContext, useArcadeStore } from "./store"
import "./arcade.css"

// three.js room, only needed once the player steps back from the machine
const ArcadeRoom = lazy(() => import("./ArcadeRoom"))

// page each machine runs, by the path of the machine
const PAGES: Record<string, ComponentType> = {
  "/tetris": TetrisPage,
  "/": ShowcasePage,
  "/pokemon": PokemonPage,
}

// ms after the page loads to get the room ready in the background
const PRELOAD_DELAY = 2500
// input the pages behind the glass must not get while the player is in the room
const BLOCKED_EVENTS = ["keydown", "keyup", "wheel", "touchstart", "touchmove", "touchend"] as const
// clicks on the room must not reach the listeners the pages have on the window
const ROOM_EVENTS = ["click", "dblclick", "pointerdown", "pointerup", "mousedown", "mouseup", "contextmenu"] as const

// The whole web lives in the screens of the machines of an arcade. Every machine runs its own page all the time,
// the url says which one is being played. ESC steps back into the room, and clicking a machine walks up to it
export default function Arcade() {
  const view = useArcadeStore((state) => state.view)
  const machine = useArcadeStore((state) => state.machine)
  const settled = useArcadeStore((state) => state.settled)
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)

  const [roomMounted, setRoomMounted] = useState(false)
  const screens = useRef<ArcadeScreens>([])
  const roomRef = useRef<HTMLDivElement>(null)

  const select = (index: number) => {
    setCursorPointer(false)
    if (window.location.pathname !== MACHINES[index].path) window.history.pushState(null, "", MACHINES[index].path)
    useArcadeStore.getState().enter(index)
  }

  // back and forward buttons of the browser
  useEffect(() => {
    const sync = () => {
      const index = machineFor(window.location.pathname)
      // a page that isn't in any machine
      if (index < 0) return window.location.reload()
      useArcadeStore.getState().setMachine(index)
    }
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => setRoomMounted(true), PRELOAD_DELAY)
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const onInput = (e: Event) => {
      const { view, settled, machine, escapeClaims } = useArcadeStore.getState()
      const key = e.type === "keydown" ? (e as KeyboardEvent).key : undefined

      if (view === "screen" && settled) {
        if (key !== "Escape" || escapeClaims > 0 || (e as KeyboardEvent).repeat) return
        e.stopPropagation()
        e.preventDefault()
        setCursorPointer(false)
        setRoomMounted(true)
        useArcadeStore.getState().leave()
        return
      }

      e.stopPropagation()
      // back to the machine that was being played
      if (view === "room" && (key === "Escape" || key === "Enter")) select(machine)
    }

    // capture, so it runs before the listeners of the pages
    BLOCKED_EVENTS.forEach((event) => window.addEventListener(event, onInput, true))
    return () => BLOCKED_EVENTS.forEach((event) => window.removeEventListener(event, onInput, true))
  }, [])

  useEffect(() => {
    const room = roomRef.current
    if (!room) return
    const stop = (e: Event) => e.stopPropagation()
    ROOM_EVENTS.forEach((event) => room.addEventListener(event, stop))
    return () => ROOM_EVENTS.forEach((event) => room.removeEventListener(event, stop))
  }, [roomMounted])

  return (
    <div className={ "arcade" + (settled ? "" : " is-out") + (view === "room" ? " is-room" : "") }>
      {MACHINES.map(({ path }, index) => {
        const Page = PAGES[path]
        return (
          <div
            className={ "arcade__screen" + (index === machine ? " is-playing" : "") }
            ref={ (element) => { screens.current[index] = element } }
            aria-hidden={ index !== machine }
            key={ path }
          >
            <CrtOverlay />
            <MachineContext.Provider value={ index }>
              <Page />
            </MachineContext.Provider>
          </div>
        )
      })}

      { roomMounted && <div className="arcade__room" ref={ roomRef }>
        <Suspense fallback={ null }>
          <ArcadeRoom screens={ screens } onSelect={ select } onHover={ setCursorPointer } />
        </Suspense>
      </div> }

      <div className="arcade__hint" aria-hidden={ view !== "room" }>
        { isTouchDevice() ? "Tap a machine to play" : "Click a machine to play" }
      </div>
    </div>
  )
}
