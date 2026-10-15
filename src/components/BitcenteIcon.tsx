import { useContext, useEffect, useRef, useState } from "react";
import { useBitcenteStore } from "../store";
import TypeWriter from "./TypeWriter";
import PixelStars from "./PixelStars";
import { Sound } from "../classes/SoundBoard";
import { isMobile } from "../utils/Screen";
import { MachineContext, ROOM_ENABLED } from "../arcade/store";

export enum BitcenteIconState {
    IDLE = "bitcente_idle.gif",
    TALKING = "bitcente_talking.gif",
    STOPPED = "bitcente_stopped.gif",
    EXCITED = "bitcente_excited.gif",
    EATING = "bitcente_eating.gif",
}

export type SpeakTextGroup = {
    state: string;
    interactive: boolean;
    texts: SpeakText[];
}

export type SpeakText = {
    text: string;
    delay: number;
    duration: number;
    // shown all at once instead of typed letter by letter
    instant?: boolean;
}

const textsToSpeak: SpeakTextGroup[] = [
    {
        state: "IDLE",
        interactive: false,
        texts: [
            {text: "", delay: 0, duration: 0},
            {text: "PSST...", delay: 10000, duration: 10000},
            {text: "HEY...", delay: 0, duration: 13000},
            {text: "CLICK ME.", delay: 0, duration: 7000},
        ],
    },
    {
        state: "TALKING",
        interactive: true,
        texts: [
            {text: "Hi! I'm Bitcente. Welcome to my portfolio.", delay: 0, duration: 6000},
            {text: "If you want to hire me, my contact info is in the top-right corner.", delay: 0, duration: 10000},
            {text: "You can check out my projects below me too!", delay: 0, duration: 6000},
            {text: "Oh! One more thing...", delay: 0, duration: 5000},
            {text: "Do you see that pizza slice in my contact info?", delay: 0, duration: 7000},
            {text: "Would you mind handing it to me? I'm a bit hungry.", delay: 0, duration: 8000},
        ],
    },
    {
        state: "STOPPED",
        interactive: false,
        texts: [
            {text: "", delay: 0, duration: 6000},
        ],
    },
    {
        state: "EXCITED",
        interactive: false,
        texts: [
            {text: "Please...", delay: 0, duration: 6000},
        ],
    },
    {
        state: "EATING",
        interactive: false,
        texts: [
            {text: "Delicious! Thank you so much <3", delay: 0, duration: 6000},
        ],
    }
]

const textsToSpeakMobile: SpeakTextGroup[] = [
    {
        state: "IDLE",
        interactive: false,
        texts: [
            {text: "", delay: 0, duration: 0},
            {text: "PSST...", delay: 10000, duration: 10000},
            {text: "HEY...", delay: 0, duration: 13000},
            {text: "TAP ME.", delay: 0, duration: 7000},
        ],
    },
    {
        state: "TALKING",
        interactive: true,
        texts: [
            {text: "Hi! I'm Bitcente. Welcome to my portfolio.", delay: 0, duration: 6000},
            {text: "If you want to hire me, my contact info is above me.", delay: 0, duration: 10000},
            {text: "Check out my projects scrolling down too!", delay: 0, duration: 6000},
            {text: "Oh! One more thing...", delay: 0, duration: 5000},
            {text: "Do you see that pizza slice in my contact info?", delay: 0, duration: 7000},
            {text: "Would you mind handing it to me? I'm a bit hungry.", delay: 0, duration: 8000},
        ],
    },
    {
        state: "STOPPED",
        interactive: false,
        texts: [
            {text: "", delay: 0, duration: 6000},
        ],
    },
    {
        state: "EXCITED",
        interactive: false,
        texts: [
            {text: "Please...", delay: 0, duration: 6000},
        ],
    },
    {
        state: "EATING",
        interactive: false,
        texts: [
            {text: "Delicious! Thank you so much <3", delay: 0, duration: 6000},
        ],
    }
]

// pizza from which Bitcente tells his secret every time he eats
const FEEDS_FOR_SECRET = 1
// ms after the eating sound that the secret jingle plays, the first time he tells it
const SECRET_SOUND_DELAY = 150

// outside of the arcade there's no secret, from the second pizza on the thanks is said all at once
const repeatedThanks: SpeakTextGroup = {
    state: "EATING",
    interactive: false,
    texts: [
        {text: "Delicious! Thank you so much <3", delay: 0, duration: 6000, instant: true},
    ],
}

// what he says instead of the thanks from the pizza that makes him tell the secret on
const secretTexts: SpeakTextGroup = {
    state: "EATING",
    interactive: false,
    texts: [
        {text: "I like you! I will let you play in my arcade room. Press ESC!", delay: 0, duration: 12000},
    ],
}

