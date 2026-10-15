import { useRef } from "react"
import * as THREE from "three"
import { ThreeEvent, useFrame } from "@react-three/fiber"
import { useBitcenteStore } from "../store"
import { contactShadow, laminate } from "./textures"

const WIDTH = .44
const HEIGHT = .64
const DEPTH = .34
// the cone moves to the beat while the sound is on
const BEAT = 2.1
const THROW = .007

// A speaker standing on the floor of the room: it thumps while the sound is on and clicking it mutes the web
export default function FloorSpeaker({ position, rotation }: { position: [number, number, number], rotation: number }) {
  const muted = useBitcenteStore((state) => state.muted)
  const toggleMuted = useBitcenteStore((state) => state.toggleMuted)
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)

  const body = useRef<THREE.Group>(null)
  const woofer = useRef<THREE.Group>(null)
  const tweeter = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!body.current || !woofer.current || !tweeter.current) return
    if (useBitcenteStore.getState().muted) {
      woofer.current.position.z = 0
      tweeter.current.position.z = 0
      body.current.position.set(0, 0, 0)
      return
    }
    const time = clock.elapsedTime
    // a kick on every beat that dies out, and the buzz of everything else on top
    const kick = Math.pow(1 - (time * BEAT % 1), 6)
    const buzz = Math.sin(time * 70) * .25 + Math.sin(time * 113) * .15
    woofer.current.position.z = (kick + buzz * .4) * THROW
    tweeter.current.position.z = Math.sin(time * 140) * THROW * .2
    // the whole box shakes a little on the carpet
    body.current.position.set(Math.sin(time * 90) * kick * .0015, kick * .0012, 0)
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setCursorPointer(true)
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    toggleMuted()
  }

  const front = DEPTH / 2 + .001
  return (
    <group position={ position } rotation-y={ rotation } onPointerOver={ over } onPointerOut={ () => setCursorPointer(false) } onClick={ click }>
      <group ref={ body }>
        <mesh position-y={ HEIGHT / 2 + .03 } castShadow receiveShadow>
          <boxGeometry args={ [WIDTH, HEIGHT, DEPTH] } />
          <meshLambertMaterial color="#1b1916" map={ laminate() } />
        </mesh>
        {/* black front with the cones */}
        <mesh position={ [0, HEIGHT / 2 + .03, front] }>
          <planeGeometry args={ [WIDTH - .03, HEIGHT - .03] } />
          <meshLambertMaterial color="#0b0b0b" />
        </mesh>

        <group position={ [0, .27, front] }>
          {/* <mesh rotation-x={ Math.PI / 2 }>
            <torusGeometry args={ [.15, .014, 8, 32] } />
            <meshStandardMaterial color="#1e1e1e" roughness={ .5 } />
          </mesh> */}
          {/* lit ring around the cone, so it can be found in the dark: green with sound, dim red muted */}
          {/* <mesh rotation-x={ Math.PI / 2 } position-z={ .004 }>
            <torusGeometry args={ [.168, .005, 6, 40] } />
            <meshBasicMaterial color={ muted ? "#5a120c" : "#3dff6a" } toneMapped={ false } />
          </mesh> */}
          <group ref={ woofer }>
            <mesh rotation-x={ Math.PI / 2 } position-z={ .006 }>
              <cylinderGeometry args={ [.14, .05, .03, 32, 1, true] } />
              <meshStandardMaterial color="#161616" roughness={ .9 } side={ THREE.DoubleSide } />
            </mesh>
            <mesh position-z={ -.004 } scale-z={ .5 }>
              <sphereGeometry args={ [.045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2] } />
              <meshStandardMaterial color="#2a2a2a" roughness={ .35 } metalness={ .3 } />
            </mesh>
          </group>
        </group>

        <group position={ [0, .52, front] }>
          {/* <mesh rotation-x={ Math.PI / 2 }>
            <torusGeometry args={ [.05, .008, 6, 24] } />
            <meshStandardMaterial color="#8d9096" roughness={ .3 } metalness={ .9 } />
          </mesh> */}
          <mesh ref={ tweeter } scale-z={ .2 }>
            <sphereGeometry args={ [.035, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2] } />
            <meshStandardMaterial color="#1f1f1f" roughness={ .3 } metalness={ .4 } />
          </mesh>
        </group>

        {/* power light: green with sound, red muted */}
        <mesh position={ [WIDTH / 2 - .045, .07, front + .002] }>
          <circleGeometry args={ [.008, 12] } />
          <meshBasicMaterial color={ muted ? "#ff2a1a" : "#3dff6a" } toneMapped={ false } />
        </mesh>

        {[-1, 1].map((x) => [-1, 1].map((z) => (
          <mesh position={ [x * (WIDTH / 2 - .04), .015, z * (DEPTH / 2 - .04)] } key={ `${ x }${ z }` }>
            <cylinderGeometry args={ [.02, .024, .03, 10] } />
            <meshLambertMaterial color="#0a0a0a" />
          </mesh>
        )))}
      </group>

      {/* the ring lights up the floor in front of it a little */}
      <pointLight position={ [0, .3, .35] } color={ muted ? "#ff2a1a" : "#3dff6a" } intensity={ muted ? .08 : .35 } distance={ 1.2 } decay={ 2 } />

      <mesh position-y={ .003 } rotation-x={ -Math.PI / 2 }>
        <planeGeometry args={ [WIDTH + .4, DEPTH + .4] } />
        <meshBasicMaterial map={ contactShadow() } transparent depthWrite={ false } opacity={ .8 } />
      </mesh>
    </group>
  )
}
