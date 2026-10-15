import * as THREE from "three"
import { MachineConfig } from "./layout"
import { useLeaderboard } from "../leaderboard"

// Every texture of the room is drawn here on canvases, so there's nothing to download. They're made once and shared

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

const FONT = "Tickerbit, monospace"

function canvas(width: number, height: number, draw: Draw) {
  const element = document.createElement("canvas")
  element.width = width
  element.height = height
  draw(element.getContext("2d", { willReadFrequently: true })!, width, height)
  return element
}

interface TextureOptions {
  repeat?: [number, number]
  // colour textures are sRGB, data ones (bump, roughness) are linear
  color?: boolean
  // redrawn when the web font is loaded, for textures with text
  text?: boolean
}

function texture(width: number, height: number, draw: Draw, { repeat, color = true, text = false }: TextureOptions = {}) {
  const element = canvas(width, height, draw)
  const result = new THREE.CanvasTexture(element)
  if (color) result.colorSpace = THREE.SRGBColorSpace
  result.anisotropy = 4
  if (repeat) {
    result.wrapS = result.wrapT = THREE.RepeatWrapping
    result.repeat.set(...repeat)
  }
  if (text) {
    document.fonts.load(`64px ${ FONT.split(",")[0] }`).then(() => {
      const ctx = element.getContext("2d")!
      ctx.clearRect(0, 0, width, height)
      draw(ctx, width, height)
      result.needsUpdate = true
    }).catch(() => {})
  }
  return result
}

// one texture per key for the whole page
const cache = new Map<string, THREE.Texture>()
function cached(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)!
}

const random = (min: number, max: number) => min + Math.random() * (max - min)

// soft blotches: a few random pixels scaled up with smoothing
function blotches(ctx: CanvasRenderingContext2D, width: number, height: number, cells: number, light: string, dark: string, strength: number) {
  const small = canvas(cells, Math.max(1, Math.round(cells * height / width)), (c, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        c.fillStyle = Math.random() < .5 ? light : dark
        c.globalAlpha = Math.random() * strength
        c.fillRect(x, y, 1, 1)
      }
    }
  })
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(small, 0, 0, width, height)
  ctx.restore()
}

// fine grain, one pixel at a time
function grain(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, strength: number) {
  const image = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < image.data.length; i += 4) {
    const shift = (Math.random() - .5) * amount
    image.data[i] += shift
    image.data[i + 1] += shift
    image.data[i + 2] += shift
  }
  ctx.putImageData(image, 0, 0)
  if (strength) blotches(ctx, width, height, 16, "#ffffff", "#000000", strength)
}

function scratches(ctx: CanvasRenderingContext2D, width: number, height: number, count: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = random(.05, .25)
    ctx.lineWidth = random(.5, 1.5)
    const x = Math.random() * width
    const y = Math.random() * height
    const angle = Math.random() * Math.PI
    const length = random(4, 40)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    ctx.stroke()
  }
  ctx.restore()
}

/* ROOM */

// worn out carpet with the confetti every arcade had
export const carpet = () => cached("carpet", () => texture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = "#100d1e"
  ctx.fillRect(0, 0, w, h)
  grain(ctx, w, h, 26, 0)

  const colors = ["#ff3fa4", "#33e1ff", "#ffe14d", "#7dff6a", "#9b6bff"]
  for (let i = 0; i < 150; i++) {
    ctx.save()
    ctx.translate(Math.random() * w, Math.random() * h)
    ctx.rotate(Math.random() * Math.PI)
    ctx.globalAlpha = random(.3, .6)
    ctx.fillStyle = ctx.strokeStyle = colors[i % colors.length]
    ctx.lineWidth = 3
    if (i % 3 === 0) {
      ctx.fillRect(-7, -2, 14, 4)
    } else if (i % 3 === 1) {
      ctx.beginPath()
      ctx.moveTo(-8, 4)
      ctx.lineTo(-3, -4)
      ctx.lineTo(3, 4)
      ctx.lineTo(8, -4)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 1.5)
      ctx.stroke()
    }
    ctx.restore()
  }
  // trodden down patches
  blotches(ctx, w, h, 6, "#b8a6ff", "#000000", .12)
}, { repeat: [14, 14] }))

export const carpetBump = () => cached("carpetBump", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, w, h)
  grain(ctx, w, h, 160, 0)
}, { repeat: [28, 28], color: false }))

