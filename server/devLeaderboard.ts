import type { IncomingMessage, ServerResponse } from "node:http"
import { createHash, randomBytes } from "node:crypto"
import type { Plugin } from "vite"

// `npm run dev` can't run PHP, so this answers /api/scores.php while developing with the same rules as
// public/api/scores.php (keep both in sync). It uses the database of .env.local, but its own keys, so the
// scores made while testing never show up on the real leaderboard

const BOARD = "dev:tetris:leaderboard"
const TOP = 10
const KEEP = 100
const RATE_LIMIT = 5
const MAX_SCORE = 9999999
const BLOCKED = ["ASS", "FUK", "FUC", "FCK", "SEX", "DIK", "DIC", "CUM", "NIG", "NAZ", "KKK", "FAG", "TIT", "XXX", "SHT", "PTA", "PUT", "CAC", "POL", "COK", "GAY", "JEW", "WTF"]

type Command = (string | number)[]

class Failure extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

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

  const top: Command = ["ZREVRANGE", BOARD, 0, TOP - 1, "WITHSCORES"]

  const handle = async (request: IncomingMessage, address: string) => {
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
    const { score, lines, level, duration } = input as Record<string, number>

    if (!/^[A-Z]{3}$/.test(name) || BLOCKED.includes(name)) throw new Failure(400, "name not allowed")
    if (![score, lines, level].every(Number.isInteger) || typeof duration !== "number") throw new Failure(400, "bad request")
    if (score < 1 || score > MAX_SCORE || lines < 0 || lines > 9999 || duration < 0 || duration > 6 * 3600) throw new Failure(400, "not a real game")
    if (level !== Math.floor(lines / 10) + 1) throw new Failure(400, "not a real game")
    if (score > 100 * level * (lines + .25 * lines * (lines - 1))) throw new Failure(400, "not a real game")
    if (duration < Math.ceil(lines * 10 / 4) * .15) throw new Failure(400, "not a real game")

    const rate = "dev:tetris:rate:" + createHash("sha1").update(address).digest("hex")
    const [, count] = await redis([["SET", rate, 0, "EX", 60, "NX"], ["INCR", rate]])
    if (Number(count) > RATE_LIMIT) throw new Failure(429, "too many scores, wait a minute")

    const member = [name, lines, level, Math.floor(Date.now() / 1000), randomBytes(3).toString("hex")].join("|")
    const [, , scores, rank] = await redis([
      ["ZADD", BOARD, score, member],
      ["ZREMRANGEBYRANK", BOARD, 0, -(KEEP + 1)],
      top,
      ["ZREVRANK", BOARD, member],
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
