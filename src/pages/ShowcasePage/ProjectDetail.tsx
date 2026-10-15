import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { useBitcenteStore } from "../../store"
import { Sound } from "../../classes/SoundBoard"
import { JobMap, ProjectType } from "../../settings"
import { formatText } from "../../utils/Text"
import { isMobile } from "../../utils/Screen"
import Tag from "../../components/Tag"
import Award from "../../components/Award"
import LinkArrow from "../../components/LinkArrow"
import { useCrtExclusion } from "../../components/CrtOverlay"
import MediaZoom, { ZoomedMedia } from "./MediaZoom"

gsap.registerPlugin(SplitText)

// waits for the carousel to fly away
const OPEN_DELAY = .55
// seconds per letter, and the longest a single text can take to be typed
const TYPE_SPEED = .018
const TYPE_MAX = 1.6
// size in px of the pixels an image goes through until it's sharp
const PIXEL_STEPS = [48, 32, 20, 12, 6, 3]
const PIXEL_DURATION = 1.1
// size in px of the blocks an image dissolves in with, and the part of the reveal that takes
const BLOCK_SIZE = 48
const BLOCK_END = .6

// same pseudo random value per block every frame
const blockNoise = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}

// rows of the pixel art cross of the close button, # is a pixel
const CROSS = [
  "##....##",
  "###..###",
  ".######.",
  "..####..",
  "..####..",
  ".######.",
  "###..###",
  "##....##",
]

function PixelX() {
  const path = CROSS.flatMap((row, y) => [...row].map((pixel, x) => pixel === "#" ? `M${x} ${y}h1v1h-1z` : "")).join("")
  return (
    <svg className="sc-detail__cross" viewBox={ `0 0 ${CROSS[0].length} ${CROSS.length}` } shapeRendering="crispEdges" aria-hidden="true">
      <path d={ path } fill="currentColor" />
    </svg>
  )
}

interface ProjectDetailProps {
  project?: ProjectType
  onClose: () => void
}

// muted loop without controls
function Video({ src }: { src: string }) {
  return <video src={ src } muted loop autoPlay playsInline disablePictureInPicture />
}

interface MediaProps {
  video?: string
  image?: string
  alt?: string
  onZoom: (media: ZoomedMedia) => void
}

// image or video with the canvas used to pixelate it over, seen clean without the CRT effect. Clicking it shows it in big
function Media({ video, image, alt, onZoom }: MediaProps) {
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)
  const ref = useRef<HTMLDivElement>(null)
  useCrtExclusion(ref)
  return (
    <div
      className="sc-detail__media sc-detail__reveal"
      ref={ ref }
      onClick={ (e) => {
        setCursorPointer(false)
        onZoom({ video, image, alt, from: e.currentTarget })
      } }
      onPointerEnter={ () => setCursorPointer(true) }
      onPointerLeave={ () => setCursorPointer(false) }
    >
      { video
        ? <Video src={ video } />
        : <img src={ image } alt={ alt } draggable="false" /> }
      <canvas className="sc-detail__pixels"></canvas>
    </div>
  )
}

// types the texts of a block letter by letter, one text after the other
function typeBlock(block: Element) {
  const timeline = gsap.timeline()
  block.querySelectorAll(".sc-detail__type, .sc-detail__fade").forEach((element) => {
    if (element.classList.contains("sc-detail__fade")) {
      timeline.to(element, { autoAlpha: 1, duration: .2, ease: "steps(2)" })
      return
    }
    const chars = element.querySelectorAll(".sc-detail__char")
    if (!chars.length) return
    timeline.to(chars, { autoAlpha: 1, duration: .01, stagger: Math.min(TYPE_SPEED, TYPE_MAX / chars.length) })
  })
  return timeline
}

