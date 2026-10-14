import { MutableRefObject, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import Machine from "./Machine"
import {
  fitPose, FOV, MACHINES, machineWidth, placement, Pose, rectToQuad, roomPose, SCREEN_HEIGHT, screenPose, screenWidth,
} from "./layout"
import { useArcadeStore } from "./store"

const BACKGROUND = "#040308"
const WALL_Z = -.62
const CEILING = 3.3

// dom elements shown through the screens, one per machine with its page inside
export type ArcadeScreens = (HTMLDivElement | null)[]

interface ArcadeRoomProps {
  screens: MutableRefObject<ArcadeScreens>
  onSelect: (machine: number) => void
  onHover: (hovered: boolean) => void
}

// worn out carpet with the confetti every arcade had
function carpetTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#0d0b18"
  ctx.fillRect(0, 0, 256, 256)

  const colors = ["#ff3fa4", "#33e1ff", "#ffe14d", "#7dff6a", "#9b6bff"]
  for (let i = 0; i < 70; i++) {
    ctx.save()
    ctx.translate(Math.random() * 256, Math.random() * 256)
    ctx.rotate(Math.random() * Math.PI)
    ctx.globalAlpha = .35 + Math.random() * .3
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

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(24, 24)
  texture.anisotropy = 8
  return texture
}

function neonTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 256
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const paint = () => {
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, 1024, 256)
    ctx.font = "170px Tickerbit, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "#ff2f8e"
    ctx.shadowBlur = 40
    ctx.fillStyle = "#ff2f8e"
    ctx.fillText("ARCADE", 512, 140)
    // hot core of the tube
    ctx.shadowBlur = 8
    ctx.fillStyle = "#ffd3e8"
    ctx.fillText("ARCADE", 512, 140)
    texture.needsUpdate = true
  }
  paint()
  document.fonts.load("64px Tickerbit").then(paint).catch(() => {})
  return texture
}

function Room() {
  const carpet = useMemo(carpetTexture, [])
  const neon = useMemo(neonTexture, [])
  const neonLight = useRef<THREE.PointLight>(null)
  const neonSign = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => () => {
    carpet.dispose()
    neon.dispose()
  }, [])

  // the sign buzzes and drops out every now and then
  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    const dropout = Math.sin(time * 1.7) > .985 || Math.sin(time * 23) * Math.sin(time * .9) > .93
    const level = dropout ? .35 : .92 + Math.sin(time * 60) * .04
    if (neonLight.current) neonLight.current.intensity = 5 * level
    if (neonSign.current) neonSign.current.color.setScalar(level)
  })

  return (
    <>
      <color attach="background" args={ [BACKGROUND] } />
      <fogExp2 attach="fog" args={ [BACKGROUND, .045] } />
      <ambientLight intensity={ .3 } color="#8a86c8" />
      {/* tired ceiling lamp, somewhere behind the player */}
      <pointLight position={ [0, CEILING - .3, 3.2] } color="#ffcf9a" intensity={ 11 } distance={ 14 } decay={ 2 } />

      <mesh rotation-x={ -Math.PI / 2 } position={ [0, 0, 8] }>
        <planeGeometry args={ [48, 48] } />
        <meshStandardMaterial map={ carpet } roughness={ 1 } />
      </mesh>
      <mesh position={ [0, CEILING / 2, WALL_Z] }>
        <planeGeometry args={ [48, CEILING] } />
        <meshStandardMaterial color="#3a3350" roughness={ .95 } />
      </mesh>
      <mesh rotation-x={ Math.PI / 2 } position={ [0, CEILING, 8] }>
        <planeGeometry args={ [48, 48] } />
        <meshStandardMaterial color="#0c0b10" roughness={ 1 } />
      </mesh>
      {/* skirting board */}
      <mesh position={ [0, .06, WALL_Z + .012] }>
        <boxGeometry args={ [48, .12, .02] } />
        <meshStandardMaterial color="#08070c" roughness={ .6 } />
      </mesh>

      <mesh position={ [0, 2.68, WALL_Z + .03] }>
        <planeGeometry args={ [2.2, .55] } />
        <meshBasicMaterial ref={ neonSign } map={ neon } transparent toneMapped={ false } fog={ false } />
      </mesh>
      <pointLight ref={ neonLight } position={ [0, 2.68, WALL_Z + .5] } color="#ff2f8e" intensity={ 5 } distance={ 11 } decay={ 2 } />
    </>
  )
}

