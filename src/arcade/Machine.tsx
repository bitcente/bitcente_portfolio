import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { ThreeEvent, useFrame } from "@react-three/fiber"
import {
  FACE_BOTTOM, FACE_LENGTH, FACE_TOP, FIT_DISTANCE, MachineConfig, PANEL, SCREEN_CENTER, SCREEN_HEIGHT, SCREEN_NORMAL,
  SCREEN_TILT,
} from "./layout"
import {
  brushedMetal, coinDoor, coinDoorGlow, contactShadow, controlPanel, glassSheen, laminate, marquee, sideArt, SIDE_ART_BOUNDS, speakerGrille,
  wear,
} from "./textures"

const BACK = -.45
const FRONT = .3
const MARQUEE_BOTTOM = 1.68
const DECK_FRONT_Y = .88
// plastic edge trim around the side panels
const MOLDING = .012

// side profile of the cabinet (z towards the player, y up). grow pushes the front and the top out,
// so the side panels stand a bit proud of the body
function profile({ deckOut, marqueeOut, top }: MachineConfig, grow = 0) {
  const shape = new THREE.Shape()
  shape.moveTo(BACK - grow * .3, 0)
  shape.lineTo(FRONT + grow, 0)
  shape.lineTo(FRONT + grow, .8)
  shape.lineTo(deckOut + grow, .84)
  shape.lineTo(deckOut + grow, DECK_FRONT_Y + grow)
  shape.lineTo(FACE_BOTTOM.z + grow, FACE_BOTTOM.y + grow)
  shape.lineTo(FACE_TOP.z + grow, FACE_TOP.y)
  shape.lineTo(marqueeOut + grow, MARQUEE_BOTTOM)
  shape.lineTo(marqueeOut + grow, top + grow)
  shape.lineTo(BACK - grow * .3, top + grow)
  shape.closePath()
  return shape
}

// the profile extruded along x and centred on it
function extrude(shape: THREE.Shape, depth: number, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  })
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(depth / 2, 0, 0)
  return geometry
}