// old painted plaster, a bit dirtier at the bottom
export const wallPaint = () => cached("wallPaint", () => texture(512, 256, (ctx, w, h) => {
  ctx.fillStyle = "#2b2438"
  ctx.fillRect(0, 0, w, h)
  blotches(ctx, w, h, 24, "#4a3f60", "#120e18", .35)
  const dirt = ctx.createLinearGradient(0, 0, 0, h)
  dirt.addColorStop(0, "rgba(0, 0, 0, 0)")
  dirt.addColorStop(1, "rgba(10, 6, 4, .45)")
  ctx.fillStyle = dirt
  ctx.fillRect(0, 0, w, h)
  grain(ctx, w, h, 14, 0)
}, { repeat: [6, 1] }))

export const wallBump = () => cached("wallBump", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, w, h)
  blotches(ctx, w, h, 48, "#ffffff", "#000000", .4)
  grain(ctx, w, h, 50, 0)
}, { repeat: [16, 4], color: false }))

// dark wood boards on the lower part of the wall
export const wainscot = () => cached("wainscot", () => texture(512, 256, (ctx, w, h) => {
  const boards = 4
  const board = w / boards
  for (let i = 0; i < boards; i++) {
    const tone = random(-8, 8)
    ctx.fillStyle = `rgb(${ 52 + tone }, ${ 30 + tone }, ${ 20 + tone })`
    ctx.fillRect(i * board, 0, board, h)
    // grain
    for (let line = 0; line < 26; line++) {
      ctx.strokeStyle = `rgba(20, 10, 4, ${ random(.15, .45) })`
      ctx.lineWidth = random(.5, 2)
      const x = i * board + random(4, board - 4)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + random(-6, 6), h * .3, x + random(-6, 6), h * .7, x + random(-4, 4), h)
      ctx.stroke()
    }
    // gap between boards
    ctx.fillStyle = "rgba(0, 0, 0, .8)"
    ctx.fillRect(i * board, 0, 3, h)
  }
  scratches(ctx, w, h, 60, "#c9a27c")
  grain(ctx, w, h, 12, 0)
}, { repeat: [12, 1] }))

export const ceilingTiles = () => cached("ceilingTiles", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#3a3840"
  ctx.fillRect(0, 0, w, h)
  grain(ctx, w, h, 40, .2)
  // a water stain on one of the tiles
  const stain = ctx.createRadialGradient(170, 80, 4, 170, 80, 50)
  stain.addColorStop(0, "rgba(70, 50, 20, .5)")
  stain.addColorStop(1, "rgba(70, 50, 20, 0)")
  ctx.fillStyle = stain
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#1c1a20"
  ctx.fillRect(0, 0, w, 6)
  ctx.fillRect(0, 0, 6, h)
  ctx.fillRect(0, h / 2, w, 4)
  ctx.fillRect(w / 2, 0, 4, h)
}, { repeat: [12, 12] }))

// generic roughness for anything worn: lighter is rougher
export const wear = () => cached("wear", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#9a9a9a"
  ctx.fillRect(0, 0, w, h)
  blotches(ctx, w, h, 12, "#ffffff", "#404040", .5)
  scratches(ctx, w, h, 120, "#ffffff")
  grain(ctx, w, h, 20, 0)
}, { color: false }))

export const brushedMetal = () => cached("brushedMetal", () => texture(256, 64, (ctx, w, h) => {
  ctx.fillStyle = "#8d9096"
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = `rgba(${ Math.random() < .5 ? "255, 255, 255" : "0, 0, 0" }, ${ random(0, .12) })`
    ctx.fillRect(0, y, w, 1)
  }
  scratches(ctx, w, h, 40, "#ffffff")
}))

/* MACHINES */

// soft dark blob under things standing on the floor
export const contactShadow = () => cached("contactShadow", () => texture(128, 128, (ctx, w, h) => {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2)
  gradient.addColorStop(0, "rgba(0, 0, 0, .9)")
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}))

// black laminate of the cabinets, tinted with the colour of each one
export const laminate = () => cached("laminate", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#d8d8d8"
  ctx.fillRect(0, 0, w, h)
  blotches(ctx, w, h, 10, "#ffffff", "#9a9a9a", .5)
  scratches(ctx, w, h, 90, "#ffffff")
  grain(ctx, w, h, 10, 0)
}, { repeat: [2, 4] }))

