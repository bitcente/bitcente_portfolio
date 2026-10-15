import type { IncomingMessage, ServerResponse } from "node:http"
import { createHash, randomBytes } from "node:crypto"
import type { Plugin } from "vite"

// `npm run dev` can't run PHP, so this answers /api/scores.php while developing with the same rules as
// public/api/scores.php (keep both in sync). It uses the database of .env.local, but its own keys, so the
// scores made while testing never show up on the real leaderboards

const GAMES = ["tetris", "pacman"]
const TOP = 10
const KEEP = 100
const RATE_LIMIT = 5
const BLOCKED = ["ASS", "FUK", "FUC", "FCK", "SEX", "DIK", "DIC", "CUM", "NIG", "NAZ", "KKK", "FAG", "TIT", "XXX", "SHT", "PTA", "PUT", "CAC", "POL", "COK", "GAY", "JEW", "WTF"]

type Command = (string | number)[]

class Failure extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const notReal = () => new Failure(400, "not a real game")

function entries(flat: string[] | null) {
  const result = []
  for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
    const [name, lines, level, time] = flat![i].split("|")
    result.push({ name, score: Number(flat![i + 1]), lines: Number(lines), level: Number(level), date: Number(time) })
  }
  return result
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let body = ""
    request.on("data", (chunk) => { body += chunk })
    request.on("end", () => resolve(body))
  })
}

function checkTetris(input: Record<string, unknown>, score: number, level: number, duration: number) {
  const lines = input.lines as number
  if (!Number.isInteger(lines)) throw new Failure(400, "bad request")
  if (score > 9999999 || lines < 0 || lines > 9999) throw notReal()
  if (level !== Math.floor(lines / 10) + 1) throw notReal()
  if (score > 100 * level * (lines + .25 * lines * (lines - 1))) throw notReal()
  if (duration < Math.ceil(lines * 10 / 4) * .15) throw notReal()
  return lines
}

const PACMAN_FRUITS = [0, 100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000]
const pacmanLevelMax = (level: number) =>
  2600 + (level < 17 || level === 18 ? 12000 : 0) + 2 * (PACMAN_FRUITS[level] ?? 5000)

function checkPacman(score: number, level: number, duration: number) {
  if (level > 256 || score % 10 !== 0) throw notReal()
  let max = 0
  for (let l = 1; l <= level; l++) max += pacmanLevelMax(l)
  if (score > max) throw notReal()
  if (duration < (level - 1) * 20) throw notReal()
}

export default function devLeaderboard(env: Record<string, string>): Plugin {
  const redis = async (commands: Command[]) => {
    const url = env.UPSTASH_REDIS_REST_URL
    const token = env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) throw new Failure(500, "leaderboard not configured, see .env.local")
    const response = await fetch(url.replace(/\/$/, "") + "/pipeline", {
      method: "POST",
      headers: { Authorization: `Bearer ${ token }`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    }).catch(() => null)
    if (!response?.ok) throw new Failure(502, "leaderboard unavailable")
    const replies = await response.json() as { result?: unknown }[]
    return replies.map((reply) => reply.result ?? null)
  }

  const handle = async (request: IncomingMessage, address: string) => {
    const game = new URL(request.url ?? "/", "http://localhost").searchParams.get("game") ?? "tetris"
    if (!GAMES.includes(game)) throw new Failure(404, "no such game")
    const board = `dev:${ game }:leaderboard`
    const top: Command = ["ZREVRANGE", board, 0, TOP - 1, "WITHSCORES"]

    if (request.method === "GET") {
      const [scores] = await redis([top])
      return { scores: entries(scores as string[]) }
    }
    if (request.method !== "POST") throw new Failure(405, "method not allowed")

    let input: Record<string, unknown>
    try {
      input = JSON.parse(await readBody(request))
    } catch {
      throw new Failure(400, "bad request")
    }
    const name = String(input.name ?? "").toUpperCase()
    const { score, level, duration } = input as Record<string, number>

    if (!/^[A-Z]{3}$/.test(name) || BLOCKED.includes(name)) throw new Failure(400, "name not allowed")
    if (![score, level].every(Number.isInteger) || typeof duration !== "number") throw new Failure(400, "bad request")
    if (score < 1 || level < 1 || duration < 0 || duration > 6 * 3600) throw notReal()

    let lines = 0
    if (game === "tetris") lines = checkTetris(input, score, level, duration)
    else checkPacman(score, level, duration)

    const rate = `dev:${ game }:rate:` + createHash("sha1").update(address).digest("hex")
    const [, count] = await redis([["SET", rate, 0, "EX", 60, "NX"], ["INCR", rate]])
    if (Number(count) > RATE_LIMIT) throw new Failure(429, "too many scores, wait a minute")

    const member = [name, lines, level, Math.floor(Date.now() / 1000), randomBytes(3).toString("hex")].join("|")
    const [, , scores, rank] = await redis([
      ["ZADD", board, score, member],
      ["ZREMRANGEBYRANK", board, 0, -(KEEP + 1)],
      top,
      ["ZREVRANK", board, member],
    ])
    return { scores: entries(scores as string[]), rank: rank === null ? null : Number(rank) + 1 }
  }

  return {
    name: "dev-leaderboard",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/scores.php", (request: IncomingMessage, response: ServerResponse) => {
        response.setHeader("Content-Type", "application/json")
        response.setHeader("Cache-Control", "no-store")
        handle(request, request.socket.remoteAddress ?? "")
          .then((body) => response.end(JSON.stringify(body)))
          .catch((error) => {
            response.statusCode = error instanceof Failure ? error.status : 500
            response.end(JSON.stringify({ error: error instanceof Failure ? error.message : "server error" }))
          })
      })
    },
  }
}
