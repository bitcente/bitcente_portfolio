import { soundBoard } from "../../classes/SoundBoard"
import type { Ambient, GameSound } from "./pacman"

// The sounds of the arcade, made right here with the web audio of the sound board (so they follow its mute):
// short sweeps of simple waves like the sound chip of the machine. No file to download

const VOLUME = .22

const frequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

// notes as [midi, start, length] in sixteenths
type Notes = [number, number, number][]

// the jingle before the first level: the tune once in B, once in C, once in B and a run up
const PHRASE: [number, number, number][] = [[0, 0, 1], [12, 1, 1], [7, 2, 1], [4, 3, 1], [12, 4, .5], [7, 4.5, 1.5], [4, 6, 2]]
const INTRO_MELODY: Notes = [
  ...PHRASE.map(([note, start, length]): [number, number, number] => [71 + note, start, length]),
  ...PHRASE.map(([note, start, length]): [number, number, number] => [72 + note, start + 8, length]),
  ...PHRASE.map(([note, start, length]): [number, number, number] => [71 + note, start + 16, length]),
  [75, 24, .67], [76, 24.67, .67], [77, 25.33, .67],
  [77, 26, .67], [78, 26.67, .67], [79, 27.33, .67],
  [79, 28, .67], [80, 28.67, .67], [81, 29.33, .67],
  [83, 30, 2],
]
const INTRO_BASS: Notes = [
  [35, 0, 1.5], [47, 2, 1.5], [35, 4, 1.5], [47, 6, 1.5],
  [36, 8, 1.5], [48, 10, 1.5], [36, 12, 1.5], [48, 14, 1.5],
  [35, 16, 1.5], [47, 18, 1.5], [35, 20, 1.5], [47, 22, 1.5],
  [42, 24, 1.5], [44, 26, 1.5], [46, 28, 1.5], [47, 30, 2],
]
const INTRO_STEP = .13

// a little tune for the cutscenes
const BREAK_MELODY: Notes = [
  [77, 0, 1], [77, 1, 1], [79, 2, 1], [81, 3, 2], [77, 5, 1], [81, 6, 2],
  [79, 8, 1], [79, 9, 1], [81, 10, 1], [82, 11, 2], [79, 13, 1], [82, 14, 2],
  [81, 16, 1], [81, 17, 1], [82, 18, 1], [84, 19, 2], [81, 21, 1], [84, 22, 2],
  [86, 24, 2], [84, 26, 2], [82, 28, 2], [81, 30, 2],
  [77, 32, 1], [77, 33, 1], [79, 34, 1], [81, 35, 2], [77, 37, 1], [81, 38, 2],
  [79, 40, 1], [76, 41, 1], [77, 42, 2], [72, 44, 2], [77, 46, 2],
]
const BREAK_BASS: Notes = Array.from({ length: 24 }, (_, i): [number, number, number] => [
  [41, 48, 43, 48, 45, 48, 46, 48][i % 8], i * 2, 1.5,
])
const BREAK_STEP = .12

export default class PacmanSound {
  private output: GainNode | null = null
  private ambient: { kind: Ambient, oscillator: OscillatorNode, gain: GainNode } | null = null
  // eating sound goes "wa" and "ka", one each dot
  private waka = false
  // scheduled music, stopped when the game is
  private music: OscillatorNode[] = []

  private get ctx() {
    return soundBoard().audioContext
  }

  private get out() {
    if (!this.output) {
      this.output = this.ctx.createGain()
      this.output.gain.value = VOLUME
      this.output.connect(soundBoard().output)
    }
    return this.output
  }

  // a wave that goes through the frequencies, at the times (seconds from now) given
  private sweep(type: OscillatorType, points: [number, number][], volume = 1, start = 0) {
    const ctx = this.ctx
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const now = ctx.currentTime + start
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(points[0][1], now + points[0][0])
    points.slice(1).forEach(([time, value]) => oscillator.frequency.linearRampToValueAtTime(value, now + time))
    const end = points[points.length - 1][0]
    gain.gain.setValueAtTime(volume, now)
    gain.gain.setValueAtTime(volume, now + end - .01)
    gain.gain.linearRampToValueAtTime(0, now + end)
    oscillator.connect(gain).connect(this.out)
    oscillator.start(now)
    oscillator.stop(now + end + .02)
    return oscillator
  }

  private notes(notes: Notes, step: number, type: OscillatorType, volume: number) {
    notes.forEach(([midi, start, length]) => {
      const f = frequency(midi)
      const oscillator = this.sweep(type, [[0, f], [length * step * .9, f]], volume, start * step)
      this.music.push(oscillator)
      oscillator.onended = () => { this.music = this.music.filter((item) => item !== oscillator) }
    })
  }

  play(sound: GameSound) {
    switch (sound) {
      case "intro":
        this.notes(INTRO_MELODY, INTRO_STEP, "square", .35)
        this.notes(INTRO_BASS, INTRO_STEP, "triangle", .9)
        break
      case "intermission":
        this.notes(BREAK_MELODY, BREAK_STEP, "square", .3)
        this.notes(BREAK_BASS, BREAK_STEP, "triangle", .9)
        break
      case "waka":
        this.waka = !this.waka
        this.sweep("triangle", this.waka ? [[0, 530], [.1, 240]] : [[0, 240], [.1, 530]], .9)
        break
      case "ghost":
        this.sweep("square", [[0, 140], [.5, 1100]], .35)
        break
      case "fruit":
        this.sweep("triangle", [[0, 300], [.18, 900], [.36, 300]], .9)
        break
      case "extraLife":
        for (let i = 0; i < 6; i++) this.sweep("square", [[0, 1050], [.08, 1050]], .25, i * .14)
        break
      case "death": {
        // goes down warbling, then two pops
        for (let i = 0; i < 10; i++) {
          const high = 900 - i * 65
          this.sweep("triangle", [[0, high], [.07, high - 260], [.13, high]], .9, i * .13)
        }
        [1.36, 1.56].forEach((start) => this.sweep("triangle", [[0, 160], [.12, 950]], .9, start))
        break
      }
    }
  }

  // the sound that goes on all the time: the siren (faster and higher with less dots left), the blue ghosts,
  // or eyes going back home. Called every frame
  update(kind: Ambient, stage: number) {
    if (this.ambient?.kind !== kind) {
      this.stopAmbient()
      if (kind === "none") return
      const ctx = this.ctx
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = kind === "siren" ? "sine" : "triangle"
      gain.gain.value = kind === "siren" ? .45 : .5
      oscillator.connect(gain).connect(this.out)
      oscillator.start()
      this.ambient = { kind, oscillator, gain }
    }
    if (!this.ambient) return

    const time = this.ctx.currentTime
    let value: number
    if (kind === "siren") {
      // up and down, higher and faster with every stage
      const period = .42 - stage * .05
      const phase = (time % period) / period
      const low = 360 + stage * 70
      value = low + (1 - Math.abs(phase * 2 - 1)) * (260 + stage * 40)
    } else if (kind === "fright") {
      const phase = (time % .14) / .14
      value = 240 + phase * 520
    } else {
      const phase = (time % .09) / .09
      value = 1500 - phase * 900
    }
    this.ambient.oscillator.frequency.setTargetAtTime(value, time, .004)
  }

  private stopAmbient() {
    if (!this.ambient) return
    const { oscillator, gain } = this.ambient
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, .01)
    oscillator.stop(this.ctx.currentTime + .05)
    this.ambient = null
  }

  // everything off: the game is paused, over or left
  stop() {
    this.stopAmbient()
    this.music.forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // already over
      }
    })
    this.music = []
  }
}