// art on the sides of a cabinet. Covers the side profile: x is depth from -.5 to .6, y is height from 0 to 2.1
export const SIDE_ART_BOUNDS = { minZ: -.5, maxZ: .6, maxY: 2.1 }

export const sideArt = (config: MachineConfig, index: number) => cached("side" + config.path, () => texture(512, 1024, (ctx, w, h) => {
  const base = ctx.createLinearGradient(0, h, 0, 0)
  base.addColorStop(0, "#050505")
  base.addColorStop(.35, config.side)
  base.addColorStop(1, config.side)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // big swooshes from the back to the front
  ctx.save()
  ctx.globalAlpha = .9
  for (let band = 0; band < 3; band++) {
    ctx.fillStyle = band === 1 ? "#0a0a0a" : config.accent
    ctx.beginPath()
    const y = h * (.55 + band * .07)
    ctx.moveTo(0, y + 160)
    ctx.quadraticCurveTo(w * .5, y + 40, w, y - 120)
    ctx.lineTo(w, y - 120 + 26)
    ctx.quadraticCurveTo(w * .5, y + 66, 0, y + 186)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // something of each game on the top part
  ctx.save()
  ctx.globalAlpha = .85
  if (index === 0) {
    // falling blocks
    const block = 34
    const pieces = [[[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]]]
    for (let i = 0; i < 9; i++) {
      const piece = pieces[i % pieces.length]
      const x = random(40, w - 160)
      const y = random(60, h * .48)
      piece.forEach(([bx, by]) => {
        ctx.fillStyle = config.accent
        ctx.fillRect(x + bx * block, y + by * block, block - 4, block - 4)
        ctx.fillStyle = "rgba(0, 0, 0, .35)"
        ctx.fillRect(x + bx * block + 8, y + by * block + 8, block - 20, block - 20)
      })
    }
  } else if (index === 1) {
    // pixel sparkles and a big pixel heart
    const pixel = 16
    const heart = ["01100110", "11111111", "11111111", "01111110", "00111100", "00011000"]
    heart.forEach((row, y) => [...row].forEach((on, x) => {
      if (on === "1") {
        ctx.fillStyle = config.accent
        ctx.fillRect(w / 2 - 64 + x * pixel, 160 + y * pixel, pixel - 2, pixel - 2)
      }
    }))
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? config.accent : "#ffffff"
      const s = Math.random() < .3 ? 8 : 4
      const x = random(20, w - 20)
      const y = random(30, h * .5)
      ctx.fillRect(x - s * 1.5, y, s * 4, s)
      ctx.fillRect(x, y - s * 1.5, s, s * 4)
    }
  } else {
    // bubbles and lightning
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 3 ? config.accent : "#ffffff"
      ctx.lineWidth = random(4, 10)
      ctx.beginPath()
      ctx.arc(random(40, w - 40), random(60, h * .5), random(14, 60), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = config.accent
    ctx.beginPath()
    ctx.moveTo(w * .55, 120)
    ctx.lineTo(w * .35, 330)
    ctx.lineTo(w * .5, 330)
    ctx.lineTo(w * .4, 520)
    ctx.lineTo(w * .7, 270)
    ctx.lineTo(w * .55, 270)
    ctx.lineTo(w * .65, 120)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // years of people leaning on it
  scratches(ctx, w, h, 220, "#ffffff")
  blotches(ctx, w, h, 8, "#ffffff", "#000000", .18)
  grain(ctx, w, h, 14, 0)
}))

export const controlPanel = (config: MachineConfig) => cached("panel" + config.path, () => texture(512, 192, (ctx, w, h) => {
  ctx.fillStyle = "#0b0b0d"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = config.side
  ctx.globalAlpha = .9
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.quadraticCurveTo(w * .4, h * .2, w, h * .45)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = config.accent
  ctx.lineWidth = 4
  ctx.strokeRect(6, 6, w - 12, h - 12)
  ctx.fillStyle = config.accent
  ctx.font = `22px ${ FONT }`
  ctx.fillText("1P", 24, 40)
  ctx.fillText("PUSH", w - 110, 40)
  // the paint is gone where the hands rest
  blotches(ctx, w, h, 8, "#ffffff", "#000000", .15)
  scratches(ctx, w, h, 160, "#ffffff")
}, { text: true }))

// coin door: two coin slots with their lit price, the return flaps and the lock
export const coinDoor = () => cached("coinDoor", () => texture(256, 320, (ctx, w, h) => {
  ctx.fillStyle = "#3b3d42"
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${ random(0, .05) })`
    ctx.fillRect(0, y, w, 1)
  }
  ;[64, 192].forEach((x) => {
    ctx.fillStyle = "#1a1b1e"
    ctx.fillRect(x - 40, 30, 80, 120)
    ctx.fillStyle = "#c7c9cf"
    ctx.fillRect(x - 34, 36, 68, 108)
    // price, lit from behind
    ctx.fillStyle = "#ff3b1f"
    ctx.fillRect(x - 26, 44, 52, 36)
    ctx.fillStyle = "#ffe0d6"
    ctx.font = `22px ${ FONT }`
    ctx.textAlign = "center"
    ctx.fillText("25C", x, 70)
    // slot
    ctx.fillStyle = "#050505"
    ctx.fillRect(x - 4, 92, 8, 40)
    // return flap
    ctx.fillStyle = "#1a1b1e"
    ctx.fillRect(x - 30, 196, 60, 50)
    ctx.fillStyle = "#55575d"
    ctx.fillRect(x - 24, 202, 48, 38)
  })
  ctx.fillStyle = "#c9a43a"
  ctx.beginPath()
  ctx.arc(w / 2, 280, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#3a2c08"
  ctx.fillRect(w / 2 - 2, 272, 4, 16)
  scratches(ctx, w, h, 80, "#ffffff")
}, { text: true }))

// lit coin prices are the only part of the door that glows
export const coinDoorGlow = () => cached("coinDoorGlow", () => texture(256, 320, (ctx, w, h) => {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#ff3b1f"
  ;[64, 192].forEach((x) => ctx.fillRect(x - 26, 44, 52, 36))
}))

// what the curved glass of a screen reflects: a soft band of light across it and the pink of the neon at the top.
// Black is nothing, it's added on top of the page
export const glassSheen = () => cached("glassSheen", () => texture(256, 192, (ctx, w, h) => {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, w, h)
  const band = ctx.createLinearGradient(w * .1, 0, w * .55, h)
  band.addColorStop(0, "rgba(255, 255, 255, 0)")
  band.addColorStop(.42, "rgba(255, 255, 255, .05)")
  band.addColorStop(.5, "rgba(255, 255, 255, .22)")
  band.addColorStop(.58, "rgba(255, 255, 255, .05)")
  band.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = band
  ctx.fillRect(0, 0, w, h)
  const neon = ctx.createRadialGradient(w / 2, -h * .15, 4, w / 2, -h * .15, h * .7)
  neon.addColorStop(0, "rgba(255, 47, 142, .35)")
  neon.addColorStop(1, "rgba(255, 47, 142, 0)")
  ctx.fillStyle = neon
  ctx.fillRect(0, 0, w, h)
  // the edges of the tube curve away and catch more of the room
  const edges = ctx.createRadialGradient(w / 2, h / 2, h * .45, w / 2, h / 2, w * .62)
  edges.addColorStop(0, "rgba(255, 255, 255, 0)")
  edges.addColorStop(1, "rgba(150, 140, 200, .12)")
  ctx.fillStyle = edges
  ctx.fillRect(0, 0, w, h)
}))

export const speakerGrille = () => cached("speakerGrille", () => texture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#0c0c0c"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#000000"
  for (let y = 4; y < h; y += 8) {
    for (let x = 4 + (y % 16 ? 4 : 0); x < w; x += 8) {
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}, { repeat: [6, 1] }))

// backlit marquee on top of a cabinet
export const marquee = (config: MachineConfig) => cached("marquee" + config.path, () => texture(1024, 256, (ctx, w, h) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, config.side)
  gradient.addColorStop(1, "#000000")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  // rays behind the title
  ctx.save()
  ctx.translate(w / 2, h * 1.2)
  ctx.fillStyle = "rgba(255, 255, 255, .06)"
  for (let ray = 0; ray < 18; ray++) {
    ctx.rotate(Math.PI / 18)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-40, -h * 2)
    ctx.lineTo(40, -h * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.strokeStyle = config.accent
  ctx.lineWidth = 10
  ctx.strokeRect(14, 14, w - 28, h - 28)

  ctx.font = `150px ${ FONT }`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.shadowColor = config.accent
  ctx.shadowBlur = 26
  ctx.fillStyle = config.accent
  // long titles are squeezed to fit
  ctx.fillText(config.title.toUpperCase(), w / 2, h * .53, w - 120)
  ctx.shadowBlur = 0
  ctx.lineWidth = 4
  ctx.strokeStyle = "#000000"
  ctx.strokeText(config.title.toUpperCase(), w / 2, h * .53, w - 120)
}, { text: true }))

/* PROPS */

interface PosterArt {
  title: string
  background: [string, string]
  color: string
  motif: "sun" | "ship" | "ghosts"
}

export const POSTERS: PosterArt[] = [
  { title: "BLADE RUNNER", background: ["#2a0a3a", "#ff5e9a"], color: "#ffe14d", motif: "sun" },
  { title: "TRON SOON", background: ["#020314", "#1b2a6a"], color: "#33e1ff", motif: "ship" },
  { title: "PACMAN", background: ["#050505", "#1d1d1d"], color: "#ffd84a", motif: "ghosts" },
]

export const poster = (art: PosterArt) => cached("poster" + art.title, () => texture(384, 512, (ctx, w, h) => {
  const background = ctx.createLinearGradient(0, 0, 0, h)
  background.addColorStop(0, art.background[0])
  background.addColorStop(1, art.background[1])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  if (art.motif === "sun") {
    const sun = ctx.createLinearGradient(0, 120, 0, 330)
    sun.addColorStop(0, "#ffe14d")
    sun.addColorStop(1, "#ff3fa4")
    ctx.fillStyle = sun
    ctx.beginPath()
    ctx.arc(w / 2, 300, 120, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = art.background[0]
    for (let y = 230; y < 300; y += 16) ctx.fillRect(0, y, w, (y - 220) / 10)
    ctx.strokeStyle = "#ff3fa4"
    ctx.lineWidth = 2
    for (let x = -w; x < w * 2; x += 40) {
      ctx.beginPath()
      ctx.moveTo(w / 2, 300)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 310; y < h; y += (y - 290) / 3) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
  } else if (art.motif === "ship") {
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${ random(.2, 1) })`
      ctx.fillRect(random(0, w), random(0, h), 2, 2)
    }
    ctx.fillStyle = art.color
    ctx.beginPath()
    ctx.moveTo(w / 2, 170)
    ctx.lineTo(w / 2 - 70, 360)
    ctx.lineTo(w / 2, 320)
    ctx.lineTo(w / 2 + 70, 360)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#ff5a1f"
    ctx.fillRect(w / 2 - 10, 330, 20, 60)
  } else {
    ctx.strokeStyle = "#2b3bff"
    ctx.lineWidth = 10
    ctx.strokeRect(40, 150, w - 80, 250)
    ctx.strokeRect(110, 220, w - 220, 110)
    ;["#ff3b3b", "#33e1ff", "#ffb8ff"].forEach((color, i) => {
      const x = 110 + i * 82
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, 186, 22, Math.PI, 0)
      ctx.lineTo(x + 22, 212)
      ctx.lineTo(x - 22, 212)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(x - 12, 180, 8, 8)
      ctx.fillRect(x + 4, 180, 8, 8)
    })
    ctx.fillStyle = art.color
    ctx.beginPath()
    ctx.arc(w / 2, 370, 26, .3, Math.PI * 2 - .3)
    ctx.lineTo(w / 2, 370)
    ctx.fill()
  }

  ctx.font = `56px ${ FONT }`
  ctx.textAlign = "center"
  ctx.fillStyle = art.color
  ctx.shadowColor = "#000000"
  ctx.shadowBlur = 8
  ctx.fillText(art.title.toUpperCase(), w / 2, 80, w - 30)
  ctx.font = `22px ${ FONT }`
  ctx.fillText("IN DEVELOPMENT", w / 2, h - 30)
  ctx.shadowBlur = 0

  // old paper: faded, with folds
  ctx.fillStyle = "rgba(220, 200, 160, .12)"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "rgba(255, 255, 255, .12)"
  ctx.fillRect(w / 2 - 1, 0, 2, h)
  ctx.fillRect(0, h / 2 - 1, w, 2)
  grain(ctx, w, h, 18, .15)
}, { text: true }))

