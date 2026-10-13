import { create } from 'zustand'
import { Sound } from './classes/SoundBoard'

export enum ScreenViewType {
    START,
    CONTENT
}

interface ExperienceState {
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
    continueDialog: false,
    setContinueDialog: (continueDialog) => set(() => ({ continueDialog: continueDialog })),
}))