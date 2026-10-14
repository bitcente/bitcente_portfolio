import * as THREE from "three"
import { gsap } from "gsap"
import { isMobile, isTouchDevice } from "../../utils/Screen"
import { getPalette, hexToRgb } from "./palette"
import { fragmentShader, labelFragmentShader, vertexShader } from "./shaders"

export interface CarouselItem {
  name: string
  video?: string
  image?: string
}

interface CarouselOptions {
  container: HTMLElement
  items: CarouselItem[]
  // item centred in the screen
  onActiveChange: (index: number) => void
  onHoverChange: (index: number | null) => void
  onSelect: (index: number) => void
}

// at this distance one world unit is one css pixel for anything placed at z = 0
const CAMERA_DISTANCE = 1000
const PLANE_RATIO = 16 / 9
// plane height relative to the screen height
const PLANE_HEIGHT = .7
// plane width can't go over this part of the screen width
const PLANE_MAX_WIDTH = .8
// gap relative to the plane width
const PLANE_GAP = .12
// on mobile the planes are narrower and closer together, so the previous and next ones peek in at the sides
const MOBILE_PLANE_MAX_WIDTH = .7
const MOBILE_PLANE_GAP = .06
// rows of lcd pixels in a plane
const LCD_ROWS = 170
// 0 is a smooth green tint, 1 a hard 4 tone dither
const LCD_DITHER = .45
// how much of the real colours show in the items that are not hovered
const COLOR_LEAK = 1
// green pixelated lcd look of the items that goes away on hover. false shows them in real colour all the time
const LCD_EFFECT = true
// how fast an item goes in and out of full colour
const REVEAL_EASE = 4
const SCROLL_EASE = 6
const WHEEL_SPEED = 1.2
const DRAG_SPEED = 1.5
// px per second at which planes are fully bent and pixelated
const MAX_SPEED = 2600
// px between a plane and the title below it
const LABEL_GAP = 14
// font size in px of the title
const LABEL_SIZE = 16
// ms without input before the closest item gets centred
const SNAP_DELAY = 180
// px the pointer can travel and still count as a click
const CLICK_TOLERANCE = 6

// 3d effects, set to false to turn them off:
// the row of planes curves away at the sides, like the glass of an old CRT
const CURVED_SCREEN = true
// planes bend sideways like a staircase while the carousel moves (dragged or scrolled), the faster the more
const BEND_ON_SCROLL = true
// how much they bend at the same speed: 1 is subtle, 2 twice as much...
const BEND_MULTIPLIER = .8
// px the sides of the screen go back with CURVED_SCREEN
const SCREEN_CURVE = -600
// extra curve while the carousel moves (dragged or scrolled), on top of CURVED_SCREEN or on its own.
// At full speed the sides go back SCREEN_CURVE times this: 0 turns it off, 1 doubles the curve...
const CURVE_ON_SCROLL_MULTIPLIER = 1.2
// curve on mobile relative to the one on desktop (moving or not): 0 is flat, 2 twice as curved...
const MOBILE_CURVE_MULTIPLIER = .2

// horizontal strips each plane is cut into, every strip bends as a rigid block
const BEND_STRIPS = 14
// columns of vertices, needed to follow the curve of the screen
const PLANE_COLUMNS = 24

// A 1x1 plane made of separate horizontal strips. Strips don't share vertices, so the
// shader can slide each one sideways on its own (aStrip is the centre of the strip, 0..1)
function stripedPlane() {
  const positions: number[] = []
  const uvs: number[] = []
  const strips: number[] = []
  const indices: number[] = []

  for (let strip = 0; strip < BEND_STRIPS; strip++) {
    const bottom = strip / BEND_STRIPS
    const top = (strip + 1) / BEND_STRIPS
    const first = positions.length / 3
    for (let column = 0; column <= PLANE_COLUMNS; column++) {
      const u = column / PLANE_COLUMNS
      positions.push(u - .5, bottom - .5, 0, u - .5, top - .5, 0)
      uvs.push(u, bottom, u, top)
      strips.push((strip + .5) / BEND_STRIPS, (strip + .5) / BEND_STRIPS)
    }
    for (let column = 0; column < PLANE_COLUMNS; column++) {
      const a = first + column * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute("aStrip", new THREE.Float32BufferAttribute(strips, 1))
  geometry.setIndex(indices)
  return geometry
}

interface Media {
  map: { value: THREE.Texture }
  size: { value: THREE.Vector2 }
  video?: HTMLVideoElement
}

// title of an item drawn into a texture, shared by every copy of the item
interface Label {
  material: THREE.ShaderMaterial
  // px
  size: THREE.Vector2
}

// flat plane for the titles: it follows the curve of the screen but never bends (aStrip is 0)
function labelPlane() {
  const geometry = new THREE.PlaneGeometry(1, 1, PLANE_COLUMNS, 1)
  geometry.setAttribute("aStrip", new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count), 1))
  return geometry
}

