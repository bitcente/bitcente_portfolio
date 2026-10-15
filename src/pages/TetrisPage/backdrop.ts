// The scenes behind the board, like the arcade machine of 1988: Russian skylines with onion domes and the towers
// of a kremlin, a different time of day every level. Drawn small and scaled up, so they look made of big pixels,
// and only when the level or the size of the window changes

// px of the window per px of the scene
const PIXEL = 4

interface Theme {
  // sky from the top down to the horizon
  sky: [string, string]
  // sun or moon
  light: string
  lightY: number
  stars: boolean
  aurora: boolean
  // far city and the buildings in front
  far: string
  near: string
  windows: string
  ground: string
  // the stripes of each onion dome
  domes: [string, string][]
}

const THEMES: Theme[] = [
  {
    // dusk over the square
    sky: ["#170b33", "#d2486c"],
    light: "#ffcf5a",
    lightY: .62,
    stars: true,
    aurora: false,
    far: "#3b1747",
    near: "#1c0b26",
    windows: "#ffcf5a",
    ground: "#2a1030",
    domes: [["#e8323c", "#f5e9d0"], ["#2fb36b", "#f5d24a"], ["#3b6bff", "#ffffff"], ["#ffb02e", "#e8323c"], ["#2fb36b", "#e8323c"]],
  },
  {
    // a winter night, snow on the roofs
    sky: ["#030720", "#1d3b78"],
    light: "#f4f1d0",
    lightY: .2,
    stars: true,
    aurora: false,
    far: "#0f1f4a",
    near: "#070d24",
    windows: "#ffd27a",
    ground: "#c8d6ef",
    domes: [["#3b6bff", "#f5d24a"], ["#e8323c", "#ffffff"], ["#2fb36b", "#ffffff"], ["#f5d24a", "#3b6bff"], ["#e8323c", "#2fb36b"]],
  },
  {
    // northern lights
    sky: ["#020d16", "#0d4552"],
    light: "#d9fff2",
    lightY: .16,
    stars: true,
    aurora: true,
    far: "#0b2b36",
    near: "#04141b",
    windows: "#9cffd6",
    ground: "#0a222b",
    domes: [["#2fb36b", "#f5d24a"], ["#b54cff", "#ffffff"], ["#2ee6f0", "#3b6bff"], ["#f5d24a", "#2fb36b"], ["#e8323c", "#ffffff"]],
  },
  {
    // morning
    sky: ["#2a56b0", "#ffc27a"],
    light: "#fff1b8",
    lightY: .5,
    stars: false,
    aurora: false,
    far: "#8a6fa8",
    near: "#3b2a4a",
    windows: "#fff1b8",
    ground: "#4a3355",
    domes: [["#e8323c", "#ffffff"], ["#2fb36b", "#f5d24a"], ["#3b6bff", "#f5d24a"], ["#ff9a2e", "#2fb36b"], ["#b54cff", "#f5d24a"]],
  },
]

// random numbers that come out the same every time a level is drawn
function seeded(seed: number) {
  let state = seed % 2147483647 || 1
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

function onionDome(ctx: CanvasRenderingContext2D, x: number, base: number, width: number, height: number, [color, stripe]: [string, string]) {
  const half = width / 2
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x - half * .8, base)
  ctx.bezierCurveTo(x - half * 1.45, base - height * .45, x - half * .2, base - height * .7, x, base - height)
  ctx.bezierCurveTo(x + half * .2, base - height * .7, x + half * 1.45, base - height * .45, x + half * .8, base)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  // twisted stripes
  ctx.clip()
  ctx.strokeStyle = stripe
  ctx.lineWidth = Math.max(1, width / 7)
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(x + i * width / 3.5, base + 1)
    ctx.quadraticCurveTo(x + i * width / 6, base - height * .5, x, base - height)
    ctx.stroke()
  }
  ctx.restore()
  // spike on top
  ctx.fillStyle = "#f5d24a"
  ctx.fillRect(Math.round(x), Math.round(base - height - height * .35), 1, Math.ceil(height * .35))
}

// a cathedral of many towers, each with its dome
function cathedral(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, theme: Theme, rand: () => number) {
  const towers = [
    { dx: 0, width: .34, height: 1.25, dome: .42 },
    { dx: -.42, width: .24, height: .8, dome: .3 },
    { dx: .42, width: .24, height: .8, dome: .3 },
    { dx: -.22, width: .2, height: .98, dome: .26 },
    { dx: .22, width: .2, height: .98, dome: .26 },
  ]
  // the body
  ctx.fillStyle = theme.near
  ctx.fillRect(x - size * .55, ground - size * .45, size * 1.1, size * .45)
  // the tallest last, in front
  ;[...towers].reverse().forEach((tower, i) => {
    const tx = x + tower.dx * size
    const width = tower.width * size
    const top = ground - tower.height * size
    ctx.fillStyle = theme.near
    ctx.fillRect(tx - width / 2, top, width, ground - top)
    // a band of arches and some lit windows
    ctx.fillStyle = theme.windows
    for (let w = 0; w < 2; w++) {
      if (rand() < .7) ctx.fillRect(Math.round(tx - width / 4 + w * width / 3), Math.round(top + size * .12), 1, 2)
    }
    onionDome(ctx, tx, top + 1, width * 1.15, tower.dome * size, theme.domes[(i * 2 + Math.floor(x)) % theme.domes.length])
  })
}

