import { gsap } from "gsap"
import { comboMultiplier } from "./tetris"

// seconds the bonus takes to count through each line made, to go up, and to fall away
const COUNT_STEP = .1
const RISE_TIME = .45
const FALL_TIME = .75
// px it goes up and then falls
const RISE = 70
const FALL = 140

// The bonus of the lines just made pops out of the middle of the board, counting up through every line (from the
// combo before them to the combo now), goes up and falls while it fades away
export function popBonus(board: HTMLElement, fromCombo: number, toCombo: number) {
  const popup = document.createElement("div")
  popup.className = "tetris__popup title-m"
  popup.setAttribute("aria-hidden", "true")
  board.appendChild(popup)

  const timeline = gsap.timeline({ onComplete: () => popup.remove() })
  timeline.set(popup, { xPercent: -50, yPercent: -50, y: 0, autoAlpha: 1 })
  for (let combo = fromCombo + 1; combo <= toCombo; combo++) {
    timeline
      .call(() => { popup.textContent = "x" + comboMultiplier(combo) })
      .fromTo(popup, { scale: 1.9 }, { scale: 1, duration: COUNT_STEP, ease: "steps(2)" })
  }
  // up while it counts, then down and away
  timeline
    .to(popup, { y: -RISE, duration: RISE_TIME, ease: "power2.out" }, 0)
    .to(popup, { y: FALL, autoAlpha: 0, duration: FALL_TIME, ease: "power2.in" }, Math.max(RISE_TIME, timeline.duration()))
}

// px the board moves at x1, and how much more for each step of bonus
const SHAKE_BASE = 2
const SHAKE_PER_BONUS = 4
const SHAKE_MAX = 16
const SHAKE_STEPS = 6

// The board shakes when lines are made, harder the bigger the bonus
export function shake(board: HTMLElement, combo: number) {
  const amount = Math.min(SHAKE_MAX, SHAKE_BASE + SHAKE_PER_BONUS * (comboMultiplier(combo) - 1))
  const keyframes = Array.from({ length: SHAKE_STEPS }, (_, step) => {
    // weaker towards the end
    const strength = amount * (1 - step / SHAKE_STEPS)
    return { x: (Math.random() * 2 - 1) * strength, y: (Math.random() * 2 - 1) * strength, duration: .04 }
  })
  gsap.killTweensOf(board, "x,y")
  gsap.to(board, { keyframes: [...keyframes, { x: 0, y: 0, duration: .04 }], ease: "none" })
}