// shows an image or video block by block, starting from a few huge pixels that get sharper.
// track receives the animation so it can be killed
function pixelReveal(wrapper: HTMLElement, track: (animation: gsap.core.Animation) => void) {
  const media = wrapper.querySelector<HTMLImageElement | HTMLVideoElement>("img, video")
  const canvas = wrapper.querySelector("canvas")
  const ctx = canvas?.getContext("2d")
  if (!media || !canvas || !ctx) {
    gsap.set(wrapper, { autoAlpha: 1 })
    return
  }

  const isVideo = media instanceof HTMLVideoElement
  const ready = isVideo ? media.readyState >= 2 : media.complete && media.naturalWidth > 0
  if (!ready) {
    // still loading, try again when there's something to draw
    media.addEventListener(isVideo ? "loadeddata" : "load", () => pixelReveal(wrapper, track), { once: true })
    return
  }

  const state = { progress: 0 }
  const draw = () => {
    const size = PIXEL_STEPS[Math.min(Math.floor(state.progress * PIXEL_STEPS.length), PIXEL_STEPS.length - 1)]
    const width = Math.max(1, Math.round(media.clientWidth / size))
    const height = Math.max(1, Math.round(media.clientHeight / size))
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    // drawn tiny, css scales it back up without smoothing
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(media, 0, 0, width, height)

    // punches out the blocks that haven't shown up yet
    const shown = state.progress / BLOCK_END
    if (shown >= 1) return
    const scale = BLOCK_SIZE / size
    const columns = Math.ceil(media.clientWidth / BLOCK_SIZE)
    const rows = Math.ceil(media.clientHeight / BLOCK_SIZE)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if (blockNoise(x, y) < shown) continue
        const left = Math.round(x * scale)
        const top = Math.round(y * scale)
        ctx.clearRect(left, top, Math.round((x + 1) * scale) - left, Math.round((y + 1) * scale) - top)
      }
    }
  }

  draw()
  // only the canvas is seen until the reveal is over
  media.style.opacity = "0"
  canvas.style.visibility = "inherit"
  gsap.set(wrapper, { autoAlpha: 1 })
  track(gsap.to(state, {
    progress: 1,
    duration: PIXEL_DURATION,
    ease: "none",
    onUpdate: draw,
    onComplete: () => {
      media.style.opacity = ""
      canvas.style.visibility = "hidden"
    },
  }))
}