// moves the camera between the room and the screens, and keeps the dom screens glued to their machines
function Rig({ screens }: { screens: MutableRefObject<ArcadeScreens> }) {
  const camera = useThree((state) => state.camera)

  const fly = useRef({ progress: 1 })
  const from = useRef<Pose>({ position: new THREE.Vector3(), quaternion: new THREE.Quaternion() })
  // where the camera is without the sway of the cursor
  const rest = useRef(new THREE.Vector3())
  // still and fitted to a screen, so the next flight has to start from exactly there
  const fitted = useRef(true)
  const sway = useRef(new THREE.Vector2())
  // flight waiting for a couple of frames to be drawn, so a slow first frame doesn't eat its beginning
  const waiting = useRef<{ tween: gsap.core.Tween, frames: number }>()
  const corner = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    let tween: gsap.core.Tween | undefined

    const start = () => {
      const { view, machine, settled, settle } = useArcadeStore.getState()
      tween?.kill()

      if (fitted.current) {
        const fit = fitPose(machine, window.innerWidth / window.innerHeight)
        camera.position.copy(fit.position)
        camera.quaternion.copy(fit.quaternion)
        rest.current.copy(fit.position)
      }
      // a machine is being played, nothing to fly to. Its page has the window for itself
      if (settled) {
        const screen = screens.current[machine]
        if (screen) screen.style.transform = ""
        return
      }

      fitted.current = false
      from.current.position.copy(rest.current)
      from.current.quaternion.copy(camera.quaternion)
      fly.current.progress = 0

      tween = gsap.to(fly.current, {
        progress: 1,
        duration: view === "room" ? 1.9 : 1.6,
        ease: "power3.inOut",
        paused: true,
        onComplete: () => {
          if (view !== "screen") return
          fitted.current = true
          // the page takes the window back
          const screen = screens.current[machine]
          if (screen) screen.style.transform = ""
          settle()
        },
      })
      waiting.current = { tween, frames: 0 }
    }
    start()

    // right when the store changes and not in a react effect: the next frame already has to fly from
    // where the camera is, a frame rendered in between would jump straight to the new destination
    const unsubscribe = useArcadeStore.subscribe((state, previous) => {
      if (state.view !== previous.view || state.machine !== previous.machine) start()
    })
    return () => {
      unsubscribe()
      tween?.kill()
    }
  }, [])

  useFrame(({ size, pointer }, delta) => {
    const { view, machine, settled } = useArcadeStore.getState()
    if (settled) return

    if (waiting.current && ++waiting.current.frames > 2) {
      waiting.current.tween.play()
      waiting.current = undefined
    }

    const aspect = size.width / size.height
    const progress = fly.current.progress
    const to = view === "room" ? roomPose(aspect) : fitPose(machine, aspect)
    camera.position.lerpVectors(from.current.position, to.position, progress)
    camera.quaternion.slerpQuaternions(from.current.quaternion, to.quaternion, progress)
    rest.current.copy(camera.position)

    // the camera follows the cursor a bit while standing in the room, and lets go on the way to a screen
    const amount = view === "room" ? progress : 0
    const ease = Math.min(1, delta * 3)
    sway.current.x += (pointer.x * amount - sway.current.x) * ease
    sway.current.y += (pointer.y * amount - sway.current.y) * ease
    const hold = view === "room" ? 1 : 1 - progress
    camera.position.x += sway.current.x * .3 * hold
    camera.position.y += sway.current.y * .12 * hold
    camera.updateMatrixWorld()

    screens.current.forEach((element, index) => {
      if (!element) return

      const { position, quaternion } = screenPose(index, aspect)
      const halfWidth = screenWidth(aspect) / 2
      const halfHeight = SCREEN_HEIGHT / 2
      let behind = false
      const quad = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => {
        corner.set(x * halfWidth, y * halfHeight, 0).applyQuaternion(quaternion).add(position).project(camera)
        if (corner.z > 1) behind = true
        return [(corner.x + 1) / 2 * size.width, (1 - corner.y) / 2 * size.height]
      })

      // out of sight when it's behind the camera
      element.style.transform = (!behind && rectToQuad(size.width, size.height, quad)) || "scale(0)"
    })
  })

  return null
}

function Scene({ screens, onSelect, onHover }: ArcadeRoomProps) {
  const { gl, scene, camera, size } = useThree()
  const aspect = size.width / size.height

  // so the first frame of the first flight doesn't have to wait for the shaders
  useEffect(() => {
    gl.compile(scene, camera)
  }, [])

  return (
    <>
      <Rig screens={ screens } />
      <Room />
      {MACHINES.map((config, index) => {
        const { x, z, rotation } = placement(index, aspect)
        return (
          <Machine
            config={ config }
            width={ machineWidth(aspect) }
            screenWidth={ screenWidth(aspect) }
            position={ [x, 0, z] }
            rotation={ rotation }
            onSelect={ () => onSelect(index) }
            onHover={ onHover }
            key={ config.path }
          />
        )
      })}
    </>
  )
}

export default function ArcadeRoom(props: ArcadeRoomProps) {
  const settled = useArcadeStore((state) => state.settled)

  return (
    <Canvas
      frameloop={ settled ? "never" : "always" }
      dpr={ [1, 2] }
      gl={ { alpha: true, antialias: true } }
      camera={ { fov: FOV, near: .05, far: 80 } }
    >
      <Scene { ...props } />
    </Canvas>
  )
}
