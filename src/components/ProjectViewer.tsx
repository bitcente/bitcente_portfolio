import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { useBitcenteStore } from "../store";
import { useEscapeClaim } from "../arcade/store";
import { Sound } from "../classes/SoundBoard";
import { JobMap, ProjectSlide, ProjectType } from "../settings";
import { formatText } from "../utils/Text";
import Tag from "./Tag";
import Award from "./Award";
import LinkArrow from "./LinkArrow";

gsap.registerPlugin(Draggable, InertiaPlugin);

interface ProjectViewerProps {
  project?: ProjectType;
  onClose: () => void;
}

export default function ProjectViewer({ project, onClose }: ProjectViewerProps) {
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)
  const playSound = useBitcenteStore((state) => state.playSound)

  // keeps the last project while the viewer fades out
  const [content, setContent] = useState<ProjectType | undefined>(project)
  const [slideIndex, setSlideIndex] = useState(0)

  const carouselRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // x position of the track for each slide
  const snapPoints = useRef<number[]>([0])
  const currentRef = useRef(0)

  const isOpen = !!project
  // ESC closes the viewer before it leaves the arcade machine
  useEscapeClaim(isOpen)
  const shown = project ?? content
  // cover slides are only for the showcase carousel
  const visibleSlides = shown?.slides?.filter(({ cover }) => !cover)
  const slides: ProjectSlide[] = visibleSlides?.length
    ? visibleSlides
    : [{ title: "Overview", text: shown?.description ?? "" }]
  const current = Math.min(slideIndex, slides.length - 1)
  const isDraggable = slides.length > 1

  const pointerEvents = {
    onPointerEnter: () => setCursorPointer(true),
    onPointerOut: () => setCursorPointer(false),
  }

  const setCurrent = (index: number) => {
    if (index === currentRef.current) return
    currentRef.current = index
    playSound(Sound.Hover)
    setSlideIndex(index)
  }

  const closestSlide = (x: number) => {
    const points = snapPoints.current
    let closest = 0
    points.forEach((point, i) => {
      // <= so the last slide wins when several of them share the end position
      if (Math.abs(point - x) <= Math.abs(points[closest] - x)) closest = i
    })
    return closest
  }

  const goTo = (index: number) => {
    if (index < 0 || index > slides.length - 1 || index === currentRef.current) return
    setCurrent(index)
    gsap.to(trackRef.current, { x: snapPoints.current[index], duration: .6, ease: "power3.out", overwrite: true })
  }

  const close = () => {
    setCursorPointer(false)
    onClose()
  }

  useLayoutEffect(() => {
    if (!project) return
    setContent(project)
    setSlideIndex(0)
    currentRef.current = 0
  }, [project])

  // Draggable carousel
  useLayoutEffect(() => {
    const carousel = carouselRef.current
    const track = trackRef.current
    if (!isOpen || !carousel || !track) return

    const measure = () => {
      const maxScroll = Math.max(0, track.scrollWidth - carousel.clientWidth)
      snapPoints.current = Array.from(track.children).map((slide) => (
        -Math.min((slide as HTMLElement).offsetLeft, maxScroll)
      ))
      return maxScroll
    }

    gsap.set(track, { x: 0 })
    let maxScroll = measure()

    const [draggable] = Draggable.create(track, {
      type: "x",
      // the track is only as wide as the carousel (slides overflow it), so listen on the whole carousel
      trigger: carousel,
      bounds: { minX: -maxScroll, maxX: 0 },
      inertia: true,
      edgeResistance: .8,
      throwResistance: 2500,
      maxDuration: .8,
      snap: { x: (x) => snapPoints.current[closestSlide(x)] },
      onDrag: function () { setCurrent(closestSlide(this.x)) },
      onThrowUpdate: function () { setCurrent(closestSlide(this.x)) },
    })

    const resize = () => {
      maxScroll = measure()
      draggable.applyBounds({ minX: -maxScroll, maxX: 0 })
      gsap.set(track, { x: snapPoints.current[currentRef.current] ?? 0 })
      draggable.update()
    }
    window.addEventListener("resize", resize)

    return () => {
      window.removeEventListener("resize", resize)
      gsap.killTweensOf(track)
      draggable.kill()
    }
  }, [isOpen, shown])

  useEffect(() => {
    if (!isOpen) return

    document.body.classList.add("project-viewer-open")

    const keyEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "ArrowRight") goTo(currentRef.current + 1)
      if (e.key === "ArrowLeft") goTo(currentRef.current - 1)
    }
    window.addEventListener("keydown", keyEvent)
    return () => {
      document.body.classList.remove("project-viewer-open")
      window.removeEventListener("keydown", keyEvent)
    }
  }, [isOpen, slides.length])

  return (
    <div className={ "project-viewer " + (isOpen ? 'is-active' : '') } aria-hidden={ !isOpen }>
      <div className="pv__veil" onClick={ close }></div>
      <div
        className="pv__modal"
        role="dialog"
        aria-modal="true"
        aria-label={ shown?.name }
      >
        { shown && <>
          <div className="pv__header">
            <span className="text-s green-2"><img className="asterisk" src="svg/asterisk.svg" />Project &#123;</span>
            <button className="pv__close text-s" onClick={ close } aria-label="Close project" {...pointerEvents}>
              X
            </button>
          </div>

          <div className="pv__title">
            <h2 className="title-m">{ shown.name }{ shown.awarded && <Award ishovered={true} /> }</h2>
            <div className="pv__tags">
              {shown.jobs.map((job) => (
                <Tag text={JobMap[job]} key={job} />
              ))}
            </div>
          </div>

          <div
            className="pv__carousel"
            ref={ carouselRef }
            onPointerEnter={ () => isDraggable && setCursorPointer(true) }
            onPointerLeave={ () => setCursorPointer(false) }
          >
            <div className="pv__track" ref={ trackRef } key={ shown.name }>
              {slides.map(({ title, text, image, width }, i) => (
                <div
                  className={ "pv__slide " + (image && (title || text) ? 'has-image' : '') }
                  style={ width ? { '--pv-slide-width': width } as React.CSSProperties : undefined }
                  key={ i }
                >
                  { image && <div className="pv__image">
                    <img src={ image } alt={ shown.name + (title ? " - " + title : "") } draggable="false" />
                  </div> }
                  { (title || text) && <div className="pv__text">
                    { title && <h3 className="text-m">
                      <span className="green-3">{ String(i + 1).padStart(2, "0") }.</span> { title }
                    </h3> }
                    { text && <p className="text-base">{ formatText(text) }</p> }
                  </div> }
                </div>
              ))}
            </div>
          </div>

          <div className="pv__footer">
            <div className="pv__nav">
              <div className="pv__dots">
                {slides.map((_, i) => (
                  <button
                    className={ "pv__dot " + (i === current ? 'is-active' : '') }
                    onClick={ () => goTo(i) }
                    aria-label={ "Go to slide " + (i + 1) }
                    key={ i }
                    {...pointerEvents}
                  ></button>
                ))}
              </div>
              <span className="pv__counter text-s green-2">
                { String(current + 1).padStart(2, "0") }/{ String(slides.length).padStart(2, "0") }
              </span>
            </div>

            <a
              className="pv__visit text-m"
              href={ shown.url }
              target="_blank"
              rel="noreferrer"
              onClick={ () => playSound(Sound.OpenLink) }
              {...pointerEvents}
            >
              Visit project<LinkArrow />
            </a>
          </div>

          <span className="text-s green-2">&#125;</span>
        </> }
      </div>
    </div>
  )
}