export default function ProjectDetail({ project, onClose }: ProjectDetailProps) {
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)
  const playSound = useBitcenteStore((state) => state.playSound)

  // keeps the last project while the page fades out
  const [content, setContent] = useState<ProjectType | undefined>(project)

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const splitRef = useRef<SplitText>()
  // stops watching the scroll and whatever is being revealed
  const stopRevealRef = useRef<() => void>()

  const isOpen = !!project
  const shown = project ?? content
  // image or video shown in big
  const [zoomed, setZoomed] = useState<ZoomedMedia | null>(null)

  const pointerEvents = {
    onPointerEnter: () => setCursorPointer(true),
    onPointerOut: () => setCursorPointer(false),
  }

  // fills the progress bar with how much of the page has been scrolled
  const updateProgress = () => {
    const scroll = scrollRef.current
    const progress = progressRef.current
    if (!scroll || !progress) return
    const max = scroll.scrollHeight - scroll.clientHeight
    // nothing to scroll, no bar
    progress.style.visibility = max > 1 ? "inherit" : "hidden"
    progress.style.setProperty("--progress", String(max > 1 ? Math.min(scroll.scrollTop / max, 1) : 0))
  }

  const close = () => {
    setCursorPointer(false)
    onClose()
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    setZoomed(null)
    stopRevealRef.current?.()
    stopRevealRef.current = undefined
    gsap.killTweensOf(root)

    if (!project) {
      gsap.to(root, { autoAlpha: 0, duration: .25, ease: "steps(3)", onComplete: () => setContent(undefined) })
      return
    }

    setContent(project)
    scrollRef.current?.scrollTo({ top: 0 })
    gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: .3, ease: "steps(3)", delay: OPEN_DELAY })

    // everything starts hidden and shows up as it enters the screen while scrolling
    splitRef.current?.revert()
    const split = new SplitText(root.querySelectorAll(".sc-detail__type"), { type: "words,chars", charsClass: "sc-detail__char" })
    splitRef.current = split
    gsap.set([split.chars, root.querySelectorAll(".sc-detail__fade, .sc-detail__media")], { autoAlpha: 0 })

    const animations: gsap.core.Animation[] = []
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return
        observer.unobserve(target)
        if (target.classList.contains("sc-detail__media")) {
          pixelReveal(target as HTMLElement, (animation) => animations.push(animation))
        } else {
          animations.push(typeBlock(target))
        }
      })
    }, { root: scrollRef.current, rootMargin: "0px 0px -10% 0px" })

    // waits for the page to be there before revealing what's already on screen
    const start = gsap.delayedCall(OPEN_DELAY + .2, () => {
      root.querySelectorAll(".sc-detail__reveal").forEach((block) => observer.observe(block))
    })

    stopRevealRef.current = () => {
      start.kill()
      observer.disconnect()
      animations.forEach((animation) => animation.kill())
    }
  }, [project])

  useEffect(() => {
    return () => stopRevealRef.current?.()
  }, [])

  // the page grows as images and videos load
  useEffect(() => {
    const inner = scrollRef.current?.firstElementChild
    if (!inner) return
    updateProgress()
    const observer = new ResizeObserver(updateProgress)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [shown])

  return (
    <div
      className="sc-detail"
      ref={ rootRef }
      role="dialog"
      aria-label={ shown?.name }
      aria-hidden={ !isOpen }
    >
      { shown && <>
        <button className="sc-detail__close pv__close text-s" onClick={ close } aria-label="Close project" {...pointerEvents}>
          <PixelX />
        </button>

        { !isMobile() && <div className="sc-detail__progress" ref={ progressRef } aria-hidden="true">
          <div className="sc-detail__progress-bar"></div>
        </div> }

        <div className="sc-detail__scroll" ref={ scrollRef } onScroll={ updateProgress }>
          <div className="sc-detail__inner" key={ shown.name }>

            <header className="sc-detail__header">
              <div className="sc-detail__title sc-detail__reveal">
                <span className="text-s green-2 sc-detail__type"><img className="asterisk" src="svg/asterisk.svg" />Project &#123;</span>
                <h2 className="title-l sc-detail__type">{ shown.name }{ shown.awarded && <Award ishovered={true} classes="sc-detail__fade" /> }</h2>
                <div className="pv__tags sc-detail__fade">
                  {shown.jobs.map((job) => (
                    <Tag text={JobMap[job]} key={job} />
                  ))}
                </div>
              </div>
              <div className="sc-detail__summary sc-detail__reveal">
                <p className="text-m sc-detail__type">{ formatText(shown.description) }</p>
                { shown.url && <a
                  className="pv__visit text-m sc-detail__fade"
                  href={ shown.url }
                  target="_blank"
                  rel="noreferrer"
                  onClick={ () => playSound(Sound.OpenLink) }
                  {...pointerEvents}
                >
                  Visit project<LinkArrow />
                </a> }
              </div>
            </header>

            { shown.video && <Media video={ shown.video } onZoom={ setZoomed } /> }

            {shown.slides?.filter(({ cover }) => !cover).map(({ title, text, image, video }, i, slides) => {
              const hasMedia = !!(image || video)
              const hasText = !!(title || text)
              // only the sections with a title are numbered, images and videos on their own don't count
              const number = slides.slice(0, i + 1).filter((slide) => slide.title).length
              return (
                <section
                  className={ "sc-detail__section " + (hasMedia && hasText ? 'has-both' : '') }
                  key={ i }
                >
                  { hasText && <div className="sc-detail__text sc-detail__reveal">
                    { title && <h3 className="title-s sc-detail__type">
                      <span className="green-2">{ String(number).padStart(2, "0") }.</span> { title }
                    </h3> }
                    { text && <p className="text-m sc-detail__type">{ formatText(text) }</p> }
                  </div> }
                  { hasMedia && <Media video={ video } image={ image } alt={ shown.name + (title ? " - " + title : "") } onZoom={ setZoomed } /> }
                </section>
              )
            })}

            <footer className="sc-detail__footer sc-detail__reveal">
              <span className="text-s green-2 sc-detail__fade">&#125;</span>
              { shown.url && <a
                className="pv__visit text-m sc-detail__fade"
                href={ shown.url }
                target="_blank"
                rel="noreferrer"
                onClick={ () => playSound(Sound.OpenLink) }
                {...pointerEvents}
              >
                Visit project<LinkArrow />
              </a> }
            </footer>

          </div>
        </div>
      </> }

      { zoomed && <MediaZoom media={ zoomed } onClose={ () => setZoomed(null) } /> }
    </div>
  )
}
