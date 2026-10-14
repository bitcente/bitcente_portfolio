import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import {
  FACE_BOTTOM, FACE_LENGTH, FACE_TOP, MachineConfig, PANEL, SCREEN_CENTER, SCREEN_HEIGHT, SCREEN_NORMAL, SCREEN_TILT,
} from "./layout"

const BACK = -.45
const FRONT = .3
const MARQUEE_BOTTOM = 1.68

// side profile of the cabinet (z towards the player, y up). grow pushes the front and the top out,
// so the side panels stand a bit proud of the body
function profile({ deckOut, marqueeOut, top }: MachineConfig, grow = 0) {
  const shape = new THREE.Shape()
  shape.moveTo(BACK, 0)
  shape.lineTo(FRONT + grow, 0)
  shape.lineTo(FRONT + grow, .8)
  shape.lineTo(deckOut + grow, .84)
  shape.lineTo(deckOut + grow, .88 + grow)
  shape.lineTo(FACE_BOTTOM.z + grow, FACE_BOTTOM.y + grow)
  shape.lineTo(FACE_TOP.z + grow, FACE_TOP.y)
  shape.lineTo(marqueeOut + grow, MARQUEE_BOTTOM)
  shape.lineTo(marqueeOut + grow, top + grow)
  shape.lineTo(BACK, top + grow)
  shape.closePath()
  return shape
}

// the profile extruded along x and centred on it
function extrude(shape: THREE.Shape, depth: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(depth / 2, 0, 0)
  return geometry
}

// draws once now and again when the web font is there
function useCanvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }, [width, height])

  useEffect(() => {
    let alive = true
    const paint = () => {
      const ctx = (texture.image as HTMLCanvasElement).getContext("2d")
      if (!alive || !ctx) return
      ctx.clearRect(0, 0, width, height)
      draw(ctx)
      texture.needsUpdate = true
    }
    paint()
    document.fonts.load("64px Tickerbit").then(paint).catch(() => {})
    return () => { alive = false }
  }, [texture])

  useEffect(() => () => texture.dispose(), [texture])

  return texture
}

// soft dark blob under the cabinet instead of real shadows
const shadowTexture = (() => {
  let texture: THREE.CanvasTexture | undefined
  return () => {
    if (texture) return texture
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext("2d")!
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
    gradient.addColorStop(0, "rgba(0, 0, 0, .9)")
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    texture = new THREE.CanvasTexture(canvas)
    return texture
  }
})()

interface MachineProps {
  config: MachineConfig
  // width of the cabinet and of its screen
  width: number
  screenWidth: number
  position: [number, number, number]
  rotation: number
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

export default function Machine({ config, width, screenWidth, position, rotation, onSelect, onHover }: MachineProps) {
  const [hovered, setHovered] = useState(false)

  const bodyWidth = width - PANEL * 2
  const marqueeHeight = config.top - MARQUEE_BOTTOM
  const deckDepth = config.deckOut - FACE_BOTTOM.z
  const deckSlope = Math.atan2(FACE_BOTTOM.y - .88, deckDepth)
  // the controls get closer together in narrow cabinets
  const spread = Math.min(.075, bodyWidth * .12)

  const body = useMemo(() => extrude(profile(config), bodyWidth), [config, bodyWidth])
  const panel = useMemo(() => extrude(profile(config, .035), PANEL), [config])
  useEffect(() => () => body.dispose(), [body])
  useEffect(() => () => panel.dispose(), [panel])

  const marquee = useCanvasTexture(1024, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, config.side)
    gradient.addColorStop(1, "#000000")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1024, 256)

    ctx.strokeStyle = config.accent
    ctx.lineWidth = 10
    ctx.strokeRect(14, 14, 996, 228)

