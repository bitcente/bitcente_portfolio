import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { gsap } from "gsap"
import { useEscapeClaim } from "../../arcade/store"
import { isTouchDevice } from "../../utils/Screen"

export interface ZoomedMedia {
  video?: string
  image?: string
  alt?: string
  // the image or video in the page it grows out of, and goes back into
  from: HTMLElement
}

// how much of the window the zoomed media can take
const MAX_SIZE = .92

// where the media sits right now, as a move and scale from its final place in the middle of the window
function offsetFrom(from: HTMLElement, to: HTMLElement) {
  const start = from.getBoundingClientRect()
  const end = to.getBoundingClientRect()
  return {
    x: start.left + start.width / 2 - (end.left + end.width / 2),
    y: start.top + start.height / 2 - (end.top + end.height / 2),
    scale: start.width / end.width,
  }
}

// An image or video of a project in big, over everything and outside of the CRT effect (which is drawn over the
// page, so this goes straight into the body). Grows out of the media that was clicked and shrinks back into it
export default function MediaZoom({ media, onClose }: { media: ZoomedMedia, onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)

  // ESC closes this first, not the project or the arcade machine
  useEscapeClaim(true)

  const close = () => {
    const root = rootRef.current
    const element = mediaRef.current
    if (closing.current || !root || !element) return
    closing.current = true
    gsap.timeline({ onComplete: onClose })
      .to(element, { ...offsetFrom(media.from, element), duration: .4, ease: "power3.inOut" })
      .to(root, { backgroundColor: "rgba(13, 20, 3, 0)", duration: .3, ease: "none" }, 0)
      .set(media.from, { autoAlpha: 1 })
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    const element = mediaRef.current
    if (!root || !element) return
    // as big as fits in the window, with the shape of the one in the page
    const { width, height } = media.from.getBoundingClientRect()
    const size = Math.min(window.innerWidth * MAX_SIZE, window.innerHeight * MAX_SIZE * width / height)
    element.style.width = size + "px"
    element.style.height = size * height / width + "px"
    // the one in the page is hidden while it's out here
    gsap.set(media.from, { autoAlpha: 0 })
    gsap.fromTo(element, offsetFrom(media.from, element), { x: 0, y: 0, scale: 1, duration: .5, ease: "power3.out" })
    gsap.fromTo(root, { backgroundColor: "rgba(13, 20, 3, 0)" }, { backgroundColor: "rgba(13, 20, 3, .92)", duration: .35, ease: "none" })
    return () => {
      gsap.killTweensOf([element, root])
      gsap.set(media.from, { autoAlpha: 1 })
    }
  }, [media])

  useEffect(() => {
    // capture, so the page's own ESC (that closes the project) doesn't get it
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      close()
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [media])

  return createPortal(
    <div className="media-zoom" ref={ rootRef } onClick={ close } role="dialog" aria-label={ media.alt ?? "Media" }>
      <div className="media-zoom__media" ref={ mediaRef }>
        { media.video
          ? <video src={ media.video } muted loop autoPlay playsInline disablePictureInPicture />
          : <img src={ media.image } alt={ media.alt } draggable="false" /> }
      </div>
      <span className="media-zoom__hint text-s">{ isTouchDevice() ? "Tap to close" : "Click or ESC to close" }</span>
    </div>,
    document.body,
  )
}
