import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { PerformanceMonitor } from "@react-three/drei"
import { gsap } from "gsap"
import Machine from "./Machine"
import Room from "./Room"
import {
  fitPose, FOV, MACHINES, machineWidth, placement, Pose, rectToQuad, roomPose, SCREEN_HEIGHT, screenPose, screenWidth,
} from "./layout"
import { useArcadeStore } from "./store"

// dom elements shown through the screens, one per machine with its page inside
export type ArcadeScreens = (HTMLDivElement | null)[]

interface ArcadeRoomProps {
  screens: MutableRefObject<ArcadeScreens>
  onSelect: (machine: number) => void
  onHover: (hovered: boolean) => void
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

// The room doesn't move, so the shadows and the reflections are made once, and again only when the machines
// are moved around for another shape of window
function useStaticLighting(aspect: number) {
  const { gl, scene } = useThree()
  const pending = useRef(0)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    // a couple of frames later, once everything is in place
    pending.current = 3
  }, [aspect])

  useFrame(() => {
    if (!pending.current || --pending.current) return

    // the screens are seen as glowing panels instead of holes from where the reflections are taken
    const hidden: THREE.Object3D[] = []
    scene.traverse((object) => {
      if (object.userData.screenHole && object.visible) {
        object.visible = false
        hidden.push(object)
      }
      if (object.userData.screenGlow) object.visible = true
    })

    const generator = new THREE.PMREMGenerator(gl)
    const target = generator.fromScene(scene, .02, .1, 40, { size: 128, position: new THREE.Vector3(0, 1.3, 1.6) })
    generator.dispose()

    hidden.forEach((object) => { object.visible = true })
    scene.traverse((object) => { if (object.userData.screenGlow) object.visible = false })

    // only shiny things get the reflections: on the rest they would hardly show and they cost a lot on every pixel
    const shiny = new Set<THREE.MeshStandardMaterial>()
    scene.traverse((object) => {
      const { material } = object as THREE.Mesh
      ;(Array.isArray(material) ? material : [material]).forEach((item) => {
        if (item instanceof THREE.MeshStandardMaterial && (item.metalness >= .6 || item.roughness <= .25)) shiny.add(item)
      })
    })
    shiny.forEach((material) => {
      const previous = material.envMap
      material.envMap = target.texture
      material.needsUpdate = true
      if (previous && previous !== target.texture) previous.dispose()
    })
  })
}

// Work done while a machine is being played and nobody sees the canvas, long before the player presses ESC.
// Done when the player first steps out instead, it freezes the page for a moment right as the camera starts to fly.
// It's split in small pieces, each one when the browser is idle, so the page being played doesn't stutter either:
// - the shaders of every object, one object at a time (in parallel and without blocking where the browser can)
// - a few frames, which make the shadows and the reflections (those change the shaders of the shiny materials,
//   so they're compiled again)
// - a frame seen from the room, so the textures of everything are on the GPU too (from the screen, almost nothing
//   is in sight and they would wait until the first frame out)
const WARM_UP_FRAMES = 3
const WARM_UP_EVERY = 60

function useWarmUp() {
  const { advance, gl, scene, camera } = useThree()

  useEffect(() => {
    let cancelled = false
    const idle = () => new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 })
        else resolve()
      }, WARM_UP_EVERY)
    })
    // stops if the player is already out in the room, the frames are being drawn anyway
    const go = async () => {
      await idle()
      return !cancelled && useArcadeStore.getState().settled
    }

    // as many objects as fit in each moment the browser is idle
    const nextIdle = () => new Promise<IdleDeadline | null>((resolve) => {
      // (Safari has no requestIdleCallback)
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(resolve, { timeout: 1000 })
      else setTimeout(() => resolve(null), WARM_UP_EVERY)
    })
    const compileAll = async () => {
      const objects: THREE.Object3D[] = []
      scene.traverseVisible((object) => {
        if ((object as THREE.Mesh).isMesh || (object as THREE.Points).isPoints) objects.push(object)
      })
      while (objects.length) {
        const deadline = await nextIdle()
        if (cancelled || !useArcadeStore.getState().settled) return false
        const pending: Promise<unknown>[] = []
        do {
          // with the lights of the whole room
          pending.push(gl.compileAsync(objects.shift()!, camera, scene))
        } while (objects.length && deadline && deadline.timeRemaining() > 6)
        await Promise.all(pending)
      }
      return true
    }

    const run = async () => {
      if (!await compileAll()) return
      for (let frame = 0; frame < WARM_UP_FRAMES; frame++) {
        if (!await go()) return
        advance(performance.now())
      }
      if (!await compileAll()) return

      if (!await go()) return
      const position = camera.position.clone()
      const quaternion = camera.quaternion.clone()
      const room = roomPose(window.innerWidth / window.innerHeight)
      camera.position.copy(room.position)
      camera.quaternion.copy(room.quaternion)
      camera.updateMatrixWorld()
      advance(performance.now())
      camera.position.copy(position)
      camera.quaternion.copy(quaternion)
      camera.updateMatrixWorld()
    }
    run()
    return () => { cancelled = true }
  }, [])
}

function Scene({ screens, onSelect, onHover }: ArcadeRoomProps) {
  const size = useThree((state) => state.size)
  const aspect = size.width / size.height

  useStaticLighting(aspect)
  useWarmUp()

  return (
    <>
      <Rig screens={ screens } />
      <Room aspect={ aspect } />
      {MACHINES.map((config, index) => {
        const { x, z, rotation } = placement(index, aspect)
        return (
          <Machine
            config={ config }
            index={ index }
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

// pixel ratio of the canvas: starts at what the screen has (up to MAX_DPR) and goes down to MIN_DPR, in steps,
// while the frame rate is too low
const MAX_DPR = 1.5
const MIN_DPR = .75
const DPR_STEP = .25

export default function ArcadeRoom(props: ArcadeRoomProps) {
  const settled = useArcadeStore((state) => state.settled)
  const best = Math.max(MIN_DPR, Math.min(window.devicePixelRatio, MAX_DPR))
  const [dpr, setDpr] = useState(best)

  return (
    <Canvas
      frameloop={ settled ? "never" : "always" }
      dpr={ dpr }
      shadows="soft"
      // screens with many pixels are smooth enough without multisampling, which is expensive there
      gl={ { alpha: true, antialias: window.devicePixelRatio < 1.5 } }
      camera={ { fov: FOV, near: .05, far: 80 } }
    >
      <PerformanceMonitor
        factor={ 1 }
        flipflops={ 3 }
        onChange={ ({ factor }) => {
          const next = Math.round((MIN_DPR + (best - MIN_DPR) * factor) / DPR_STEP) * DPR_STEP
          setDpr(Math.max(MIN_DPR, Math.min(best, next)))
        } }
        onFallback={ () => setDpr(MIN_DPR) }
      />
      <Scene { ...props } />
    </Canvas>
  )
}