// the real best tetris scores (see src/leaderboard.ts), redrawn whenever they change
export const tetrisLeaderboard = () => cached("tetrisLeaderboard", () => {
  const draw: Draw = (ctx, w, h) => {
    const { scores, status } = useLeaderboard.getState()
    ctx.fillStyle = "#0b0f08"
    ctx.fillRect(0, 0, w, h)
    ctx.textBaseline = "top"
    ctx.textAlign = "center"
    ctx.fillStyle = "#c8e06a"
    ctx.font = `34px ${ FONT }`
    ctx.fillText("TETRIS LEADERBOARD", w / 2, 26, w - 40)
    ctx.font = `30px ${ FONT }`

    const top = scores.slice(0, 5)
    if (!top.length) {
      ctx.fillStyle = "#a8b987"
      ctx.fillText(status === "offline" ? "OUT OF ORDER" : status === "ready" ? "NO SCORES YET" : "LOADING...", w / 2, 170)
    }
    top.forEach(({ name, score }, i) => {
      ctx.fillStyle = i ? "#a8b987" : "#ffe14d"
      ctx.textAlign = "left"
      ctx.fillText(`${ i + 1 }. ${ name }`, 60, 100 + i * 50)
      ctx.textAlign = "right"
      ctx.fillText(String(score), w - 60, 100 + i * 50)
    })
    grain(ctx, w, h, 10, .1)
  }

  const result = texture(512, 384, draw, { text: true })
  const repaint = () => {
    const ctx = (result.image as HTMLCanvasElement).getContext("2d")!
    draw(ctx, 512, 384)
    result.needsUpdate = true
  }
  useLeaderboard.subscribe((state, previous) => {
    if (state.scores !== previous.scores || state.status !== previous.status) repaint()
  })
  if (useLeaderboard.getState().status === "idle") useLeaderboard.getState().refresh()
  return result
})

