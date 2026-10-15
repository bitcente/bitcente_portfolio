import * as THREE from "three"

export interface MachineConfig {
  // route shown in the screen of the machine
  path: string
  // name on the marquee
  title: string
  // colours of the cabinet
  body: string
  side: string
  accent: string
  // light the screen throws into the room
  glow: string
  // silhouette: how far the control deck and the marquee stick out, and how tall the cabinet is
  deckOut: number
  marqueeOut: number
  top: number
}

// from left to right
export const MACHINES: MachineConfig[] = [
  {
    path: "/tetris",
    title: "Tetris",
    body: "#2c3122",
    side: "#566b2c",
    accent: "#c8e06a",
    glow: "#a8b987",
    deckOut: .42,
    marqueeOut: .24,
    top: 2,
  },
  {
    path: "/",
    title: "Portfolio",
    body: "#33251f",
    side: "#a8431f",
    accent: "#ffb347",
    glow: "#a8b987",
    deckOut: .48,
    marqueeOut: .3,
    top: 2,
  },
  {
    path: "/pokemon",
    title: "Pokemon",
    body: "#222a38",
    side: "#1f4f9c",
    accent: "#ffd84a",
    glow: "#a8b987",
    deckOut: .38,
    marqueeOut: .2,
    top: 2,
  },
]

// everything is in metres. The screens always have the shape of the window, so a machine can be entered
// by fitting its screen to it
export const FOV = 38
export const SCREEN_HEIGHT = .6
export const PANEL = .03
const SCREEN_MARGIN = .06
// room between the cabinets, and around the row in the room view for the things at the sides
const GAP = .45
const ROW_MARGIN = .9
// the machines at the sides look a bit towards the middle of the room
const TURN = .2

// slanted face of the cabinet the screen sits on, in the side profile (z towards the player, y up)
export const FACE_BOTTOM = { z: .16, y: .97 }
export const FACE_TOP = { z: .02, y: 1.62 }
export const FACE_LENGTH = Math.hypot(FACE_BOTTOM.z - FACE_TOP.z, FACE_TOP.y - FACE_BOTTOM.y)
export const SCREEN_TILT = Math.atan2(FACE_BOTTOM.z - FACE_TOP.z, FACE_TOP.y - FACE_BOTTOM.y)
export const SCREEN_NORMAL = new THREE.Vector3(0, Math.sin(SCREEN_TILT), Math.cos(SCREEN_TILT))
export const SCREEN_CENTER = new THREE.Vector3(0, (FACE_BOTTOM.y + FACE_TOP.y) / 2, (FACE_BOTTOM.z + FACE_TOP.z) / 2)
  .addScaledVector(SCREEN_NORMAL, .004)

// -1 when no machine shows that route
// the same path with or without a slash at the end (/tetris and /tetris/)
export const cleanPath = (path: string) => path.replace(/\/+$/, "") || "/"

export const machineFor = (path: string) => MACHINES.findIndex((machine) => machine.path === cleanPath(path))
// same, falling back to the machine a visitor lands on
export const machineOrHome = (path: string) => machineFor(machineFor(path) < 0 ? "/" : path)

export const screenWidth = (aspect: number) => SCREEN_HEIGHT * aspect
export const machineWidth = (aspect: number) => screenWidth(aspect) + (SCREEN_MARGIN + PANEL) * 2

export function placement(index: number, aspect: number) {
  const offset = index - (MACHINES.length - 1) / 2
  return {
    x: offset * (machineWidth(aspect) + GAP),
    z: Math.abs(offset) * .25,
    rotation: -offset * TURN,
  }
}

export interface Pose {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

const yAxis = new THREE.Vector3(0, 1, 0)
const xAxis = new THREE.Vector3(1, 0, 0)

// where the screen of a machine is in the room
export function screenPose(index: number, aspect: number): Pose {
  const { x, z, rotation } = placement(index, aspect)
  const turn = new THREE.Quaternion().setFromAxisAngle(yAxis, rotation)
  return {
    position: SCREEN_CENTER.clone().applyQuaternion(turn).add(new THREE.Vector3(x, 0, z)),
    quaternion: turn.multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, -SCREEN_TILT)),
  }
}

// distance from a screen at which it covers the whole window
export const FIT_DISTANCE = SCREEN_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(FOV) / 2)

// camera right in front of a screen, at the distance the screen covers the whole window
export function fitPose(index: number, aspect: number): Pose {
  const { position, quaternion } = screenPose(index, aspect)
  return {
    position: position.add(new THREE.Vector3(0, 0, FIT_DISTANCE).applyQuaternion(quaternion)),
    quaternion,
  }
}

// camera at the back of the room, far enough to see every machine
export function roomPose(aspect: number): Pose {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const last = placement(MACHINES.length - 1, aspect)
  const halfRow = last.x + machineWidth(aspect) / 2 + ROW_MARGIN
  const distance = Math.max(halfRow / (tan * aspect), 1.3 / tan) + .9

  const position = new THREE.Vector3(0, 1.5, distance)
  const look = new THREE.Matrix4().lookAt(position, new THREE.Vector3(0, 1.12, 0), yAxis)
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(look) }
}

// solves a x = b by gaussian elimination
function solve(a: number[][], b: number[]) {
  const n = b.length
  for (let column = 0; column < n; column++) {
    let pivot = column
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row
    }
    if (Math.abs(a[pivot][column]) < 1e-10) return null
    ;[a[column], a[pivot]] = [a[pivot], a[column]]
    ;[b[column], b[pivot]] = [b[pivot], b[column]]

    for (let row = column + 1; row < n; row++) {
      const factor = a[row][column] / a[column][column]
      for (let k = column; k < n; k++) a[row][k] -= factor * a[column][k]
      b[row] -= factor * b[column]
    }
  }

  const x = new Array<number>(n)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k]
    x[row] = sum / a[row][row]
  }
  return x
}

// css transform (with transform-origin 0 0) that takes an element of width x height px to the 4 corners
// of a quad, given as [x, y] in px starting at the top left and going clockwise
export function rectToQuad(width: number, height: number, quad: number[][]) {
  const source = [[0, 0], [width, 0], [width, height], [0, height]]
  const a: number[][] = []
  const b: number[] = []
  source.forEach(([x, y], i) => {
    const [u, v] = quad[i]
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v])
    b.push(v)
  })

  const h = solve(a, b)
  if (!h || h.some((value) => !Number.isFinite(value))) return null
  return `matrix3d(${ [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(",") })`
}
