import { useEffect, useState } from "react"
import { soundBoard } from "../../classes/SoundBoard"

export interface PreloadList {
  images: string[]
  sounds: string[]
}

const loadImage = (src: string) => new Promise<void>((resolve) => {
  const image = new Image()
  // a missing file doesn't keep the page waiting forever
  image.onload = image.onerror = () => resolve()
  image.src = src
})

const pageLoaded = () => new Promise<void>((resolve) => {
  if (document.readyState === "complete") return resolve()
  window.addEventListener("load", () => resolve(), { once: true })
})

// Downloads what the intro needs before it can be played, and tells how much of it is there (0 to 1).
// Sounds are also decoded, so the first ones aren't late
export function usePreload({ images, sounds }: PreloadList) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    const tasks = [
      pageLoaded(),
      document.fonts.ready.then(() => {}),
      ...images.map(loadImage),
      ...sounds.map((sound) => soundBoard().loadSound(sound).then(() => {}, () => {})),
    ]
    let done = 0
    tasks.forEach((task) => task.then(() => {
      done++
      if (!cancelled) setProgress(done / tasks.length)
    }))
    return () => { cancelled = true }
  }, [])

  return progress
}
