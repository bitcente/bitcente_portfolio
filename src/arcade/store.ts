import { createContext, useContext, useEffect } from "react"
import { create } from "zustand"
import { isMobile, isTouchPrimary } from "../utils/Screen"
import { machineOrHome } from "./layout"

// On mobile (phones and tablets, wide or not) there's no arcade room: it's never loaded, and each page is shown
// on its own like a normal web. Getting to the room takes the ESC key anyway
export const ROOM_ENABLED = !isMobile() && !isTouchPrimary()

interface ArcadeState {
  // playing a machine, or standing in the room looking at them
  view: "screen" | "room"
  // machine being played (or the last one, while in the room)
  machine: number
  // the camera is still and fitted to the screen: the room isn't rendered and the page works as usual
  settled: boolean
  // how many things on the page want ESC for themselves right now
  escapeClaims: number
  leave: () => void
  enter: (machine: number) => void
  setMachine: (machine: number) => void
  settle: () => void
  claimEscape: (amount: number) => void
}

export const useArcadeStore = create<ArcadeState>()((set) => ({
  view: "screen",
  machine: machineOrHome(window.location.pathname),
  settled: true,
  escapeClaims: 0,
  leave: () => set(() => ({ view: "room", settled: false })),
  enter: (machine) => set((state) => (
    state.view === "screen" && state.settled && state.machine === machine
      ? state
      : { view: "screen", machine, settled: false }
  )),
  setMachine: (machine) => set(() => ({ machine })),
  settle: () => set(() => ({ settled: true })),
  claimEscape: (amount) => set((state) => ({ escapeClaims: state.escapeClaims + amount })),
}))

// index of the machine a page is running in (-1 for a page shown on its own, outside of the arcade)
export const MachineContext = createContext(-1)

// Every machine keeps its page running, but only the one being played gets the keyboard and the rest of
// the input that pages listen for on the window
export function usePlaying() {
  const index = useContext(MachineContext)
  return useArcadeStore((state) => index < 0 || state.machine === index)
}

// ESC leaves the machine unless something on the page needs it first (a modal to close...)
export function useEscapeClaim(active: boolean) {
  const claimEscape = useArcadeStore((state) => state.claimEscape)

  useEffect(() => {
    if (!active) return
    claimEscape(1)
    return () => claimEscape(-1)
  }, [active])
}