// screen glass reflects the room, added on top of the page without darkening it: the colour is added and the
// alpha of the canvas (0 in the hole of the screen) is left as it is
function glassMaterial() {
  const material = new THREE.MeshBasicMaterial({
    map: glassSheen(),
    transparent: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
  material.blending = THREE.CustomBlending
  material.blendSrc = THREE.SrcAlphaFactor
  material.blendDst = THREE.OneFactor
  material.blendSrcAlpha = THREE.ZeroFactor
  material.blendDstAlpha = THREE.OneFactor
  return material
}

interface MachineProps {
  config: MachineConfig
  index: number
  // width of the cabinet and of its screen
  width: number
  screenWidth: number
  position: [number, number, number]
  rotation: number
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

export default function Machine({ config, index, width, screenWidth, position, rotation, onSelect, onHover }: MachineProps) {
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  const bodyWidth = width - PANEL * 2
  const marqueeHeight = config.top - MARQUEE_BOTTOM
  const deckDepth = config.deckOut - FACE_BOTTOM.z
  const deckSlope = Math.atan2(FACE_BOTTOM.y - DECK_FRONT_Y, deckDepth)
  const deckLength = Math.hypot(deckDepth, FACE_BOTTOM.y - DECK_FRONT_Y)
  const underside = Math.hypot(config.marqueeOut - FACE_TOP.z, MARQUEE_BOTTOM - FACE_TOP.y)
  // the controls get closer together in narrow cabinets
  const spread = Math.min(.075, bodyWidth * .12)

  const body = useMemo(() => extrude(profile(config), bodyWidth), [config, bodyWidth])
  const panel = useMemo(() => extrude(profile(config, .035), PANEL - .008, .004), [config])
  const molding = useMemo(() => extrude(profile(config, .035 + MOLDING), MOLDING), [config])
  useEffect(() => () => body.dispose(), [body])
  useEffect(() => () => panel.dispose(), [panel])
  useEffect(() => () => molding.dispose(), [molding])

  const materials = useMemo(() => {
    // side art stretched over the side profile
    const art = sideArt(config, index)
    art.repeat.set(1 / (SIDE_ART_BOUNDS.maxZ - SIDE_ART_BOUNDS.minZ), 1 / SIDE_ART_BOUNDS.maxY)
    art.offset.set(-SIDE_ART_BOUNDS.minZ / (SIDE_ART_BOUNDS.maxZ - SIDE_ART_BOUNDS.minZ), 0)

    const glass = glassMaterial()
    return {
      // the biggest part of the cabinet: lambert, cheaper than the rest for the same rough look
      body: new THREE.MeshLambertMaterial({ color: config.body, map: laminate() }),
      // the faces of the side panels, and their edges
      side: [
        new THREE.MeshStandardMaterial({ map: art, roughnessMap: wear(), roughness: .7, metalness: .05 }),
        new THREE.MeshStandardMaterial({ color: "#111111", roughness: .6 }),
      ],
      molding: new THREE.MeshStandardMaterial({ color: config.accent, roughness: .35, metalness: .3 }),
      glass,
    }
  }, [config, index])
  useEffect(() => () => {
    materials.body.dispose()
    materials.side.forEach((material) => material.dispose())
    materials.molding.dispose()
    materials.glass.dispose()
  }, [materials])

  // the glass only shows from a distance: right in front of the screen the page has to look as it is
  const screenWorld = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    screenWorld.copy(SCREEN_CENTER).applyMatrix4(group.matrixWorld)
    const distance = camera.position.distanceTo(screenWorld)
    materials.glass.opacity = THREE.MathUtils.smoothstep(distance, FIT_DISTANCE * 1.1, FIT_DISTANCE * 2.6)
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

  const onFace = (offset: number) => [
    0,
    SCREEN_CENTER.y - SCREEN_NORMAL.y * .004 + SCREEN_NORMAL.y * offset,
    SCREEN_CENTER.z - SCREEN_NORMAL.z * .004 + SCREEN_NORMAL.z * offset,
  ] as [number, number, number]

  return (
    <group
      ref={ groupRef }
      position={ position }
      rotation-y={ rotation }
      onPointerOver={ over }
      onPointerOut={ out }
      onClick={ click }
    >
      <mesh geometry={ body } material={ materials.body } castShadow receiveShadow />
      {[-1, 1].map((side) => (
        <group position-x={ side * (width - PANEL) / 2 } key={ side }>
          <mesh geometry={ panel } material={ materials.side } castShadow receiveShadow />
          <mesh geometry={ molding } material={ materials.molding } />
        </group>
      ))}

      {/* glass around the screen */}
      <mesh position={ onFace(.002) } rotation-x={ -SCREEN_TILT }>
        <planeGeometry args={ [bodyWidth, FACE_LENGTH] } />
        <meshStandardMaterial color="#030303" roughness={ .2 } metalness={ .2 } />
      </mesh>
      {/* the screen is a hole in the canvas, the page is right behind it... */}
      <mesh position={ onFace(.004) } rotation-x={ -SCREEN_TILT } renderOrder={ 1 } userData={ { screenHole: true } }>
        <planeGeometry args={ [screenWidth, SCREEN_HEIGHT] } />
        <meshBasicMaterial color="#000000" transparent opacity={ 0 } blending={ THREE.NoBlending } toneMapped={ false } fog={ false } />
      </mesh>
      {/* ...and the glass in front of it reflects the room */}
      <mesh position={ onFace(.008) } rotation-x={ -SCREEN_TILT } renderOrder={ 2 } material={ materials.glass } userData={ { screenHole: true } }>
        <planeGeometry args={ [screenWidth, SCREEN_HEIGHT] } />
      </mesh>
      {/* what the room sees of the screen when the reflections are made */}
      <mesh position={ onFace(.004) } rotation-x={ -SCREEN_TILT } visible={ false } userData={ { screenGlow: true } }>
        <planeGeometry args={ [screenWidth, SCREEN_HEIGHT] } />
        <meshBasicMaterial color={ config.glow } toneMapped={ false } />
      </mesh>
      <pointLight
        position={ [0, SCREEN_CENTER.y + SCREEN_NORMAL.y * .45, SCREEN_CENTER.z + SCREEN_NORMAL.z * .45] }
        color={ config.glow }
        intensity={ hovered ? 1.6 : 1.1 }
        distance={ 4 }
        decay={ 2 }
      />

      {/* marquee, lit from behind, in an aluminium frame */}
      <mesh position={ [0, MARQUEE_BOTTOM + marqueeHeight / 2, config.marqueeOut + .004] }>
        <planeGeometry args={ [bodyWidth - .02, marqueeHeight - .03] } />
        <meshBasicMaterial map={ marquee(config) } color={ hovered ? "#ffffff" : "#c4c4c4" } toneMapped={ false } />
      </mesh>
      {[MARQUEE_BOTTOM + .012, config.top - .012].map((y) => (
        <mesh position={ [0, y, config.marqueeOut + .012] } key={ y }>
          <boxGeometry args={ [bodyWidth, .024, .016] } />
          <meshStandardMaterial map={ brushedMetal() } roughness={ .35 } metalness={ .85 } />
        </mesh>
      ))}
      {/* speakers under the marquee */}
      <mesh
        position={ [0, (FACE_TOP.y + MARQUEE_BOTTOM) / 2 - .002, (FACE_TOP.z + config.marqueeOut) / 2] }
        rotation-x={ Math.PI / 2 + Math.atan2(MARQUEE_BOTTOM - FACE_TOP.y, config.marqueeOut - FACE_TOP.z) }
      >
        <planeGeometry args={ [bodyWidth - .04, underside - .02] } />
        <meshLambertMaterial map={ speakerGrille() } />
      </mesh>

      {/* control deck */}
      <group position={ [0, (DECK_FRONT_Y + FACE_BOTTOM.y) / 2, (config.deckOut + FACE_BOTTOM.z) / 2] } rotation-x={ deckSlope }>
        <mesh position-y={ .002 } rotation-x={ -Math.PI / 2 } receiveShadow>
          <planeGeometry args={ [bodyWidth - .01, deckLength - .01] } />
          <meshLambertMaterial map={ controlPanel(config) } />
        </mesh>
        {/* joystick: dust washer, shaft and ball */}
        <mesh position={ [-spread * 2, .004, 0] }>
          <cylinderGeometry args={ [.03, .03, .004, 20] } />
          <meshStandardMaterial color="#111111" roughness={ .5 } />
        </mesh>
        <mesh position={ [-spread * 2, .04, 0] } castShadow>
          <cylinderGeometry args={ [.007, .009, .08, 10] } />
          <meshStandardMaterial color="#d8d8d8" roughness={ .2 } metalness={ .9 } />
        </mesh>
        <mesh position={ [-spread * 2, .092, 0] } castShadow>
          <sphereGeometry args={ [.026, 20, 14] } />
          <meshStandardMaterial color="#c8281e" roughness={ .18 } />
        </mesh>
        {[0, 1, 2, 3].map((button) => {
          const x = spread * (button % 3 + .3) + (button > 2 ? spread * .5 : 0)
          const z = button > 2 ? .035 : (button % 2 ? -.028 : .012)
          return (
            <group position={ [x, 0, z] } key={ button }>
              <mesh position-y={ .004 }>
                <cylinderGeometry args={ [.024, .026, .008, 20] } />
                <meshStandardMaterial color="#1a1a1a" roughness={ .3 } metalness={ .4 } />
              </mesh>
              <mesh position-y={ .012 }>
                <cylinderGeometry args={ [.018, .019, .012, 20] } />
                <meshStandardMaterial
                  color={ button > 2 ? "#ffffff" : config.accent }
                  emissive={ button > 2 ? "#ffffff" : config.accent }
                  emissiveIntensity={ button > 2 ? .6 : .15 }
                  roughness={ .25 }
                />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* coin door, kick plate and the feet */}
      <mesh position={ [0, .44, FRONT + .009] } castShadow>
        <boxGeometry args={ [Math.min(.26, bodyWidth * .6), .32, .018] } />
        <meshStandardMaterial attach="material-0" color="#2a2b2f" metalness={ .7 } roughness={ .4 } />
        <meshStandardMaterial attach="material-1" color="#2a2b2f" metalness={ .7 } roughness={ .4 } />
        <meshStandardMaterial attach="material-2" color="#2a2b2f" metalness={ .7 } roughness={ .4 } />
        <meshStandardMaterial attach="material-3" color="#2a2b2f" metalness={ .7 } roughness={ .4 } />
        <meshStandardMaterial
          attach="material-4"
          map={ coinDoor() }
          emissiveMap={ coinDoorGlow() }
          emissive="#ffffff"
          emissiveIntensity={ 1.4 }
          metalness={ .6 }
          roughness={ .45 }
        />
        <meshStandardMaterial attach="material-5" color="#2a2b2f" metalness={ .7 } roughness={ .4 } />
      </mesh>
      <mesh position={ [0, .05, FRONT + .004] }>
        <boxGeometry args={ [bodyWidth, .1, .008] } />
        <meshStandardMaterial map={ brushedMetal() } roughness={ .4 } metalness={ .85 } />
      </mesh>
      {/* darker floor right under it, where the light of the room never gets */}
      <mesh position={ [0, .003, -.05] } rotation-x={ -Math.PI / 2 }>
        <planeGeometry args={ [width + .5, 1.4] } />
        <meshBasicMaterial map={ contactShadow() } transparent depthWrite={ false } opacity={ .8 } />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z]) => (
        <mesh position={ [x * (width / 2 - .04), .008, z > 0 ? FRONT - .04 : BACK + .04] } key={ `${ x }${ z }` }>
          <cylinderGeometry args={ [.025, .03, .016, 12] } />
          <meshStandardMaterial color="#111111" roughness={ .6 } />
        </mesh>
      ))}
    </group>
  )
}
