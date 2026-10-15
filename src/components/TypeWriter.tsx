import { useState, useEffect, useRef } from "react";
import { SpeakTextGroup } from "./BitcenteIcon";
import { useBitcenteStore } from "../store";
import { Sound, soundBoard } from "../classes/SoundBoard";

const soundMap: { [key: string]: Sound | undefined } = {
	"a": Sound.A,
	"b": Sound.B,
	"d": Sound.D,
	"e": Sound.E,
	"g": Sound.G,
	"i": Sound.I,
	"j": Sound.J,
	"k": Sound.K,
	"m": Sound.M,
	"n": Sound.N,
	"o": Sound.O,
	"p": Sound.P,
	"q": Sound.Q,
	"r": Sound.R,
	"te": Sound.T,
	"to": Sound.TO,
	"u": Sound.U,
	"w": Sound.W,
	"y": Sound.I,
	"z": Sound.Z,
};

// a click while a line is still being typed speeds it up instead of skipping it: the letters come this many
// times faster, and their sounds play higher and quicker (one every few letters, or it's just noise)
const FAST = 3;
const FAST_SOUND_RATE = 1.5;
const FAST_SOUND_EVERY = 2;

// false when the element or anything around it is hidden (display: none, visibility: hidden or opacity: 0),
// like Bitcente on mobile once the carousel is shown
function isShown(element: HTMLElement | null) {
	if (!element) return false;
	// older browsers don't have checkVisibility
	if (typeof element.checkVisibility === "function") {
		return element.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true } as CheckVisibilityOptions);
	}
	for (let node: HTMLElement | null = element; node; node = node.parentElement) {
		const style = getComputedStyle(node);
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
	}
	return true;
}

export default function Typewriter({
  speakTextGroup,
  speed = 100,
	endOfTextCallback,
	startOfTextCallback
}: {
  speakTextGroup: SpeakTextGroup;
  speed?: number;
	endOfTextCallback?: ({ lastText }: { lastText?: boolean }) => void;
	startOfTextCallback?: () => void;
}) {
	const playSound = useBitcenteStore((state) => state.playSound);
	const continueDialog = useBitcenteStore((state) => state.continueDialog);
	const setContinueDialog = useBitcenteStore((state) => state.setContinueDialog);

  const [isInteractive, setIsInteractive] = useState(false);
  const [displayed, setDisplayed] = useState("");
  const currentTextIndex = useRef(0); // persistent index
  const indexRef = useRef(0); // persistent index
	// 1, or FAST once the player hurried this line
	const fastRef = useRef(1);
	const textRef = useRef<HTMLSpanElement>(null);
	let allTimeoutRefs = useRef<number[]>([]);

	const type = (text: string, instant = false) => {
		if (!text) return;
		if (instant) {
			setDisplayed(text);
			indexRef.current = text.length;
			endOfTextCallback && endOfTextCallback({ lastText: currentTextIndex.current == speakTextGroup.texts.length - 1 });
			return;
		}
		const i = indexRef.current;
		
		if (i < text.length) {
			setDisplayed((prev) => prev + text[i]);
			// map the caracter with an array of characters associated with a sound
			
			let letter = text[i].toLocaleLowerCase();
			if (letter === "t") {
				const randomChoice = Math.random() < 0.5 ? "e" : "o";
				letter += randomChoice;
			}
			const sound = soundMap[letter];
			// keeps typing while hidden, but quietly
			const fast = fastRef.current > 1;
			if (sound && isShown(textRef.current) && (!fast || i % FAST_SOUND_EVERY === 0)) {
				// hurried: straight to the sound board, which can play them faster (the store only says which one)
				if (fast) soundBoard().play(sound, 1, FAST_SOUND_RATE);
				else playSound(sound);
			}
			indexRef.current++;
			allTimeoutRefs.current.push(setTimeout(() => type(text), speed / fastRef.current));
		} else {
			endOfTextCallback && endOfTextCallback({ lastText: currentTextIndex.current == speakTextGroup.texts.length - 1 });
		}
	};


  useEffect(() => {
    if (!speakTextGroup) return;

		fastRef.current = 1;
		if (speakTextGroup.interactive) {
			setDisplayed("");
			indexRef.current = 0;
			currentTextIndex.current = 0;
			type(speakTextGroup.texts[0].text);
			setIsInteractive(true);
		} else {
			let summedDelay = 0;
			speakTextGroup.texts.forEach((speakText) => {
				summedDelay += speakText.delay;
				allTimeoutRefs.current.push(setTimeout(() => {
					setDisplayed("");
					indexRef.current = 0;
					type(speakText.text, speakText.instant);
				}, summedDelay));
				summedDelay += speakText.duration;
			});
			setIsInteractive(false);
		}
		startOfTextCallback && startOfTextCallback();

		return () => {
			allTimeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
		};

  }, [speakTextGroup, speed]);

	useEffect(() => {
		if (!isInteractive) return;
		if (!continueDialog) return;

		// still typing this line: it goes faster, the next one waits for another click
		const currentText = speakTextGroup.texts[currentTextIndex.current]?.text ?? "";
		if (indexRef.current < currentText.length) {
			fastRef.current = FAST;
			setContinueDialog(false);
			return;
		}

		const nextText = speakTextGroup.texts[currentTextIndex.current + 1]?.text;
		if (nextText) {
			allTimeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
			currentTextIndex.current++;
			setDisplayed("");
			indexRef.current = 0;
			fastRef.current = 1;
			type(nextText);
			startOfTextCallback && startOfTextCallback();
		}
		setContinueDialog(false);
	}, [continueDialog]);

  return <span ref={textRef}>{displayed}</span>;
}