export const exitSign = () => cached("exitSign", () => texture(256, 96, (ctx, w, h) => {
  ctx.fillStyle = "#0a3d16"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#c9ffd6"
  ctx.font = `64px ${ FONT }`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("EXIT", w / 2 - 14, h / 2 + 4)
  ctx.beginPath()
  ctx.moveTo(w - 46, h / 2 - 16)
  ctx.lineTo(w - 22, h / 2)
  ctx.lineTo(w - 46, h / 2 + 16)
  ctx.fill()
}, { text: true }))

export const changeMachine = () => cached("changeMachine", () => texture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = "#6d7178"
  ctx.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${ random(0, .06) })`
    ctx.fillRect(0, y, w, 1)
  }
  ctx.fillStyle = "#151515"
  ctx.fillRect(24, 24, w - 48, 120)
  ctx.fillStyle = "#ffcf3a"
  ctx.font = `46px ${ FONT }`
  ctx.textAlign = "center"
  ctx.fillText("CHANGE", w / 2, 100)
  ctx.fillStyle = "#1c1c1c"
  ctx.fillRect(60, 190, w - 120, 18)
  ctx.fillStyle = "#33e1ff"
  ctx.fillRect(70, 194, w - 140, 10)
  ctx.fillStyle = "#e8e8e8"
  ctx.font = `20px ${ FONT }`
  ctx.fillText("BILLS HERE", w / 2, 240)
  ctx.fillStyle = "#111111"
  ctx.fillRect(48, 380, w - 96, 90)
  ctx.fillStyle = "#2a2a2a"
  ctx.fillRect(56, 388, w - 112, 74)
  scratches(ctx, w, h, 100, "#ffffff")
}, { text: true }))

export const changeMachineGlow = () => cached("changeMachineGlow", () => texture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#ffcf3a"
  ctx.font = `46px ${ FONT }`
  ctx.textAlign = "center"
  ctx.fillText("CHANGE", w / 2, 100)
  ctx.fillStyle = "#33e1ff"
  ctx.fillRect(70, 194, w - 140, 10)
}, { text: true }))

// lid of the pizza box Bitcente would love to get his hands on
export const pizzaBox = () => cached("pizzaBox", () => texture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#c79a62"
  ctx.fillRect(0, 0, w, h)
  grain(ctx, w, h, 20, .1)
  ctx.strokeStyle = "#b8282a"
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "#b8282a"
  ctx.font = `34px ${ FONT }`
  ctx.textAlign = "center"
  ctx.fillText("PIZZA", w / 2, h / 2 + 12)
  // grease
  ctx.fillStyle = "rgba(90, 50, 10, .35)"
  ctx.beginPath()
  ctx.arc(60, 190, 26, 0, Math.PI * 2)
  ctx.fill()
}, { text: true }))
