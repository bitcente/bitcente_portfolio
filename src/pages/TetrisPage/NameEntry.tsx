import { useEffect } from "react"
import { useBitcenteStore } from "../../store"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
export const NAME_LENGTH = 3

// letters as indexes in the alphabet
export type Letters = number[]

export const lettersToName = (letters: Letters) => letters.map((letter) => ALPHABET[letter]).join("")

// The 3 letters of the name, arcade style: each one is chosen going up and down the alphabet.
// Returns the new letters and cursor, or null when the key isn't for the name
export function nameKey(key: string, letters: Letters, cursor: number): [Letters, number] | null {
  const next = [...letters]
  const wrap = (letter: number) => (letter + ALPHABET.length) % ALPHABET.length

  if (key === "ArrowUp") next[cursor] = wrap(next[cursor] + 1)
  else if (key === "ArrowDown") next[cursor] = wrap(next[cursor] - 1)
  else if (key === "ArrowLeft") return [next, Math.max(0, cursor - 1)]
  else if (key === "ArrowRight") return [next, Math.min(NAME_LENGTH - 1, cursor + 1)]
  else if (key === "Backspace") return [next, Math.max(0, cursor - 1)]
  // typing the letter is quicker
  else if (key.length === 1 && ALPHABET.includes(key.toUpperCase())) {
    next[cursor] = ALPHABET.indexOf(key.toUpperCase())
    return [next, Math.min(NAME_LENGTH - 1, cursor + 1)]
  } else return null
  return [next, cursor]
}

interface NameEntryProps {
  letters: Letters
  cursor: number
  touch: boolean
  onChange: (letters: Letters, cursor: number) => void
  onSubmit: () => void
}

export default function NameEntry({ letters, cursor, touch, onChange, onSubmit }: NameEntryProps) {
  // while it's shown, M is a letter and not the mute key
  const claimTyping = useBitcenteStore((state) => state.claimTyping)
  useEffect(() => {
    claimTyping(1)
    return () => claimTyping(-1)
  }, [])

  const step = (index: number, key: "ArrowUp" | "ArrowDown") => {
    const [next] = nameKey(key, letters, index)!
    onChange(next, index)
  }

  return (
    <div className="name-entry">
      <div className="name-entry__letters">
        {letters.map((letter, index) => (
          <div className="name-entry__slot" key={ index }>
            { touch && <button className="name-entry__step" aria-label="Next letter" onClick={ () => step(index, "ArrowUp") }>▲</button> }
            <button
              className={ "name-entry__letter title-m" + (index === cursor ? " is-current" : "") }
              aria-label={ `Letter ${ index + 1 }` }
              onClick={ () => onChange(letters, index) }
            >
              { ALPHABET[letter] }
            </button>
            { touch && <button className="name-entry__step" aria-label="Previous letter" onClick={ () => step(index, "ArrowDown") }>▼</button> }
          </div>
        ))}
      </div>
      { touch
        ? <button className="name-entry__ok text-m" onClick={ onSubmit }>OK</button>
        : <span className="text-s green-2">↑↓ letter · ←→ move · Enter save</span> }
    </div>
  )
}
