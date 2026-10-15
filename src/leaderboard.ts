import { create } from "zustand"

// Best Tetris scores of everybody that ever played, kept on the server (public/api/scores.php)

const ENDPOINT = "/api/scores.php"
// scores the server sends back
export const LEADERBOARD_SIZE = 10

export interface LeaderboardEntry {
  name: string
  score: number
  lines: number
  level: number
  // seconds since 1970
  date: number
}

export interface GameResult {
  name: string
  score: number
  lines: number
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

async function request(init?: RequestInit) {
  const response = await fetch(ENDPOINT, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? "leaderboard unavailable")
  return body as { scores: LeaderboardEntry[], rank?: number | null }
}

export const useLeaderboard = create<LeaderboardState>()((set, get) => ({
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

// whether a score is good enough to be written on the board
export function makesTheBoard(score: number) {
  const { scores, status } = useLeaderboard.getState()
  if (score <= 0 || status === "offline") return false
  return scores.length < LEADERBOARD_SIZE || score > scores[scores.length - 1].score
}