// a kremlin tower: square, steps up and a green pointed roof with a star
function kremlinTower(ctx: CanvasRenderingContext2D, x: number, ground: number, size: number, theme: Theme) {
  ctx.fillStyle = theme.near
  ctx.fillRect(x - size * .16, ground - size, size * .32, size)
  ctx.fillRect(x - size * .11, ground - size * 1.25, size * .22, size * .25)
  ctx.fillStyle = "#2a6b45"
  ctx.beginPath()
  ctx.moveTo(x - size * .12, ground - size * 1.25)
  ctx.lineTo(x, ground - size * 1.75)
  ctx.lineTo(x + size * .12, ground - size * 1.25)
  ctx.fill()
  ctx.fillStyle = "#e8323c"
  ctx.fillRect(Math.round(x - 1), Math.round(ground - size * 1.82), 3, 2)
  // the clock
  ctx.fillStyle = theme.windows
  ctx.fillRect(Math.round(x - 1), Math.round(ground - size * .82), 3, 3)
}

// the wall of the kremlin, with its swallow tail battlements
function wall(ctx: CanvasRenderingContext2D, from: number, to: number, ground: number, height: number, theme: Theme) {
  ctx.fillStyle = theme.near
  ctx.fillRect(from, ground - height, to - from, height)
  for (let x = from; x < to; x += 4) {
    ctx.fillRect(x, ground - height - 2, 1, 2)
    ctx.fillRect(x + 2, ground - height - 2, 1, 2)
  }
}

export function drawBackdrop(canvas: HTMLCanvasElement, level: number) {
  const width = Math.ceil(window.innerWidth / PIXEL)
  const height = Math.ceil(window.innerHeight / PIXEL)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const theme = THEMES[(level - 1) % THEMES.length]
  const rand = seeded(level * 7919)
  const horizon = Math.round(height * .72)

  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, theme.sky[0])
  sky.addColorStop(1, theme.sky[1])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  if (theme.stars) {
    for (let i = 0; i < width * height / 60; i++) {
      ctx.fillStyle = rand() < .2 ? "#ffffff" : "rgba(255, 255, 255, .45)"
      ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * horizon * .7), 1, 1)
    }
  }
  if (theme.aurora) {
    ["rgba(80, 255, 170, .22)", "rgba(180, 90, 255, .16)"].forEach((color, band) => {
      ctx.strokeStyle = color
      ctx.lineWidth = height * .06
      ctx.beginPath()
      for (let x = 0; x <= width; x += 4) {
        const y = height * (.18 + band * .09) + Math.sin(x / width * 7 + band * 2) * height * .05
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
  }

  // sun or moon, with a soft glow
  const lightX = width * .78
  const lightY = height * theme.lightY
  const radius = Math.max(4, height * .07)
  const glow = ctx.createRadialGradient(lightX, lightY, radius * .5, lightX, lightY, radius * 4)
  glow.addColorStop(0, theme.light + "66")
  glow.addColorStop(1, theme.light + "00")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = theme.light
  ctx.beginPath()
  ctx.arc(lightX, lightY, radius, 0, Math.PI * 2)
  ctx.fill()

  // the city far away
  for (let x = 0; x < width;) {
    const w = 3 + Math.floor(rand() * 8)
    const h = height * (.05 + rand() * .12)
    ctx.fillStyle = theme.far
    ctx.fillRect(x, horizon - h, w, h)
    if (rand() < .3) onionDome(ctx, x + w / 2, horizon - h, w, w, [theme.far, theme.far])
    x += w
  }

  // in front: the kremlin wall with its towers and a cathedral at each side, out of the way of the board
  const ground = Math.round(height * .86)
  const size = Math.max(14, Math.min(height * .3, width * .14))
  wall(ctx, 0, width, ground, size * .28, theme)
  ;[.06, .3, .7, .94].forEach((at) => kremlinTower(ctx, width * at, ground, size * .7, theme))
  cathedral(ctx, width * .16, ground, size, theme, rand)
  cathedral(ctx, width * .84, ground, size * .85, theme, rand)

  ctx.fillStyle = theme.ground
  ctx.fillRect(0, ground, width, height - ground)
  // snow or cobbles
  ctx.fillStyle = "rgba(255, 255, 255, .12)"
  for (let i = 0; i < width / 2; i++) ctx.fillRect(Math.floor(rand() * width), ground + 1 + Math.floor(rand() * (height - ground)), 2, 1)
}
