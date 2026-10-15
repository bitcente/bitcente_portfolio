import { useEffect, useRef, useState } from 'react'
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { SplitText } from "gsap/SplitText";
import { useBitcenteStore } from '../../store'
import { useArcadeStore, useEscapeClaim, usePlaying } from '../../arcade/store';
import { Sound } from '../../classes/SoundBoard';
import { JobMap, projects } from '../../settings';
import { isMobile as isDeviceMobile } from '../../utils/Screen';
import BitcenteIcon, { BitcenteIconState } from '../../components/BitcenteIcon';
import Tag from '../../components/Tag';
import Award from '../../components/Award';
import Carousel from './Carousel';
import ProjectDetail from './ProjectDetail';
import { SpeakerIcon, useMuteButton } from '../../components/MuteButton';
import { usePreload } from './usePreload';
import './showcase.css'
gsap.registerPlugin(Draggable,SplitText);

const animationVariables = {
  initialLetterYPos: [-500, -200],
  initialLetterDuration: [1, 1.3],
  // every letter is drawn at this size while it flies in: too big and phones run out of memory and the page crashes
  initialLetterScale: [10, 6],
  bounceLetterYPos: [-50, -20],
}

const logoLetters = ["b", "i", "t", "c", "e", "n", "t", "e"]

const letterSounds: Record<string, Sound> = {
  b: Sound.B,
  i: Sound.I,
  t: Sound.T,
  c: Sound.C,
  e: Sound.E,
  n: Sound.N,
}

const socials = [
  { name: "LinkedIn", icon: "svg/linkedin.svg", url: "https://linkedin.com/in/vicente-marrod/" },
  { name: "Github", icon: "svg/github.svg", url: "https://github.com/bitcente" },
  { name: "Email", icon: "svg/mail.svg", url: "mailto:hi@bitcente.com" },
  { name: "Phone", icon: "svg/telef.svg", url: "tel:+34601407676" },
]

// everything the intro shows and plays, the page can't be started until it's all there
const PRELOAD = {
  images: [
    ...logoLetters.flatMap((letter) => ["svg/logo/" + letter + ".svg", "svg/logo/dark/" + letter + ".svg"]),
    ...socials.map(({ icon }) => icon),
    "svg/pizza.svg",
    "/svg/arrow_dialog.svg",
    ...Object.values(BitcenteIconState).map((gif) => "/gif/" + gif),
  ],
  sounds: [Sound.StartIntro, Sound.Bitcente, Sound.StartDing, ...Object.values(letterSounds)],
}
// blocks of the loading bar
const LOADING_BLOCKS = 20

// px a finger has to travel to count as a swipe
const SWIPE_DISTANCE = 40

enum View {
  Intro,
  Carousel,
}

