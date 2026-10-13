import { useEffect, useState } from 'react'
import { useBitcenteStore } from '../store'
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { SplitText } from "gsap/SplitText";
import React from 'react';
import Tag from '../components/Tag';
import { experienceList, Job, JobMap, projects, ProjectType, skills, studiesList } from '../settings';
import Award from '../components/Award';
import { Sound } from '../classes/SoundBoard';
import BitcenteIcon from '../components/BitcenteIcon';
import { isMobile as isDeviceMobile } from '../utils/Screen';
import { ScrollTrigger } from 'gsap/all';
import Tooltip from '../components/Tooltip';
import ProjectViewer from '../components/ProjectViewer';
gsap.registerPlugin(Draggable,SplitText,ScrollTrigger);

function introDesc() {
  return (<span>I'm a <strong>Creative Front-end Developer</strong> from Spain always looking forward to improve and innovate using the <strong>latest technologies</strong>.</span>);
}

const animationVariables = {
  initialLetterYPos: [-500, -200],
  initialLetterDuration: [1, 1.3],
  initialLetterScale: [10, 17],
  bounceLetterYPos: [-50, -20],
}


function HomePage() {
  const marquee = React.useRef<HTMLInputElement>(null)

  const [started, setStarted] = useState(false)
  const [canInteract, setCanInteract] = useState(false)
  const [canMove, setCanMove] = useState(false)
  const screenView = useBitcenteStore((state) => state.screenView)
  const goToStart = useBitcenteStore((state) => state.goToStart)
  const goToContent = useBitcenteStore((state) => state.goToContent)
  const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer)
  const playSound = useBitcenteStore((state) => state.playSound)
  const setBitcenteEating = useBitcenteStore((state) => state.setBitcenteEating)
  
  const [experience, setExperience] = useState(true)
  const [draggingPizza, setDraggingPizza] = useState(false)

  const [dialogueBoxContent, setDialogueBoxContent] = useState("Modal")
  const [dialogueBoxOpen, setDialogueBoxOpen] = useState(false)

  const [tooltipText, setTooltipText] = useState<string | undefined>()

  const [openedProject, setOpenedProject] = useState<ProjectType | undefined>()

  const globalRef = React.useRef<HTMLDivElement>(null)

  const isMobile = isDeviceMobile();

  const scrollEvent = (e: any) => {
    if (!canMove || !started || dialogueBoxOpen || openedProject) return
    if (e.wheelDeltaY > 0 && e.deltaY <= -5) {
      goToStart()
    }
    if (e.wheelDeltaY < 0 && e.deltaY >= 5) {
      goToContent()
    }
  }

  const keyEvent = (e: any) => {
    if (!canMove || !started || dialogueBoxOpen || openedProject) return
    if (e.key === "ArrowDown") {
      goToContent()
    }
    if (e.key === "ArrowUp") {
      goToStart()
    }
    
  }

  const defaultProjectState = [0]
  const [projectHovered, setProjectHovered] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<number[]>([0])
  const [selectedProjects, setSelectedProjects] = useState<number[]>(defaultProjectState)
  const hoverProject = (index?: number, jobs?: Job[], description?: string) => {
    if (isMobile) return;
    if (!index) {
      setSelectedProjects(defaultProjectState)
      setSelectedJobs(defaultProjectState)
      setProjectHovered(false)
      setCursorPointer(false)
      setTooltipText(undefined)
      return
    }
    setCursorPointer(true)
    if (!jobs) return
    setSelectedProjects([ index ])
    setSelectedJobs(jobs)
    setProjectHovered(true)
    setTooltipText(description)
  }
  const hoverJob = (index?: number) => {
    if (isMobile) return;
    if (!index) {
      setSelectedProjects(defaultProjectState)
      setSelectedJobs(defaultProjectState)
      setProjectHovered(false)
      setCursorPointer(false)
      return
    }
    setCursorPointer(true)
    const projectList: any[] = []
    projects.forEach((project, i) => {
      if (project.jobs && project.jobs.includes(index)) {
        projectList.push(i + 1)
      }
    })
    setSelectedJobs([index])
    setSelectedProjects(projectList)
    setProjectHovered(true)
  }

  useEffect(() => {
    if (!canInteract) return;
    if (isDeviceMobile()) return;
    console.log("JEJEJ", isMobile);
    
    setCanMove(false);
    const setting = {timer: 0}

    if (screenView === 1) {

      document.body.classList.add("projects-view");

      gsap.to('.intro-desc', { opacity: 0, scale: .9, duration: .3 })
      gsap.to('.scroll-down', { opacity: 0, scale: .9, duration: .3 })
      gsap.to('.content-screen', { opacity: 1, duration: .3, scale: 1, pointerEvents: 'inherit', delay: .8 })
      
      gsap.to(setting, { timer: 1, delay: .8, onComplete: () => setCanMove(true) })

      const logoLetters = document.querySelectorAll(".logo__letter");
      logoLetters.forEach((letter) => {
        gsap.to(letter, {
          y: 0,
          duration: .25,
          ease: "back.out(1.7)",
        })
      })

    } else if (screenView === 0) {

      document.body.classList.remove("projects-view");

      gsap.to('.intro-desc', { opacity: 1, scale: 1, duration: .3, delay: .7 })
      gsap.to('.scroll-down', { opacity: 1, scale: 1, duration: .3, delay: .7 })
      gsap.to('.content-screen', { opacity: 0, scale: 1.1, pointerEvents: 'none', duration: .3 })

      gsap.to(setting, { timer: 1, delay: .7, onComplete: () => setCanMove(true) })
    }
  }, [screenView, canInteract])

  useEffect(() => {
    window.addEventListener("keydown", keyEvent)
    window.addEventListener("wheel", scrollEvent)
    return () => {
      window.removeEventListener("wheel", scrollEvent)
      window.removeEventListener("keydown", keyEvent)
    }
  }, [canMove, started, dialogueBoxOpen, openedProject])

  useEffect(() => {
    if (!marquee.current) return

    const aniTextLoop = gsap.timeline({
        paused: true,
        reversed: true,
        defaults: {
          duration: isMobile ? 25 : 50,
          ease: "linear"
        }
    });
    const width__span = marquee.current.getBoundingClientRect().width;
    aniTextLoop.fromTo(marquee.current, {x: 0}, {x: -((width__span!) / 2) - 12, repeat: -1}, 0);
    aniTextLoop.play();
  }, [])

  // Initial "Game Boy Advance" Style Animation
  useEffect(() => {
    if (!started) return;
    
    const letters = document.querySelectorAll(".logo__letter");
    let stagger = 0;
    
    const introDescCharsRef = new SplitText(".intro-desc", {type: "words"});
    gsap.set(introDescCharsRef.words, {autoAlpha: 0});
    new SplitText(".skill__name", {type: "chars"});
    
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

      gsap.to(letter, {
        filter: "brightness(1)",
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
            if (isMobile) {
              setCanMove(true);
              document.body.classList.add("mobile-loaded");
            }
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

            if (isMobile) {
              gsap.to(".content-screen, .grid-effect", {
                autoAlpha: 1,
                duration: .5,
                delay: .6
              });

              ScrollTrigger.create({
                start: 60,
                end: "max",
                onEnter: () => {
                  gsap.to(".gradient-mobile-effect", {
                    opacity: 0,
                    duration: 0.3,
                    ease: "power2.out"
                  });
                },
                onLeaveBack: () => {
                  gsap.to(".gradient-mobile-effect", {
                    opacity: 1,
                    duration: 0.3,
                    ease: "power2.out"
                  });
                }
              });
            }

            gsap.set(".intro-desc", {visibility: "visible"});
            gsap.to(introDescCharsRef.words, {
              autoAlpha: 1,
              delay: i * 0.03,
              duration: .3,
              stagger: 0.03,
            });
          }
        }
      });

      stagger += 0.1;
    })
  }, [started])

  const playSoundFromLetter = (letter: string) => {
    switch (letter) {
      case "b":
        playSound(Sound.B);
        break;
      case "i":
        playSound(Sound.I);
        break;
      case "t":
        playSound(Sound.T);
        break;
      case "c":
        playSound(Sound.C);
        break;
      case "e":
        playSound(Sound.E);
        break;
      case "n":
        playSound(Sound.N);
        break;
    }
  }

  const hoverLetter = (e: any) => {
    if (!canMove) return;
    gsap.to(e.target, {
      y: -20,
      duration: .25,
      ease: "back.out(1.7)",
    })
    playSoundFromLetter(e.target.dataset.letter)
  }
  const blurLetter = (e: any) => {
    if (!canMove) return;
    gsap.to(e.target, {
      y: 0,
      duration: .25,
      ease: "back.out(1.7)",
    })
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const pizza = document.getElementById("pizza");
    const bitcenteIcon = document.querySelector(".bitcente-icon");
    if (!pizza || !bitcenteIcon) return;

    const startX = gsap.getProperty(pizza, "x");
    const startY = gsap.getProperty(pizza, "y");

    Draggable.create(pizza, {
      type: 'x,y',
      onRelease: function () {
        if (this.hitTest(bitcenteIcon)) {
          console.log("Dropped on the target element!");
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
          onComplete: () => { {
            gsap.set(this.target, {
              autoAlpha: 1,
            })
          } }
        });
      },
      onDragStart: function () {
        setDraggingPizza(true);
      },
      onDragEnd: function () {
        setDraggingPizza(false);
      }
    });
  }, [])

  useEffect(() => {
    if (started) return;
    const startExperience = () => {
      setCursorPointer(false);
      gsap.to('.start-screen', {
        opacity: 0,
        pointerEvents: 'none',
        duration: .5,
        onComplete: () => {
          setStarted(true);
        }
      });
      if (!isMobile) {
        window.removeEventListener("keydown", startExperience)
        window.removeEventListener("click", startExperience)
      } else {
        window.removeEventListener("touchstart", startExperience)
      }
    }
    if (!isMobile) {
      window.addEventListener("keydown", startExperience)
      window.addEventListener("click", startExperience)
    } else {
      window.addEventListener("touchstart", startExperience)
    }
    return () => {
      if (!isMobile) {
        window.removeEventListener("keydown", startExperience)
        window.removeEventListener("click", startExperience)
      } else {
        window.removeEventListener("touchstart", startExperience)
      }
    }
  }, [])

  const clickSkill = (text: string) => {
    setDialogueBoxContent(text)
    setDialogueBoxOpen(true)
  }
  const closeDialogueBox = () => {
    setDialogueBoxOpen(false)
  }

  const clickProject = (e: React.MouseEvent, project: ProjectType) => {
    // let ctrl/cmd + click open the real project directly
    if (e.ctrlKey || e.metaKey) return
    e.preventDefault()
    hoverProject()
    playSound(Sound.OpenLink)
    setOpenedProject(project)
  }

  return (
    <>
      <div className="start-screen">
        <div className="start-screen__veil"></div>
        <div className="start-screen__content title-m">
          { !isMobile && "PRESS ANY KEY TO START" }
          { isMobile && "TAP ANYWHERE TO START" }
        </div>
      </div>
      <div ref={globalRef} className={ "global " + ((screenView === 0) ? "start" : "content") }>

        <BitcenteIcon started={started} draggingPizza={draggingPizza} />

        { !isMobile && <div className="intro-desc text-align-center">
          {introDesc()}
        </div> }

        <div className="socials">
          <a 
            href="https://linkedin.com/in/vicente-marrod/"
            className="social"
            target="_blank"
            onPointerEnter={() => {setCursorPointer(true);}}
            onPointerOut={() => setCursorPointer(false)}
            onClick={() => playSound(Sound.OpenLink)}
            draggable="false"
          >
            <img src="svg/linkedin.svg" alt="LinkedIn Icon" />
          </a>
          <a href="https://github.com/bitcente" target="_blank"
            className="social"
            onClick={() => playSound(Sound.OpenLink)}
            onPointerEnter={() => {setCursorPointer(true);}}
            onPointerOut={() => setCursorPointer(false)}>
            <img src="svg/github.svg" alt="Github Icon" draggable="false"/>
          </a>
          <a href="mailto:hi@bitcente.com" target="_blank"
            className="social"
            onClick={() => playSound(Sound.OpenLink)}
            onPointerEnter={() => {setCursorPointer(true);}}
            onPointerOut={() => setCursorPointer(false)}>
            <img src="svg/mail.svg" alt="Email Icon" draggable="false" />
          </a>
          <a href="tel:+34601407676" target="_blank"
            className="social"
            onClick={() => playSound(Sound.OpenLink)}
            onPointerEnter={() => {setCursorPointer(true);}}
            onPointerOut={() => setCursorPointer(false)}>
            <img src="svg/telef.svg" alt="Phone Icon" draggable="false" />
          </a>
          <div
            className={"social " + (draggingPizza ? 'dragging' : '')}
            onPointerEnter={() => {setCursorPointer(true);}}
            onPointerOut={() => setCursorPointer(false)}>
            <img src="svg/pizza.svg" alt="Pizza Icon" id="pizza"
              onPointerEnter={() => {setCursorPointer(true)}}
              onPointerOut={() => setCursorPointer(false)}
            />
          </div>
        </div>

        <div
          className="logo__wrapper"
          onClick={ () => { goToStart(); setCursorPointer(false) } }
          onPointerEnter={() => screenView === 1 && setCursorPointer(true)}
          onPointerOut={() => setCursorPointer(false)}
        >
          <div className="logo">
            <img className="logo__letter" src="svg/logo/b.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="b" />
            <img className="logo__letter" src="svg/logo/i.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="i" />
            <img className="logo__letter" src="svg/logo/t.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="t" />
            <img className="logo__letter" src="svg/logo/c.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="c" />
            <img className="logo__letter" src="svg/logo/e.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="e" />
            <img className="logo__letter" src="svg/logo/n.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="n" />
            <img className="logo__letter" src="svg/logo/t.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="t" />
            <img className="logo__letter" src="svg/logo/e.svg" draggable="false" onPointerEnter={hoverLetter} onPointerOut={blurLetter} data-letter="e" />
          </div>
          <div className="bottom-desc text-base text-align-center"><div>Creative Front-end<br/> Developer ©{new Date().getFullYear()}</div></div>
        </div>


        <div className="scroll-down title-m" onClick={ goToContent }
          onPointerEnter={() => setCursorPointer(true)}
          onPointerOut={() => setCursorPointer(false)}
        >
          <div className="display-inline-block idleAnimation">↓↓↓</div> SCROLL DOWN <div className="display-inline-block idleAnimation">↓↓↓</div>
        </div>


        <div className={ "content-screen " + ((projectHovered) ? 'project-hovered' : '') }>

          { isMobile && <div className="intro-desc-mobile text-align-center">
            {introDesc()}
          </div> }

          <div className="projects">
            
            <div>
              <h2 className="text-s projects-title"><span><img className="asterisk" src="svg/asterisk.svg" />Projects &#123;</span></h2>
              {projects.map((project, i) => { const { name, url, jobs, awarded, description } = project; return (<>
                <a
                  onPointerEnter={ () => hoverProject(i + 1, jobs, description) }
                  onPointerOut={ () => hoverProject() }
                  onClick={ (e) => clickProject(e, project) }
                  className={ "title-l project__item indent " + ((selectedProjects.includes(i + 1)) ? 'is-hovered' : '') } 
                  href={ url }
                  key={ name + i }
                  target="_blank">
                    { name }{awarded && <Award ishovered={selectedProjects.includes(i + 1) || selectedProjects[0] == 0} />}<span className="semi-colon green-3">;</span>
                  </a>
                  {isMobile && <div className="project__tags-mobile indent" key={i + name}>
                    {jobs.map((job, i) => (<>
                      <Tag
                        text={JobMap[job]}
                        key={i + job}
                      />
                    </>))}
                  </div>}
              </>
              )})}
            </div>

            { !isMobile && <div className="projects__tags indent">
              <Tag
                invertstate={selectedJobs.includes(Job.FrontEnd)}
                onPointerEnter={ () => hoverJob(Job.FrontEnd) }
                onPointerOut={ () => hoverJob() }
                text="Front End"
              />
              <Tag
                invertstate={selectedJobs.includes(Job.FullStack)}
                onPointerEnter={ () => hoverJob(Job.FullStack) }
                onPointerOut={ () => hoverJob() }
                text="Full Stack"
              />
              <Tag
                invertstate={selectedJobs.includes(Job.WebGL)}
                onPointerEnter={ () => hoverJob(Job.WebGL) }
                onPointerOut={ () => hoverJob() }
                text="WebGL"
              />
              <Tag
                invertstate={selectedJobs.includes(Job.Modeler)}
                onPointerEnter={ () => hoverJob(Job.Modeler) }
                onPointerOut={ () => hoverJob() }
                text="3d Modeler"
              />
            </div> }
            {!isMobile && <br />}
            <p className="text-s projects-end">&#125;</p>
          </div>

          <div className="right-info">
            
            <div className="skills">
              <div className="skills__sprites">
                <h2 className="text-s"><img className="asterisk" src="svg/asterisk.svg" />Skills &#123;</h2>
                <div className="skills__list">
                  {skills.map(({ name, img, modalDescription }, i) => (
                    <div
                      key={ name + i }
                      className="skill__wrapper"
                      onClick={ () => clickSkill(modalDescription) }
                      onPointerEnter={() => {setCursorPointer(true);}}
                      onPointerOut={() => setCursorPointer(false)}
                    >
                      <img src={"img/tech_icons/" + img } alt={ name } />
                      <p className="skill__name green-2 text-base">{ name }</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="skills__tags indent">
                <Tag text="Next.js"/>
                <Tag text="Zustand"/>
                <Tag text="HTML/CSS"/>
                <Tag text="Javascript"/>
                <Tag text="GSAP"/>
                <Tag text="API REST"/>
                <Tag text="SWR"/>
                <Tag text="Blender"/>
                <Tag text="Git"/>
                <Tag text="Responsive"/>
                <Tag text="JSON"/>
                <Tag text="PHP"/>
                <Tag text="Wordpress"/>
              </div>
              <p className="text-s">&#125;</p>

            </div>

            <div className="experience-studies">
              <span className="text-s green-2">
                <img className="asterisk" src="svg/asterisk.svg" />
                  IF &#40; <h2 onClick={ () => setExperience(true) } className={ (experience) ? 'is-active' : '' }
                    onPointerEnter={() => {if (!experience) { setCursorPointer(true);}}}
                    onPointerOut={() => setCursorPointer(false)}
                    >
                    Experience
                  </h2> || <h2 onClick={ () => setExperience(false) } className={ (!experience) ? 'is-active' : '' }
                    onPointerEnter={() => { if (experience) { setCursorPointer(true);}}}
                    onPointerOut={() => setCursorPointer(false)}
                    >
                    Studies
                  </h2>  &#41; <span className="green-1">&#123;</span>
              </span>
              {experience && <div className="experience indent">
                  {experienceList.map(({ job, company, companyUrl, start_time, end_time, location }, i) => (
                    <div key={ job + i }>
                      <h3 className='text-m'>{job}</h3>
                      <a className="underline text-base" href={companyUrl} target='_blank'
                        onPointerEnter={() => {setCursorPointer(true);}}
                        onPointerOut={() => setCursorPointer(false)}
                      >{company}</a>
                      <p className="green-2 text-base">{start_time} - {end_time}</p>
                      <p className="green-2 text-s">({location})</p>
                    </div>
                  ))}
              </div> }
              {!experience && <div className="studies indent">
                  {studiesList.map(({ name, location, start_time, end_time }, i) => (
                    <div key={ name + i }>
                      <h3 className='text-m'>{name}</h3>
                      <p className="text-base">{location}</p>
                      <p className="green-2 text-s">{start_time} - {end_time}</p>
                    </div>
                  ))}
              </div> }
              <br />
              <p className="text-s">&#125;</p>
            </div>

          </div>


          


          <a className="download-cv"
            href="resume.pdf"
            download="Vicente_Martinez_Resume.pdf"
            onPointerEnter={() => setCursorPointer(true)}
            onPointerOut={() => setCursorPointer(false)}
          >
            <span className="marquee title-s" ref={ marquee }>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
              Download my CV <span className="green-3">↓↓↓</span>
            </span>
          </a>


        </div>

        <Tooltip text={tooltipText} />
        <div className="grid-effect"></div>
        <div className="gradient-mobile-effect"></div>

        <div className={ "dialogue-box " + ((dialogueBoxOpen) ? 'is-active' : '') }>
            <div className="db__veil" onClick={ closeDialogueBox }></div>
            <div className="db__modal">
              { !isMobile && <img className="db__img" src="img/modal.png" alt="Modal Background Image" draggable="false" /> }
              { isMobile && <img className="db__img" src="img/modal_mobile.png" alt="Modal Background Image" draggable="false" /> }
              <div className="db__content text-base" dangerouslySetInnerHTML={{__html: dialogueBoxContent}}></div>
            </div>
        </div>

        <ProjectViewer project={openedProject} onClose={ () => setOpenedProject(undefined) } />

      </div>

    </>
  )
}

export default HomePage