interface Plane {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  item: number
  // project title shown below the plane
  label: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  x: number
  reveal: number
  // animated when a project opens
  fx: { z: number, rotation: number, spread: number, opacity: number, iris: number, wipe: number, wipeDir: number }
}

// Infinite carousel of videos rendered as a 4 tone lcd
export default class Carousel {
  private options: CarouselOptions
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 10, 8000)
  private geometry = stripedPlane()
  private palette = getPalette()
  private media: Media[]
  private labelGeometry = labelPlane()
  private labels: Label[]
  private planes: Plane[] = []
  private uniforms = {
    uViewport: { value: new THREE.Vector2(1, 1) },
    uPlaneSize: { value: new THREE.Vector2(1, 1) },
    uPixel: { value: 4 },
    uDither: { value: LCD_DITHER },
    // with all the real colour leaking through, the lcd look is gone
    uColorLeak: { value: LCD_EFFECT ? COLOR_LEAK : 1 },
    uVelocity: { value: 0 },
    uBend: { value: 0 },
    uCurve: { value: CURVED_SCREEN ? SCREEN_CURVE : 0 },
  }

  private scroll = { current: 0, target: 0 }
  private intro = { offset: 0 }
  private width = 0
  private height = 0
  private planeWidth = 1
  private planeHeight = 1
  private spacing = 1
  // SCREEN_CURVE for the current device
  private screenCurve = SCREEN_CURVE

  private touch = isTouchDevice()
  private pointer = { x: 0, y: 0, inside: false, mouse: false }
  private drag: { x: number, moved: number } | null = null
  private hovered: Plane | null = null
  private selected: Plane | null = null
  private active = 0
  // true while a project is open (or opening / closing)
  private locked = false
  private visible = false
  private transition?: gsap.core.Timeline

  private frame = 0
  private lastTime = 0
  private snapTimer = 0
  private stopTimer = 0
  private resizeObserver: ResizeObserver

  constructor(options: CarouselOptions) {
    this.options = options
    this.container = options.container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.container.appendChild(this.renderer.domElement)

    this.camera.position.z = CAMERA_DISTANCE
    this.media = options.items.map((item) => this.loadMedia(item))
    this.labels = options.items.map((item) => this.createLabel(item.name))

    this.resize()
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(this.container)

    this.container.addEventListener("pointerdown", this.onPointerDown)
    // also on enter: the detail page covers the carousel and nothing says the cursor is back until it moves
    this.container.addEventListener("pointerenter", this.onPointerMove)
    this.container.addEventListener("pointermove", this.onPointerMove)
    this.container.addEventListener("pointerup", this.onPointerUp)
    this.container.addEventListener("pointercancel", this.onPointerCancel)
    this.container.addEventListener("pointerleave", this.onPointerLeave)
  }

  /* MEDIA */

  private loadMedia({ name, video: videoSrc, image }: CarouselItem): Media {
    const media: Media = {
      map: { value: this.titleCard(name) },
      size: { value: new THREE.Vector2(640, 360) },
    }
    const replace = (texture: THREE.Texture, width: number, height: number) => {
      media.map.value.dispose()
      media.map.value = texture
      media.size.value.set(width, height)
    }

    if (videoSrc) {
      // never added to the DOM, so no controls
      const video = document.createElement("video")
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = "auto"
      video.src = videoSrc
      video.addEventListener("loadeddata", () => {
        replace(new THREE.VideoTexture(video), video.videoWidth, video.videoHeight)
        if (this.visible && !this.locked) video.play().catch(() => {})
      }, { once: true })
      media.video = video
    } else if (image) {
      new THREE.TextureLoader().load(image, (texture) => {
        replace(texture, texture.image.width, texture.image.height)
      })
    }

    return media
  }

  // shown while the media loads or when a project has none
  private titleCard(name: string) {
    const canvas = document.createElement("canvas")
    canvas.width = 640
    canvas.height = 360
    const ctx = canvas.getContext("2d")!
    const texture = new THREE.CanvasTexture(canvas)

    const draw = () => {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, this.palette[3])
      gradient.addColorStop(1, this.palette[1])
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = this.palette[0]
      ctx.font = "72px Tickerbit"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(name.toUpperCase(), canvas.width / 2, canvas.height / 2, canvas.width - 80)
      texture.needsUpdate = true
    }
    draw()
    // draw again once the font is ready
    document.fonts.load(ctx.font).then(draw)

    return texture
  }

  // the title is rendered in WebGL (not the DOM) so it curves with the carousel like the planes do
  private createLabel(name: string): Label {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    const texture = new THREE.CanvasTexture(canvas)
    // mipmaps make the thin strokes vanish on the titles pushed back by the curve
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    const size = new THREE.Vector2(1, 1)
    // drawn bigger than shown to stay sharp
    const resolution = 3
    const font = LABEL_SIZE + "px Tickerbit"
    const text = name.toUpperCase()

    const draw = () => {
      ctx.font = font
      size.set(Math.ceil(ctx.measureText(text).width) + 4, Math.ceil(LABEL_SIZE * 1.5))
      canvas.width = size.x * resolution
      canvas.height = size.y * resolution
      // resizing the canvas resets its state
      ctx.scale(resolution, resolution)
      ctx.font = font
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(text, size.x / 2, size.y / 2)
      // the texture has to be created again when its size changes
      texture.dispose()
      texture.needsUpdate = true
    }
    draw()
    // draw again once the font is ready
    document.fonts.load(font).then(draw)

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: labelFragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...this.uniforms,
        uMap: { value: texture },
        uColor: { value: new THREE.Vector3(...hexToRgb(this.palette[0])) },
      },
    })
    return { material, size }
  }

  private playVideos(play: boolean) {
    this.media.forEach(({ video }) => {
      if (!video) return
      if (play) video.play().catch(() => {})
      else video.pause()
    })
  }

  /* LAYOUT */

  private resize = () => {
    const { clientWidth: width, clientHeight: height } = this.container
    if (!width || !height) return

    // keeps the same item centred after the resize
    const current = this.scroll.current / this.spacing
    const target = this.scroll.target / this.spacing

    this.width = width
    this.height = height
    const mobile = isMobile()
    const maxWidth = mobile ? MOBILE_PLANE_MAX_WIDTH : PLANE_MAX_WIDTH
    const gap = mobile ? MOBILE_PLANE_GAP : PLANE_GAP
    this.screenCurve = SCREEN_CURVE * (mobile ? MOBILE_CURVE_MULTIPLIER : 1)
    this.planeWidth = Math.round(Math.min(height * PLANE_HEIGHT * PLANE_RATIO, width * maxWidth))
    this.planeHeight = Math.round(this.planeWidth / PLANE_RATIO)
    this.spacing = Math.round(this.planeWidth * (1 + gap))
    this.scroll.current = current * this.spacing
    this.scroll.target = target * this.spacing

    // the items are repeated until they overflow the screen, so there's always something to wrap around
    const count = this.options.items.length
    const copies = Math.max(1, Math.ceil((width + this.spacing * 2) / (count * this.spacing)))
    if (count * copies !== this.planes.length) this.buildPlanes(copies)
    this.planes.forEach(({ mesh }) => mesh.scale.set(this.planeWidth, this.planeHeight, 1))

    this.uniforms.uViewport.value.set(width, height)
    this.uniforms.uPlaneSize.value.set(this.planeWidth, this.planeHeight)
    this.uniforms.uPixel.value = Math.max(2, Math.round(this.planeHeight / LCD_ROWS))
    this.uniforms.uBend.value = BEND_ON_SCROLL ? this.planeWidth * .07 * BEND_MULTIPLIER : 0

    // the canvas covers the whole window so an opened plane can grow past the container,
    // the camera is shifted to keep the carousel centred in the container
    // (offsets instead of getBoundingClientRect, which is off while the page is shown in the arcade room)
    let top = 0
    for (let element: Element | null = this.container; element instanceof HTMLElement; element = element.offsetParent) {
      top += element.offsetTop
    }
    const viewHeight = window.innerHeight
    this.camera.aspect = width / viewHeight
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(viewHeight / 2 / CAMERA_DISTANCE))
    this.camera.position.y = top + height / 2 - viewHeight / 2
    this.camera.updateProjectionMatrix()

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, viewHeight)
    this.renderer.domElement.style.top = `${-top}px`
  }

  private buildPlanes(copies: number) {
    this.planes.forEach(({ mesh, label, fx }) => {
      gsap.killTweensOf(fx)
      this.scene.remove(mesh)
      mesh.material.dispose()
      this.scene.remove(label)
    })
    this.transition?.kill()
    this.transition = undefined
    this.hovered = null
    this.selected = null

    const [uColor0, uColor1, uColor2, uColor3] = this.palette.map((hex) => (
      { value: new THREE.Vector3(...hexToRgb(hex)) }
    ))

    this.planes = []
    for (let copy = 0; copy < copies; copy++) {
      this.media.forEach((media, item) => {
        const material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            ...this.uniforms,
            uColor0, uColor1, uColor2, uColor3,
            uMap: media.map,
            uMediaSize: media.size,
            uReveal: { value: 0 },
            uOpacity: { value: 0 },
            uIris: { value: 0 },
            uWipe: { value: 1 },
            uWipeDir: { value: 1 },
          },
        })
        const mesh = new THREE.Mesh(this.geometry, material)
        // a project can be open while the planes are rebuilt (resize)
        const fx = { z: 0, rotation: 0, spread: 0, opacity: this.visible && !this.locked ? 1 : 0, iris: 0, wipe: 1, wipeDir: 1 }
        this.scene.add(mesh)

        const label = new THREE.Mesh(this.labelGeometry, this.labels[item].material)
        label.visible = false
        this.scene.add(label)

        this.planes.push({ mesh, item, label, x: 0, reveal: 0, fx })
      })
    }
  }

  /* LOOP */

  private start() {
    clearTimeout(this.stopTimer)
    if (this.frame) return
    this.lastTime = performance.now()
    this.frame = requestAnimationFrame(this.tick)
  }

  private stop() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  private tick = (time: number) => {
    this.frame = requestAnimationFrame(this.tick)
    const delta = Math.min((time - this.lastTime) / 1000, .05)
    this.lastTime = time
    if (delta <= 0) return

    this.update(delta)
    this.renderer.render(this.scene, this.camera)
  }

  // x of a plane, wrapped around the centre of the screen
  private restX(i: number) {
    const total = this.planes.length * this.spacing
    return ((i * this.spacing - this.scroll.current + total / 2) % total + total) % total - total / 2
  }

  private update(delta: number) {
    const { scroll, spacing } = this
    const count = this.options.items.length

    const previous = scroll.current
    scroll.current += (scroll.target - scroll.current) * (1 - Math.exp(-delta * SCROLL_EASE))
    const velocity = THREE.MathUtils.clamp((scroll.current - previous) / delta / MAX_SPEED, -1.5, 1.5)
    this.uniforms.uVelocity.value += (velocity - this.uniforms.uVelocity.value) * (1 - Math.exp(-delta * 10))
    const speed = Math.min(Math.abs(this.uniforms.uVelocity.value), 1)
    this.uniforms.uCurve.value = (CURVED_SCREEN ? this.screenCurve : 0) + this.screenCurve * CURVE_ON_SCROLL_MULTIPLIER * speed

    let closest = this.planes[0]
    this.planes.forEach((plane, i) => {
      plane.x = this.restX(i) + this.intro.offset
      if (Math.abs(plane.x) < Math.abs(closest.x)) closest = plane
    })

    const active = ((Math.round(scroll.current / spacing) % count) + count) % count
    if (active !== this.active) {
      this.active = active
      if (!this.locked) this.options.onActiveChange(active)
    }

    this.setHovered(this.pointer.mouse && this.pointer.inside && !this.locked
      ? this.planeAt(this.pointer.x, this.pointer.y)
      : null)

    this.planes.forEach((plane) => {
      const { mesh, fx } = plane
      // without a cursor the centred item is the one in full colour
      const revealed = plane === this.hovered || plane === this.selected || (this.touch && !this.locked && plane === closest)
      plane.reveal += ((revealed ? 1 : 0) - plane.reveal) * (1 - Math.exp(-delta * REVEAL_EASE))

      mesh.position.set(plane.x * (1 + fx.spread), 0, fx.z)
      mesh.rotation.y = fx.rotation
      mesh.material.uniforms.uReveal.value = plane.reveal
      mesh.material.uniforms.uOpacity.value = fx.opacity
      mesh.material.uniforms.uIris.value = fx.iris
      mesh.material.uniforms.uWipe.value = fx.wipe
      mesh.material.uniforms.uWipeDir.value = fx.wipeDir

      // the title sits right below its plane
      const { size } = this.labels[plane.item]
      plane.label.scale.set(size.x, size.y, 1)
      plane.label.position.set(mesh.position.x, -(this.planeHeight / 2 + LABEL_GAP + size.y / 2), fx.z)
      // gone as soon as its plane starts dissolving
      plane.label.visible = fx.opacity > .9 && fx.iris < .1 && fx.wipe > .9
    })
  }

  /* INPUT */

  // x and y in px from the top left corner of the container
  private planeAt(x: number, y: number) {
    if (Math.abs(y - this.height / 2) > this.planeHeight / 2) return null
    return this.planes.find((plane) => Math.abs(x - this.width / 2 - plane.x) <= this.planeWidth / 2) ?? null
  }

  private setHovered(plane: Plane | null) {
    if (plane === this.hovered) return
    const changed = plane?.item !== this.hovered?.item
    this.hovered = plane
    if (changed) this.options.onHoverChange(plane ? plane.item : null)
  }

  private snap = () => {
    this.scroll.target = Math.round(this.scroll.target / this.spacing) * this.spacing
  }

  private snapLater() {
    clearTimeout(this.snapTimer)
    this.snapTimer = window.setTimeout(this.snap, SNAP_DELAY)
  }

  private localPoint(e: PointerEvent) {
    const rect = this.container.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.locked || !this.visible || e.button !== 0) return
    clearTimeout(this.snapTimer)
    this.drag = { x: e.clientX, moved: 0 }
    this.container.setPointerCapture(e.pointerId)
  }

  private onPointerMove = (e: PointerEvent) => {
    const { x, y } = this.localPoint(e)
    const mouse = e.pointerType === "mouse"

    if (this.drag) {
      const delta = e.clientX - this.drag.x
      this.drag.x = e.clientX
      this.drag.moved += Math.abs(delta)
      this.scroll.target -= delta * DRAG_SPEED
    }

    this.pointer = { x, y, inside: true, mouse }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag) return
    const { moved } = this.drag
    this.drag = null

    if (moved < CLICK_TOLERANCE) {
      const { x, y } = this.localPoint(e)
      const plane = this.planeAt(x, y)
      if (plane) return this.open(plane)
    }
    this.snap()
  }

  private onPointerCancel = () => {
    this.drag = null
    this.snap()
  }

  private onPointerLeave = () => {
    this.pointer.inside = false
  }

  wheel(delta: number) {
    if (this.locked || !this.visible) return
    this.scroll.target += delta * WHEEL_SPEED
    this.snapLater()
  }

  // moves to the next (1) or previous (-1) item
  step(direction: number) {
    if (this.locked || !this.visible) return
    clearTimeout(this.snapTimer)
    this.scroll.target = (Math.round(this.scroll.target / this.spacing) + direction) * this.spacing
  }

  openActive() {
    if (this.locked || !this.visible) return
    const closest = this.planes.reduce((a, b) => Math.abs(b.x) < Math.abs(a.x) ? b : a)
    this.open(closest)
  }

  /* TRANSITIONS */

  // planes slide in from the side while their covers dissolve in
  enter() {
    this.visible = true
    this.start()
    this.playVideos(true)

    gsap.fromTo(this.intro, { offset: this.spacing * 1.5 }, { offset: 0, duration: 1.1, ease: "power3.out", overwrite: true })
    // each cover is wiped in from its right side, starting with the rightmost one
    this.planes.forEach(({ fx }, i) => {
      const delay = THREE.MathUtils.clamp(.5 - this.restX(i) / this.width, 0, 1) * .4
      gsap.fromTo(fx, { opacity: 1, wipe: 0, wipeDir: 1 }, { wipe: 1, duration: .6, ease: "none", delay, overwrite: true })
    })
  }

  leave() {
    this.visible = false
    this.drag = null
    this.playVideos(false)
    this.planes.forEach(({ fx }) => {
      gsap.to(fx, { opacity: 0, duration: .3, ease: "none", overwrite: true })
    })
    // keeps rendering while the covers dissolve out
    this.stopTimer = window.setTimeout(() => this.stop(), 500)
  }

  // the selected plane flies through the camera while the rest get lost in the distance
  private open(plane: Plane) {
    this.locked = true
    this.selected = plane
    clearTimeout(this.snapTimer)
    // slides the selected plane to the centre
    this.scroll.target = this.scroll.current + plane.x

    this.transition = gsap.timeline({
      onComplete: () => {
        // nothing left to see behind the detail page
        this.stop()
        this.playVideos(false)
      },
      onReverseComplete: () => {
        this.locked = false
        this.selected = null
        this.snap()
      },
    })
    this.planes.forEach((other) => {
      gsap.killTweensOf(other.fx)
      other.fx.wipe = 1
      if (other === plane) {
        this.transition!.to(other.fx, { z: CAMERA_DISTANCE * .82, iris: 1, duration: .8, ease: "power2.in" }, 0)
        return
      }
      const side = other.x < plane.x ? -1 : 1
      // wiped out away from the selected plane
      other.fx.wipeDir = side
      this.transition!.to(other.fx, {
        z: -2600,
        rotation: side * -1,
        spread: .8,
        wipe: 0,
        duration: .7,
        ease: "power2.in",
      }, Math.random() * .12)
    })

    this.options.onSelect(plane.item)
  }

  // brings the carousel back after a project is closed
  close() {
    if (!this.locked) return
    this.start()
    this.playVideos(true)

    if (this.transition) {
      this.transition.reverse()
      return
    }
    // the planes were rebuilt while the project was open
    this.planes.forEach(({ fx }) => gsap.to(fx, { opacity: 1, duration: .5, ease: "none" }))
    this.locked = false
  }

  destroy() {
    this.stop()
    clearTimeout(this.snapTimer)
    clearTimeout(this.stopTimer)
    this.resizeObserver.disconnect()
    this.container.removeEventListener("pointerdown", this.onPointerDown)
    this.container.removeEventListener("pointerenter", this.onPointerMove)
    this.container.removeEventListener("pointermove", this.onPointerMove)
    this.container.removeEventListener("pointerup", this.onPointerUp)
    this.container.removeEventListener("pointercancel", this.onPointerCancel)
    this.container.removeEventListener("pointerleave", this.onPointerLeave)

    this.transition?.kill()
    gsap.killTweensOf(this.intro)
    this.planes.forEach(({ mesh, label, fx }) => {
      gsap.killTweensOf(fx)
      mesh.material.dispose()
      this.scene.remove(label)
    })
    this.labels.forEach(({ material }) => {
      material.uniforms.uMap.value.dispose()
      material.dispose()
    })
    this.labelGeometry.dispose()
    this.media.forEach(({ map, video }) => {
      map.value.dispose()
      if (!video) return
      video.pause()
      video.removeAttribute("src")
      video.load()
    })
    this.geometry.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