function ShowcasePage() {
  const [started, setStarted] = useState(false)
  const [canInteract, setCanInteract] = useState(false)
  const [canMove, setCanMove] = useState(false)
  const [view, setView] = useState(View.Intro)
  const [draggingPizza, setDraggingPizza] = useState(false)

  // project centred in the carousel, the one under the cursor and the one opened in the detail page
  const [activeProject, setActiveProject] = useState(0)
  const [hoveredProject, setHoveredProject] = useState<number | null>(null)
  const [openedProject, setOpenedProject] = useState<number | null>(null)

  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)
  const playSound = useBitcenteStore((state) => state.playSound)
  const setBitcenteEating = useBitcenteStore((state) => state.setBitcenteEating)

  const carouselRef = useRef<HTMLDivElement>(null)
  const carousel = useRef<Carousel>()

  const isMobile = isDeviceMobile();
  const isOpen = openedProject !== null
  // the other arcade machines keep their pages running, this one only gets input while it's the one played
  const playing = usePlaying()
  const playingRef = useRef(playing)
  playingRef.current = playing
  // ESC closes the project before it leaves the arcade machine
  useEscapeClaim(playing && isOpen)
  // nobody sees this page while another machine is being played, the carousel can rest
  const settled = useArcadeStore((state) => state.settled)
  useEffect(() => {
    carousel.current?.setSuspended(!playing && settled)
    // when it isn't the machine being played it's only seen small, in the room
    carousel.current?.setResolution(playing ? 1 : .5)
  }, [playing, settled])
  const shownProject = projects[openedProject ?? hoveredProject ?? activeProject]

  const mute = useMuteButton()

  const loadProgress = usePreload(PRELOAD)
  const loaded = loadProgress >= 1
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded

  const pointerEvents = {
    onPointerEnter: () => setCursorPointer(true),
    onPointerOut: () => setCursorPointer(false),
  }

  const goToIntro = () => {
    if (!canMove || isOpen) return
    setView(View.Intro)
  }
  const goToCarousel = () => {
    if (!canMove || isOpen) return
    setView(View.Carousel)
  }

  const closeProject = () => {
    setCursorPointer(false)
    setOpenedProject(null)
    carousel.current?.close()
  }

  // WebGL carousel
  useEffect(() => {
    if (!carouselRef.current) return

    const instance = new Carousel({
      container: carouselRef.current,
      items: projects.map(({ name, video, slides }) => {
        // the cover slide wins, whether it's a video or an image
        const cover = slides?.find((slide) => slide.cover && (slide.video || slide.image))
        if (cover) return { name, video: cover.video, image: cover.image }
        return { name, video, image: slides?.find((slide) => slide.image)?.image }
      }),
      onActiveChange: (index) => {
        setActiveProject(index)
      },
      onHoverChange: (index) => {
        setHoveredProject(index)
        setCursorPointer(index !== null)
      },
      onSelect: (index) => {
        setCursorPointer(false)
        playSound(Sound.OpenLink)
        setOpenedProject(index)
      },
    })
    carousel.current = instance

    return () => {
      instance.destroy()
      carousel.current = undefined
    }
  }, [])

  // Switch between the intro and the carousel
  useEffect(() => {
    if (!canInteract) return;

    setCanMove(false);
    const setting = {timer: 0}

    if (view === View.Carousel) {

      document.body.classList.add("projects-view");

      gsap.to('.intro-desc', { opacity: 0, scale: .9, duration: .3 })
      gsap.to('.scroll-down', { opacity: 0, scale: .9, duration: .3 })

      // the carousel animates its own entrance (see Carousel.enter)
      gsap.set('.sc-screen', { autoAlpha: 1, delay: .8, overwrite: true,
        onComplete: () => carousel.current?.enter() })
      gsap.to('.sc-hud', { autoAlpha: 1, duration: .3, delay: 1.1, overwrite: true })

      gsap.to(setting, { timer: 1, delay: 1.1, onComplete: () => setCanMove(true) })

      document.querySelectorAll(".logo__letter").forEach((letter) => {
        gsap.to(letter, {
          y: 0,
          duration: .25,
          ease: "back.out(1.7)",
        })
      })

    } else {

      document.body.classList.remove("projects-view");

      gsap.to('.intro-desc', { opacity: 1, scale: 1, duration: .3, delay: .7 })
      gsap.to('.scroll-down', { opacity: 1, scale: 1, duration: .3, delay: .7 })

      carousel.current?.leave()
      gsap.set('.sc-screen', { autoAlpha: 0, delay: .3, overwrite: true })
      gsap.to('.sc-hud', { autoAlpha: 0, duration: .2, overwrite: true })

      gsap.to(setting, { timer: 1, delay: .7, onComplete: () => setCanMove(true) })
    }

    return () => {
      gsap.killTweensOf(setting)
    }
  }, [view, canInteract])

  useEffect(() => {
    return () => {
      document.body.classList.remove("projects-view");
    }
  }, [])

  // the detail page takes the whole screen, so the top and the bottom of the app step aside
  const hasOpened = useRef(false)
  useEffect(() => {
    if (!isOpen && !hasOpened.current) return
    hasOpened.current = true
    gsap.to('.showcase .logo__wrapper, .showcase .socials, .showcase .bitcente-icon__wrapper, .sc-hud', {
      autoAlpha: isOpen ? 0 : 1,
      duration: .4,
      delay: isOpen ? 0 : .15,
      overwrite: true,
    })
  }, [isOpen])

  useEffect(() => {
    if (!playing) return

    const scrollEvent = (e: WheelEvent) => {
      if (!canMove || !started || isOpen) return
      if (view === View.Carousel) {
        // vertical and horizontal scroll both move the carousel
        carousel.current?.wheel(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)
        return
      }
      if (e.deltaY >= 5) goToCarousel()
    }

    const keyEvent = (e: KeyboardEvent) => {
      if (isOpen) {
        if (e.key === "Escape") closeProject()
        return
      }
      if (!canMove || !started) return
      if (view === View.Intro) {
        if (e.key === "ArrowDown") goToCarousel()
        return
      }
      if (e.key === "ArrowUp") goToIntro()
      if (e.key === "ArrowRight") carousel.current?.step(1)
      if (e.key === "ArrowLeft") carousel.current?.step(-1)
      if (e.key === "Enter") carousel.current?.openActive()
    }

    // swipe up on the intro to reach the carousel
    let touchY: number | undefined
    const touchStartEvent = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const touchEndEvent = (e: TouchEvent) => {
      if (touchY === undefined || view !== View.Intro) return
      if (touchY - e.changedTouches[0].clientY > SWIPE_DISTANCE) goToCarousel()
      touchY = undefined
    }

    window.addEventListener("keydown", keyEvent)
    window.addEventListener("wheel", scrollEvent)
    window.addEventListener("touchstart", touchStartEvent)
    window.addEventListener("touchend", touchEndEvent)
    return () => {
      window.removeEventListener("keydown", keyEvent)
      window.removeEventListener("wheel", scrollEvent)
      window.removeEventListener("touchstart", touchStartEvent)
      window.removeEventListener("touchend", touchEndEvent)
    }
  }, [canMove, started, view, isOpen, playing])

  // Initial "Game Boy Advance" Style Animation
  useEffect(() => {
    if (!started) return;

    const letters = document.querySelectorAll(".logo__letter");
    let stagger = 0;

    const introDescCharsRef = isMobile ? undefined : new SplitText(".intro-desc", {type: "words"});
    if (introDescCharsRef) gsap.set(introDescCharsRef.words, {autoAlpha: 0});

    playSound(Sound.StartIntro);

    const windowIdentificator = isMobile ? 1 : 0;
    const duration = animationVariables.initialLetterDuration[windowIdentificator];

    letters.forEach((letter, i) => {
      gsap.fromTo(letter, {
        y: animationVariables.initialLetterYPos[windowIdentificator],
      }, {
        y: 0,
        ease: "sine.inOut",
        duration,
        delay: stagger
      });
      gsap.fromTo(letter, {
        x: -1000 + (i * 500),
      }, {
        x: 0,
        ease: "power4.out",
        duration,
        delay: stagger
      });
      gsap.fromTo(letter, {
        autoAlpha: 0,
        scale: animationVariables.initialLetterScale[windowIdentificator],
      }, {
        autoAlpha: 1,
        scale: 1,
        ease: "power3.out",
        duration,
        delay: stagger
      });

      gsap.to(letter, {
        y: animationVariables.bounceLetterYPos[windowIdentificator],
        duration: .18,
        yoyo: true,
        repeat: 1,
        delay: 2 + stagger * .7,
        onStart: () => {
          if (i === letters.length -1) {
            playSound(Sound.Bitcente)
          }
        }
      })

      // the lit letter fades in over the dark one (a css filter instead is redrawn on every frame and phones choke on it)
      gsap.to(letter.querySelector(".logo__lit"), {
        opacity: 1,
        ease: "power3.out",
        duration: .8,
        delay: 3.6 + stagger * .3,
        onStart: () => {
          if (i === letters.length -1) {
            playSound(Sound.StartDing);
          }
        },
        onComplete: () => {
          if (i === letters.length -1) {
            setCanInteract(true);
            gsap.to(".bitcente-icon__wrapper, .socials, .bottom-desc", {
              autoAlpha: 1,
              duration: .5,
              delay: .6
            })

            if (!document.body.classList.contains("projects-view")) {
              gsap.to(".scroll-down", {
                autoAlpha: 1,
                duration: .5,
                delay: .6
              })
            }

            if (introDescCharsRef) {
              gsap.set(".intro-desc", {visibility: "visible"});
              gsap.to(introDescCharsRef.words, {
                autoAlpha: 1,
                delay: i * 0.03,
                duration: .3,
                stagger: 0.03,
              });
            }
          }
        }
      });

      stagger += 0.1;
    })
  }, [started])

  const hoverLetter = (e: React.PointerEvent<HTMLElement>) => {
    if (!canMove) return;
    gsap.to(e.currentTarget, {
      y: -20,
      duration: .25,
      ease: "back.out(1.7)",
    })
    playSound(letterSounds[e.currentTarget.dataset.letter!])
  }
  const blurLetter = (e: React.PointerEvent<HTMLElement>) => {
    if (!canMove) return;
    gsap.to(e.currentTarget, {
      y: 0,
      duration: .25,
      ease: "back.out(1.7)",
    })
  }

  // Pizza that can be dragged to Bitcente
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const pizza = document.getElementById("pizza");
    const bitcenteIcon = document.querySelector(".bitcente-icon");
    if (!pizza || !bitcenteIcon) return;

    const startX = gsap.getProperty(pizza, "x");
    const startY = gsap.getProperty(pizza, "y");

    const [draggable] = Draggable.create(pizza, {
      type: 'x,y',
      onRelease: function () {
        if (this.hitTest(bitcenteIcon)) {
          gsap.set(this.target, {
            autoAlpha: 0,
          });
          setBitcenteEating(true);
        }
        gsap.to(this.target, {
          x: startX,
          y: startY,
          duration: 0.4,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(this.target, {
              autoAlpha: 1,
            })
          }
        });
      },
      onDragStart: function () {
        setDraggingPizza(true);
      },
      onDragEnd: function () {
        setDraggingPizza(false);
      }
    });

    return () => {
      draggable.kill()
    }
  }, [])

  useEffect(() => {
    const events = isMobile ? ["touchstart"] : ["keydown", "click"]
    const startExperience = () => {
      if (!playingRef.current || !loadedRef.current) return
      setCursorPointer(false);
      gsap.to('.start-screen', {
        opacity: 0,
        pointerEvents: 'none',
        duration: .5,
        onComplete: () => {
          setStarted(true);
        }
      });
      events.forEach((event) => window.removeEventListener(event, startExperience))
    }
    events.forEach((event) => window.addEventListener(event, startExperience))
    return () => {
      events.forEach((event) => window.removeEventListener(event, startExperience))
    }
  }, [])

  return (
    <>
      <div className="start-screen">
        <div className="start-screen__veil"></div>
        <div className="start-screen__content title-m">
          { loaded && !isMobile && "PRESS ANY KEY TO START" }
          { loaded && isMobile && "TAP ANYWHERE TO START" }
          { !loaded && <div className="start-screen__loading">
            <div className="start-screen__bar" role="progressbar" aria-valuenow={ Math.floor(loadProgress * 100) } aria-valuemin={ 0 } aria-valuemax={ 100 }>
              { Array.from({ length: LOADING_BLOCKS }, (_, i) => (
                <div className={ "start-screen__block" + (i < Math.floor(loadProgress * LOADING_BLOCKS) ? " is-full" : "") } key={ i }></div>
              )) }
            </div>
            <span className="text-s">LOADING { Math.floor(loadProgress * 100) }%</span>
          </div> }
        </div>
      </div>
      <div className={ "global showcase " + ((view === View.Intro) ? "start" : "content") + (isOpen ? " project-open" : "") }>

        <BitcenteIcon started={started} draggingPizza={draggingPizza} />

        { !isMobile && <div className="intro-desc text-align-center">
          <span>I'm a <strong>Creative Front-end Developer</strong> from Spain always looking forward to improve and innovate using the <strong>latest technologies</strong>.</span>
        </div> }

        <div className="socials">
          {socials.map(({ name, icon, url }) => (
            <a
              href={ url }
              className="social"
              // only web pages in a new tab: mailto: and tel: are handed to the mail and phone apps, a new tab
              // would just be left open with the address in it
              { ...(url.startsWith("http") && { target: "_blank", rel: "noreferrer" }) }
              onClick={() => playSound(Sound.OpenLink)}
              draggable="false"
              key={ name }
              {...pointerEvents}
            >
              <img src={ icon } alt={ name + " Icon" } draggable="false" />
            </a>
          ))}
          <div className={"social " + (draggingPizza ? 'dragging' : '')} {...pointerEvents}>
            <img src="svg/pizza.svg" alt="Pizza Icon" id="pizza" {...pointerEvents} />
          </div>
          <button className="social social--sound" { ...mute.props }>
            <SpeakerIcon muted={ mute.muted } padded />
          </button>
        </div>

        <div
          className="logo__wrapper"
          onClick={ () => { goToIntro(); setCursorPointer(false) } }
          onPointerEnter={() => view === View.Carousel && !isOpen && setCursorPointer(true)}
          onPointerOut={() => setCursorPointer(false)}
        >
          <div className="logo">
            {logoLetters.map((letter, i) => (
              <span className="logo__letter" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter={letter} key={ letter + i }>
                <img src={ "svg/logo/dark/" + letter + ".svg" } alt="" draggable="false" />
                <img className="logo__lit" src={ "svg/logo/" + letter + ".svg" } alt="" draggable="false" />
              </span>
            ))}
          </div>
          <div className="bottom-desc text-base text-align-center"><div>Creative Front-end<br/> Developer ©{new Date().getFullYear()}</div></div>
        </div>

        <div className="scroll-down title-m" onClick={ goToCarousel } {...pointerEvents}>
          { !isMobile && <><div className="display-inline-block idleAnimation">↓↓↓</div> SCROLL DOWN <div className="display-inline-block idleAnimation">↓↓↓</div></> }
          { isMobile && <><div className="display-inline-block idleAnimation">↑↑↑</div> SWIPE UP <div className="display-inline-block idleAnimation">↑↑↑</div></> }
        </div>

        <div className="sc-screen">
          <div className="sc-carousel" ref={ carouselRef }></div>
        </div>

        <div className="sc-hud">
          <div className="sc-hud__project">
            <h2 className="title-s" key={ shownProject.name }>{ shownProject.name }{ shownProject.awarded && <Award ishovered={true} /> }</h2>
          </div>
          { !isMobile && <div className="sc-hud__tags">
            {shownProject.jobs.map((job) => (
              <Tag text={JobMap[job]} key={job} />
            ))}
          </div> }
          <div className="sc-hud__hint text-s green-2">
            { isMobile ? "Drag to explore · Tap to open" : "Scroll or drag to explore · Click to open" }
          </div>
        </div>

        <ProjectDetail project={ isOpen ? projects[openedProject] : undefined } onClose={ closeProject } />

        <div className="grid-effect"></div>

      </div>

    </>
  )
}

export default ShowcasePage
