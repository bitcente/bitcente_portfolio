import { create } from 'zustand'
import { Sound } from './classes/SoundBoard'

export enum ScreenViewType {
    START,
    CONTENT
}

// remembered in this browser between visits (may be unavailable: private mode, blocked storage)
const MUTED_KEY = "muted"
const readMuted = () => {
    try {
        return localStorage.getItem(MUTED_KEY) === "1"
    } catch {
        return false
    }
}

const VOLUME_KEY = "volume"
const readVolume = () => {
    try {
        const saved = localStorage.getItem(VOLUME_KEY)
        return saved === null ? 1 : Math.min(1, Math.max(0, Number(saved) || 0))
    } catch {
        return 1
    }
}

interface ExperienceState {
    // every sound and song of the web silenced (the M key), whatever the volume
    muted: boolean
    toggleMuted: () => void
    // volume of the whole web, 0 to 1 (the bar of the sound buttons). Changing it turns the sound back on
    volume: number
    setVolume: (volume: number) => void
    // how many things are taking typed letters right now (the M key isn't for muting then)
    typingClaims: number
    claimTyping: (amount: number) => void
    screenView: ScreenViewType
    goToStart: () => void
    goToContent: () => void
    cursorPointer: boolean
    setCursorPointer: (cursor: boolean) => void
    soundPlayed: Sound | null
    playSound: (sound: Sound | null) => void
    bitcenteEating: boolean
    setBitcenteEating: (eating: boolean) => void
    continueDialog: boolean
    setContinueDialog: (continueDialog: boolean) => void
}

export const useBitcenteStore = create<ExperienceState>()((set) => ({
    screenView: ScreenViewType.START,
    goToStart: () => set(() => ({ screenView: ScreenViewType.START })),
    goToContent: () => set(() => ({ screenView: ScreenViewType.CONTENT })),
    cursorPointer: true,
    setCursorPointer: (cursor) => set(() => ({ cursorPointer: cursor })),
    soundPlayed: null,
    playSound: (sound) => set(() => ({ soundPlayed: sound })),
    bitcenteEating: false,
    setBitcenteEating: (eating) => set(() => ({ bitcenteEating: eating })),
    muted: readMuted(),
    toggleMuted: () => set((state) => {
        try {
            localStorage.setItem(MUTED_KEY, state.muted ? "0" : "1")
        } catch {
            /* storage unavailable */
        }
        return { muted: !state.muted }
    }),
    volume: readVolume(),
    setVolume: (volume) => set(() => {
        try {
            localStorage.setItem(VOLUME_KEY, String(volume))
            localStorage.setItem(MUTED_KEY, "0")
        } catch {
            /* storage unavailable */
        }
        return { volume, muted: false }
    }),
    typingClaims: 0,
    claimTyping: (amount) => set((state) => ({ typingClaims: state.typingClaims + amount })),
    continueDialog: false,
    setContinueDialog: (continueDialog) => set(() => ({ continueDialog: continueDialog })),
}))