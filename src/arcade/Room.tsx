import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { MACHINES, machineWidth, placement } from "./layout"
import FloorSpeaker from "./FloorSpeaker"
import {
  brushedMetal, carpet, carpetBump, ceilingTiles, changeMachine, changeMachineGlow, contactShadow, exitSign, pizzaBox,
  leaderboard, poster, POSTERS, wainscot, wallBump, wallPaint,
} from "./textures"

export const BACKGROUND = "#040308"
const WALL_Z = -.62
const CEILING = 3.3
const WAINSCOT = .95
// half the width of the neon sign's board, nothing else hangs there
const NEON_HALF_WIDTH = 1.15
// floating dust lit by the screens, right in front of the machines
const DUST = 110

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

// added on top of whatever is behind, without touching the alpha of the canvas (so it can go over the screens)
function additive<T extends THREE.Material>(material: T) {
  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.CustomBlending
  material.blendSrc = THREE.SrcAlphaFactor
  material.blendDst = THREE.OneFactor
  material.blendSrcAlpha = THREE.ZeroFactor
  material.blendDstAlpha = THREE.OneFactor
  return material
}

function Dust({ halfRow }: { halfRow: number }) {
  const material = useMemo(() => additive(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uScale;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        // drifts around and slowly falls, starting over at the top
        p.x += sin(uTime * .21 + aSeed * 40.0) * .12;
        p.z += cos(uTime * .17 + aSeed * 23.0) * .12;
        p.y = mod(p.y - uTime * .03 * (.5 + aSeed), 1.3) + .8;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = (.6 + aSeed * 1.2) * uScale / -view.z * .01;
        // twinkles when it turns towards the light
        vAlpha = .08 + .12 * (.5 + .5 * sin(uTime * (1.0 + aSeed) + aSeed * 60.0));
      }
    `,
    fragmentShader: /* glsl */`
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - .5);
        if (d > .5) discard;
        gl_FragColor = vec4(vec3(1.0, .93, .85), (1.0 - d * 2.0) * vAlpha);
      }
    `,
  })), [])

  const geometry = useMemo(() => {
    const positions = new Float32Array(DUST * 3)
    const seeds = new Float32Array(DUST)
    for (let i = 0; i < DUST; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * halfRow
      positions[i * 3 + 1] = .8 + Math.random() * 1.3
      positions[i * 3 + 2] = .3 + Math.random() * 1.4
      seeds[i] = Math.random()
    }
    const result = new THREE.BufferGeometry()
    result.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    result.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1))
    return result
  }, [halfRow])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock, size }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uScale.value = size.height
  })

  return <points geometry={ geometry } material={ material } renderOrder={ 3 } frustumCulled={ false } />
}

// picture in a thin black frame, hung on the back wall
function Framed({ map, width, height, position }: { map: THREE.Texture, width: number, height: number, position: [number, number] }) {
  return (
    <group position={ [position[0], position[1], WALL_Z + .015] }>
      <mesh castShadow>
        <boxGeometry args={ [width + .04, height + .04, .02] } />
        <meshStandardMaterial color="#0c0c0e" roughness={ .4 } metalness={ .3 } />
      </mesh>
      <mesh position-z={ .0105 }>
        <planeGeometry args={ [width, height] } />
        <meshLambertMaterial map={ map } />
      </mesh>
    </group>
  )
}

function Stool({ position }: { position: [number, number, number] }) {
  const chrome = <meshStandardMaterial color="#c9ccd2" roughness={ .25 } metalness={ .95 } />
  return (
    <group position={ position } rotation-y={ .4 }>
      <mesh position-y={ .72 } castShadow>
        <cylinderGeometry args={ [.19, .17, .07, 24] } />
        <meshStandardMaterial color="#8f1d1d" roughness={ .45 } />
      </mesh>
      <mesh position-y={ .36 } castShadow>
        <cylinderGeometry args={ [.022, .022, .7, 10] } />
        { chrome }
      </mesh>
      <mesh position-y={ .3 } rotation-x={ Math.PI / 2 }>
        <torusGeometry args={ [.15, .012, 8, 24] } />
        { chrome }
      </mesh>
      <mesh position-y={ .015 } castShadow>
        <cylinderGeometry args={ [.2, .22, .03, 24] } />
        { chrome }
      </mesh>
      <mesh position-y={ .003 } rotation-x={ -Math.PI / 2 }>
        <planeGeometry args={ [.7, .7] } />
        <meshBasicMaterial map={ contactShadow() } transparent depthWrite={ false } opacity={ .7 } />
      </mesh>
    </group>
  )
}

// a power cable lying on the floor, from the side of a cabinet to the power strip by the wall
function Cable({ from, to }: { from: THREE.Vector3, to: THREE.Vector3 }) {
  const geometry = useMemo(() => {
    const middle = from.clone().lerp(to, .5).add(new THREE.Vector3(.08, 0, .06))
    middle.y = .008
    const curve = new THREE.CatmullRomCurve3([from, from.clone().setY(.008), middle, to])
    return new THREE.TubeGeometry(curve, 24, .007, 6)
  }, [from.x, from.y, from.z, to.x, to.y, to.z])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={ geometry }>
      <meshLambertMaterial color="#0a0a0a" />
    </mesh>
  )
}

export default function Room({ aspect }: { aspect: number }) {
  const neon = useMemo(neonTexture, [])
  const neonLight = useRef<THREE.PointLight>(null)
  const neonSign = useRef<THREE.MeshBasicMaterial>(null)
  const tube = useRef<THREE.MeshStandardMaterial>(null)

  useEffect(() => () => neon.dispose(), [neon])

  // where things go depends on how wide the row of machines is
  const first = placement(0, aspect)
  const last = placement(MACHINES.length - 1, aspect)
  const halfRow = last.x + machineWidth(aspect) / 2
  const gaps = MACHINES.slice(1).map((_, i) => (placement(i, aspect).x + placement(i + 1, aspect).x) / 2)
  // over the first and the last machine, or right next to the neon when the machines are narrow
  const besideNeon = (x: number, width: number) => Math.sign(x) * Math.max(Math.abs(x), NEON_HALF_WIDTH + width / 2 + .12)

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    // the sign buzzes and drops out every now and then
    const dropout = Math.sin(time * 1.7) > .985 || Math.sin(time * 23) * Math.sin(time * .9) > .93
    const level = dropout ? .35 : .92 + Math.sin(time * 60) * .04
    if (neonLight.current) neonLight.current.intensity = 5 * level
    if (neonSign.current) neonSign.current.color.setScalar(level)
    // and the fluorescent tube is about to die
    if (tube.current) tube.current.emissiveIntensity = Math.sin(time * 3.1) * Math.sin(time * 7.3) > .82 ? .2 : 2.2
  })

  return (
    <>
      <color attach="background" args={ [BACKGROUND] } />
      <fogExp2 attach="fog" args={ [BACKGROUND, .04] } />
      <hemisphereLight args={ ["#4a4278", "#120e18", .95] } />
      {/* fluorescent panel over the player, the only light that casts shadows (drawn once, nothing moves) */}
      <spotLight
        position={ [0, CEILING - .1, 3.2] }
        color="#ffe2bd"
        intensity={ 45 }
        distance={ 14 }
        decay={ 2 }
        angle={ .95 }
        penumbra={ .8 }
        castShadow
        shadow-mapSize={ [1024, 1024] }
        shadow-bias={ -.0004 }
        shadow-normalBias={ .02 }
        shadow-camera-near={ .5 }
        shadow-camera-far={ 10 }
      >
        <object3D attach="target" position={ [0, .6, -.4] } />
      </spotLight>
      <mesh position={ [0, CEILING - .03, 3.2] }>
        <boxGeometry args={ [.34, .05, 1.25] } />
        <meshStandardMaterial ref={ tube } color="#ffffff" emissive="#fff1dc" emissiveIntensity={ 2.2 } toneMapped={ false } />
      </mesh>

      {/* floor */}
      <mesh rotation-x={ -Math.PI / 2 } position={ [0, 0, 8] } receiveShadow>
        <planeGeometry args={ [48, 48] } />
        <meshLambertMaterial map={ carpet() } bumpMap={ carpetBump() } bumpScale={ 1.2 } />
      </mesh>

      {/* back wall: painted plaster over wood boards, with a rail in between */}
      <mesh position={ [0, (CEILING + WAINSCOT) / 2, WALL_Z] } receiveShadow>
        <planeGeometry args={ [48, CEILING - WAINSCOT] } />
        <meshLambertMaterial map={ wallPaint() } bumpMap={ wallBump() } bumpScale={ 1.5 } />
      </mesh>
      <mesh position={ [0, WAINSCOT / 2, WALL_Z] } receiveShadow>
        <planeGeometry args={ [48, WAINSCOT] } />
        <meshLambertMaterial map={ wainscot() } />
      </mesh>
      <mesh position={ [0, WAINSCOT, WALL_Z + .02] } receiveShadow>
        <boxGeometry args={ [48, .06, .04] } />
        <meshLambertMaterial color="#2a170c" />
      </mesh>
      <mesh position={ [0, .06, WALL_Z + .012] }>
        <boxGeometry args={ [48, .12, .024] } />
        <meshLambertMaterial color="#08070c" />
      </mesh>

      {/* drop ceiling */}
      <mesh rotation-x={ Math.PI / 2 } position={ [0, CEILING, 8] }>
        <planeGeometry args={ [48, 48] } />
        <meshLambertMaterial map={ ceilingTiles() } />
      </mesh>

      {/* neon sign on its dark acrylic board */}
      <mesh position={ [0, 2.68, WALL_Z + .02] }>
        <boxGeometry args={ [2.3, .62, .02] } />
        <meshStandardMaterial color="#09070c" roughness={ .15 } metalness={ .2 } />
      </mesh>
      <mesh position={ [0, 2.68, WALL_Z + .035] }>
        <planeGeometry args={ [2.2, .55] } />
        <meshBasicMaterial ref={ neonSign } map={ neon } transparent toneMapped={ false } fog={ false } />
      </mesh>
      <pointLight ref={ neonLight } position={ [0, 2.68, WALL_Z + .5] } color="#ff2f8e" intensity={ 5 } distance={ 11 } decay={ 2 } />

      {/* on the wall: the leaderboards over the first (tetris) and the last (pacman) machine, posters at the sides */}
      <Framed map={ leaderboard("tetris") } width={ .7 } height={ .52 } position={ [besideNeon(first.x, .7), 2.42] } />
      <Framed map={ leaderboard("pacman") } width={ .7 } height={ .52 } position={ [besideNeon(last.x, .7), 2.42] } />
      <Framed map={ poster(POSTERS[1]) } width={ .42 } height={ .56 } position={ [-halfRow - .45, 1.75] } />
      <Framed map={ poster(POSTERS[0]) } width={ .42 } height={ .56 } position={ [halfRow + .45, 1.75] } />

      {/* exit, top left */}
      <group position={ [-halfRow - .45, 2.95, WALL_Z + .05] }>
        <mesh>
          <boxGeometry args={ [.4, .16, .08] } />
          <meshStandardMaterial color="#e8e8e8" roughness={ .6 } />
        </mesh>
        <mesh position-z={ .041 }>
          <planeGeometry args={ [.37, .135] } />
          <meshBasicMaterial map={ exitSign() } toneMapped={ false } />
        </mesh>
      </group>

      {/* change machine with a pizza box someone left on it */}
      <group position={ [-halfRow - .45, 0, WALL_Z + .24] }>
        <mesh position-y={ .75 } castShadow receiveShadow>
          <boxGeometry args={ [.5, 1.5, .44] } />
          <meshStandardMaterial attach="material-0" color="#5d6168" metalness={ .6 } roughness={ .45 } />
          <meshStandardMaterial attach="material-1" color="#5d6168" metalness={ .6 } roughness={ .45 } />
          <meshStandardMaterial attach="material-2" color="#5d6168" metalness={ .6 } roughness={ .45 } />
          <meshStandardMaterial attach="material-3" color="#5d6168" metalness={ .6 } roughness={ .45 } />
          <meshStandardMaterial
            attach="material-4"
            map={ changeMachine() }
            emissiveMap={ changeMachineGlow() }
            emissive="#ffffff"
            emissiveIntensity={ 1.2 }
            metalness={ .5 }
            roughness={ .45 }
          />
          <meshStandardMaterial attach="material-5" color="#5d6168" metalness={ .6 } roughness={ .45 } />
        </mesh>
        <mesh position={ [.02, 1.525, .02] } rotation-y={ .25 } castShadow>
          <boxGeometry args={ [.36, .05, .36] } />
          <meshLambertMaterial attach="material-0" color="#b88a54" />
          <meshLambertMaterial attach="material-1" color="#b88a54" />
          <meshLambertMaterial attach="material-2" map={ pizzaBox() } />
          <meshLambertMaterial attach="material-3" color="#b88a54" />
          <meshLambertMaterial attach="material-4" color="#b88a54" />
          <meshLambertMaterial attach="material-5" color="#b88a54" />
        </mesh>
        <mesh position-y={ .003 } rotation-x={ -Math.PI / 2 }>
          <planeGeometry args={ [1, .9] } />
          <meshBasicMaterial map={ contactShadow() } transparent depthWrite={ false } opacity={ .8 } />
        </mesh>
      </group>

      {/* trash can on the right */}
      <group position={ [halfRow + .4, 0, WALL_Z + .3] }>
        <mesh position-y={ .29 } castShadow receiveShadow>
          <cylinderGeometry args={ [.19, .16, .58, 24, 1, true] } />
          <meshStandardMaterial map={ brushedMetal() } color="#4a4d52" metalness={ .7 } roughness={ .5 } side={ THREE.DoubleSide } />
        </mesh>
        <mesh position-y={ .575 } rotation-x={ Math.PI / 2 }>
          <torusGeometry args={ [.19, .01, 8, 24] } />
          <meshStandardMaterial color="#2a2b2e" metalness={ .7 } roughness={ .4 } />
        </mesh>
        {/* crumpled paper inside */}
        <mesh position={ [.04, .5, -.03] }>
          <icosahedronGeometry args={ [.07, 0] } />
          <meshStandardMaterial color="#d8d2c4" roughness={ .95 } flatShading />
        </mesh>
        <mesh position-y={ .003 } rotation-x={ -Math.PI / 2 }>
          <planeGeometry args={ [.7, .7] } />
          <meshBasicMaterial map={ contactShadow() } transparent depthWrite={ false } opacity={ .8 } />
        </mesh>
      </group>

      {/* dim cold light coming in from the right side, where the speaker is (a corridor, out of sight) */}
      <pointLight position={ [halfRow + 1.1, 1.6, 1.2] } color="#7f8cff" intensity={ 22 } distance={ 7 } decay={ 2 } />

      {/* a speaker on the floor at the right, turned towards the room: it thumps while the sound is on */}
      <FloorSpeaker position={ [halfRow + .05, 0, 1.05] } rotation={ -.6 } />

      {/* a stool somebody pulled away from the last machine */}
      <Stool position={ [(gaps[gaps.length - 1] + last.x) / 2 + .1, 0, .95] } />

      {/* power strips by the wall, and the cables going to them */}
      {gaps.map((x, i) => {
        const strip = new THREE.Vector3(x, .02, WALL_Z + .06)
        return (
          <group key={ x }>
            <mesh position={ [x, .02, WALL_Z + .06] }>
              <boxGeometry args={ [.3, .04, .06] } />
              <meshLambertMaterial color="#d6d2c8" />
            </mesh>
            <mesh position={ [x + .1, .041, WALL_Z + .06] }>
              <boxGeometry args={ [.025, .004, .012] } />
              <meshBasicMaterial color="#ff3b1f" toneMapped={ false } />
            </mesh>
            {[i, i + 1].map((machine) => {
              const { x: machineX, z: machineZ } = placement(machine, aspect)
              const side = machine === i ? 1 : -1
              const from = new THREE.Vector3(machineX + side * (machineWidth(aspect) / 2 - .02), .12, machineZ - .35)
              return <Cable from={ from } to={ strip.clone().setX(x + side * .1) } key={ machine } />
            })}
          </group>
        )
      })}

      <Dust halfRow={ halfRow + .5 } />
    </>
  )
}
