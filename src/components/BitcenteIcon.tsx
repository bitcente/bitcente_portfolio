import { useEffect, useRef, useState } from "react";
import { useBitcenteStore } from "../store";
import TypeWriter from "./TypeWriter";
import { Sound } from "../classes/SoundBoard";
import { isMobile } from "../utils/Screen";

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
                texts = allTexts.find(group => group.state === "EATING");
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
            setState(BitcenteIconState.EATING);
            playSound(Sound.Eat);
            setBitcenteEating(false);
        }
    }, [started, bitcenteEating]);

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