    ctx.font = "150px Tickerbit, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = config.accent
    ctx.shadowBlur = 26
    ctx.fillStyle = config.accent
    // long titles are squeezed to fit
    ctx.fillText(config.title.toUpperCase(), 512, 136, 900)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    onHover(true)
  }
  const out = () => {
    setHovered(false)
    onHover(false)
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <group position={ position } rotation-y={ rotation } onPointerOver={ over } onPointerOut={ out } onClick={ click }>
      <mesh geometry={ body }>
        <meshStandardMaterial color={ config.body } roughness={ .75 } metalness={ .1 } />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh geometry={ panel } position-x={ side * (width - PANEL) / 2 } key={ side }>
          <meshStandardMaterial color={ config.side } roughness={ .6 } metalness={ .1 } />
        </mesh>
      ))}

      {/* glass around the screen */}
      <mesh
        position={ [0, SCREEN_CENTER.y - SCREEN_NORMAL.y * .002, SCREEN_CENTER.z - SCREEN_NORMAL.z * .002] }
        rotation-x={ -SCREEN_TILT }
      >
        <planeGeometry args={ [bodyWidth, FACE_LENGTH] } />
        <meshStandardMaterial color="#030303" roughness={ .25 } metalness={ .4 } />
      </mesh>

      {/* the screen is a hole in the canvas, the page is right behind it */}
      <mesh position={ SCREEN_CENTER } rotation-x={ -SCREEN_TILT }>
        <planeGeometry args={ [screenWidth, SCREEN_HEIGHT] } />
        <meshBasicMaterial color="#000000" transparent opacity={ 0 } blending={ THREE.NoBlending } toneMapped={ false } fog={ false } />
      </mesh>
      <pointLight
        position={ [0, SCREEN_CENTER.y + SCREEN_NORMAL.y * .4, SCREEN_CENTER.z + SCREEN_NORMAL.z * .4] }
        color={ config.glow }
        intensity={ 1.1 }
        distance={ 5 }
        decay={ 2 }
      />

      <mesh position={ [0, MARQUEE_BOTTOM + marqueeHeight / 2, config.marqueeOut + .003] }>
        <planeGeometry args={ [bodyWidth - .03, marqueeHeight - .03] } />
        <meshBasicMaterial map={ marquee } color={ hovered ? "#ffffff" : "#b9b9b9" } toneMapped={ false } />
      </mesh>
      <pointLight
        position={ [0, MARQUEE_BOTTOM - .05, config.marqueeOut + .25] }
        color={ config.accent }
        intensity={ hovered ? .9 : .45 }
        distance={ 3 }
        decay={ 2 }
      />

      {/* control deck */}
      <group position={ [0, (.88 + FACE_BOTTOM.y) / 2, (config.deckOut + FACE_BOTTOM.z) / 2] } rotation-x={ deckSlope }>
        <mesh position={ [-spread * 2, .04, 0] }>
          <cylinderGeometry args={ [.01, .01, .08, 8] } />
          <meshStandardMaterial color="#888888" roughness={ .3 } metalness={ .8 } />
        </mesh>
        <mesh position={ [-spread * 2, .09, 0] }>
          <sphereGeometry args={ [.028, 16, 12] } />
          <meshStandardMaterial color="#c8281e" roughness={ .3 } />
        </mesh>
        {[0, 1, 2].map((button) => (
          <mesh position={ [spread * (button + .4), .006, button % 2 ? -.025 : .02] } key={ button }>
            <cylinderGeometry args={ [.022, .022, .012, 16] } />
            <meshStandardMaterial color={ config.accent } roughness={ .35 } emissive={ config.accent } emissiveIntensity={ .25 } />
          </mesh>
        ))}
      </group>

      {/* coin door */}
      <mesh position={ [0, .42, FRONT + .008] }>
        <boxGeometry args={ [Math.min(.26, bodyWidth * .6), .32, .016] } />
        <meshStandardMaterial color="#0a0a0a" roughness={ .4 } metalness={ .7 } />
      </mesh>
      {[-1, 1].map((slot) => (
        <mesh position={ [slot * .045, .47, FRONT + .018] } key={ slot }>
          <planeGeometry args={ [.035, .05] } />
          <meshBasicMaterial color="#ff5a1f" toneMapped={ false } />
        </mesh>
      ))}

      <mesh position={ [0, .004, -.05] } rotation-x={ -Math.PI / 2 }>
        <planeGeometry args={ [width + .7, 1.7] } />
        <meshBasicMaterial map={ shadowTexture() } transparent depthWrite={ false } />
      </mesh>
    </group>
  )
}
