import { create, StoreApi, UseBoundStore } from "zustand"

// Best scores of everybody that ever played each arcade game, kept on the server (public/api/scores.php)

const ENDPOINT = "/api/scores.php"
// scores the server sends back
export const LEADERBOARD_SIZE = 10

export type Game = "tetris" | "pacman"

export interface LeaderboardEntry {
  name: string
  score: number
  // always 0 in pacman
  lines: number
  level: number
  // seconds since 1970
  date: number
}

export interface GameResult {
  name: string
  score: number
  // only in tetris
  lines?: number
  level: number
  // seconds played
  duration: number
}

interface LeaderboardState {
  scores: LeaderboardEntry[]
  // "offline" when the server couldn't be reached
  status: "idle" | "loading" | "ready" | "offline"
  refresh: () => Promise<void>
  // the position the score got (1 is the best), or null if it isn't on the board
  submit: (result: GameResult) => Promise<number | null>
}

export type Leaderboard = UseBoundStore<StoreApi<LeaderboardState>>

function createLeaderboard(game: Game): Leaderboard {
  const request = async (init?: RequestInit) => {
    const response = await fetch(`${ ENDPOINT }?game=${ game }`, init)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? "leaderboard unavailable")
    return body as { scores: LeaderboardEntry[], rank?: number | null }
  }

  return create<LeaderboardState>()((set, get) => ({
    scores: [],
    status: "idle",
    refresh: async () => {
      if (get().status === "loading") return
      set({ status: "loading" })
      try {
        const { scores } = await request()
        set({ scores, status: "ready" })
      } catch {
        set({ status: "offline" })
      }
    },
    submit: async (result) => {
      const { scores, rank } = await request({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      })
      set({ scores, status: "ready" })
      return rank ?? null
    },
  }))
}

export const LEADERBOARDS: Record<Game, Leaderboard> = {
  tetris: createLeaderboard("tetris"),
  pacman: createLeaderboard("pacman"),
}

// whether a score is good enough to be written on the board of a game
export function makesTheBoard(game: Game, score: number) {
  const { scores, status } = LEADERBOARDS[game].getState()
  if (score <= 0 || status === "offline") return false
  return scores.length < LEADERBOARD_SIZE || score > scores[scores.length - 1].score
}

// The best score of each game played in this browser, so there's a high score to show even with the
// leaderboard offline or still empty
const BEST_KEY = (game: Game) => `best:${ game }`
const readBest = (game: Game) => {
  try {
    return Number(localStorage.getItem(BEST_KEY(game))) || 0
  } catch {
    return 0
  }
}
const useLocalBests = create<Record<Game, number>>()(() => ({ tetris: readBest("tetris"), pacman: readBest("pacman") }))

// remembers the score of a game that just ended, if it's the best one played here
export function recordScore(game: Game, score: number) {
  if (score <= useLocalBests.getState()[game]) return
  useLocalBests.setState({ [game]: score })
  try {
    localStorage.setItem(BEST_KEY(game), String(score))
  } catch {
    // storage unavailable: it's kept until the page is closed
  }
}

// the high score of a game: the best on the leaderboard (with the name of who made it) or the best played here
export function useHighScore(game: Game): { score: number, name: string | null } {
  const top = LEADERBOARDS[game]((state) => state.scores[0])
  const local = useLocalBests((state) => state[game])
  return top && top.score >= local ? { score: top.score, name: top.name } : { score: local, name: null }
}