export default function BitcenteIcon({
    started = false,
    draggingPizza = false,
}: {
    started?: boolean;
    draggingPizza?: boolean;
}) {
    const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer);
    const playSound = useBitcenteStore((state) => state.playSound);
    const bitcenteEating = useBitcenteStore((state) => state.bitcenteEating);
    const setBitcenteEating = useBitcenteStore((state) => state.setBitcenteEating);
    const setContinueDialog = useBitcenteStore((state) => state.setContinueDialog);

    const [state, setState] = useState(BitcenteIconState.IDLE);
    const [waitingForInput, setWaitingForInput] = useState(false);
    const [speakingTexts, setSpeakingTexts] = useState<SpeakTextGroup | null>(null);

    // the secret is about the arcade room, so only when he's in one of its machines (and there's a room: not on mobile)
    const inArcade = useContext(MachineContext) >= 0 && ROOM_ENABLED;
    const feeds = useRef(0);
    const secretSound = useRef<number>();

    const textRef = useRef<HTMLDivElement>(null);

    const handleEndOfText = ({ lastText }: { lastText?: boolean }) => {
        if (textRef.current && speakingTexts?.interactive && !lastText) {
            setWaitingForInput(true);
        }
    }
    const handleStartOfText = () => {
        if (textRef.current) {
            setWaitingForInput(false);
        }
    }

    const handleFullClick = () => {
        if (speakingTexts?.interactive) {
            setContinueDialog(true);
        }
    }

    const handleIconClick = () => {
        if (speakingTexts?.interactive) return;
        // Handle click event here
        if (state === BitcenteIconState.IDLE || state === BitcenteIconState.STOPPED) {
            setState(BitcenteIconState.TALKING);
        } else {
            setState(BitcenteIconState.STOPPED);
        }
    }

    useEffect(() => {
        if (!started) return;
        
        const allTexts = isMobile() ? textsToSpeakMobile : textsToSpeak;
        let texts;
        switch (state) {
            case BitcenteIconState.IDLE:
                texts = allTexts.find(group => group.state === "IDLE");
                break;
            case BitcenteIconState.TALKING:
                texts = allTexts.find(group => group.state === "TALKING");
                break;
            case BitcenteIconState.EXCITED:
                texts = allTexts.find(group => group.state === "EXCITED");
                break;
            case BitcenteIconState.STOPPED:
                texts = allTexts.find(group => group.state === "STOPPED");
                break;
            case BitcenteIconState.EATING:
                if (inArcade && feeds.current >= FEEDS_FOR_SECRET) texts = secretTexts;
                else if (feeds.current > 1) texts = repeatedThanks;
                else texts = allTexts.find(group => group.state === "EATING");
                break;
            default:
                break;
        }

        if (texts) {
            setSpeakingTexts(texts);
        }
    }, [state, started]);

    useEffect(() => {
        if (!started) return;
        if (draggingPizza) {
            setState(BitcenteIconState.EXCITED);
        } else if (!bitcenteEating) {
            setState(BitcenteIconState.STOPPED);
        }
    }, [draggingPizza]);

    useEffect(() => {
        if (!started) return;
        if (bitcenteEating) {
            feeds.current++;
            setState(BitcenteIconState.EATING);
            playSound(Sound.Eat);
            setBitcenteEating(false);
            // only once per visit, it isn't remembered after a reload. (Not cleared by this effect: setting
            // bitcenteEating back to false runs it again right away)
            if (inArcade && feeds.current === FEEDS_FOR_SECRET) {
                secretSound.current = window.setTimeout(() => playSound(Sound.Secret), SECRET_SOUND_DELAY);
            }
        }
    }, [started, bitcenteEating]);

    useEffect(() => () => clearTimeout(secretSound.current), []);

    return <>
        <div className="bitcente-icon__wrapper" onClick={handleFullClick}>
            <img
                className={ "bitcente-icon" }
                src={"/gif/" + state}
                onPointerEnter={() => setCursorPointer(true)}
                onPointerOut={() => setCursorPointer(false)}
                onClick={handleIconClick}
            />
            { state === BitcenteIconState.IDLE && <div className="bitcente-icon__blinking-border"></div> }
            {/* he's happy while telling the secret */}
            <PixelStars active={ speakingTexts === secretTexts } />
            <div className={"bitcente-icon__text text-base " + (speakingTexts?.interactive ? "interactive" : "")} ref={textRef}
                onPointerEnter={() => {speakingTexts?.interactive && setCursorPointer(true)}}
                onPointerOut={() => {speakingTexts?.interactive && setCursorPointer(false)}}
            >
                {speakingTexts && <TypeWriter
                    speakTextGroup={speakingTexts}
                    speed={50}
                    endOfTextCallback={handleEndOfText}
                    startOfTextCallback={handleStartOfText}
                    />
                }
                {waitingForInput && <div className="bitcente-icon__arrow-dialog">
                    <img src="/svg/arrow_dialog.svg" />
                </div>}
            </div>
        </div>
    </>
}