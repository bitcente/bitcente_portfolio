import { useEffect, useRef, useState } from "react";
import { useBitcenteStore } from "../store";
import "./volume.css";

// pixel speaker, with waves when the sound is on and a cross when it's off (8x8 grid)
const SPEAKER = "M1 3h2v2H1zM3 2h1v4H3zM4 1h1v6H4z";
const WAVES = "M6 2h1v1H6zM6 5h1v1H6zM7 3h1v2H7z";
const CROSS = "M5 3h1v1H5zM7 3h1v1H7zM6 4h1v1H6zM5 5h1v1H5zM7 5h1v1H7z";

// how much the arrow keys move the volume
const KEY_STEP = .1;

/** The speaker icon, filled with the text colour. `padded` leaves room around it like the social icons. */
export function SpeakerIcon({ muted, padded = false }: { muted: boolean; padded?: boolean }) {
    return (
        <svg viewBox={ padded ? "-2.5 -2.5 13 13" : "0 0 8 8" } shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
            <path d={ SPEAKER + (muted ? CROSS : WAVES) } />
        </svg>
    );
}

/** No sound at all: muted (M), or the volume all the way down. */
export function useSilent() {
    return useBitcenteStore((state) => state.muted || state.volume === 0);
}

interface VolumeControlProps {
    /** Look of the page it's in: `volume--<variant>` (see volume.css and the css of each page). */
    variant: string;
    /** Extra classes of the button, to fit among the other buttons of the page. */
    buttonClassName?: string;
    /** Icon with room around it, like the social icons. */
    padded?: boolean;
    /** "Sound 80%" / "Sound off" next to the icon. */
    label?: boolean;
}

/**
 * The sound button of every page: it opens a bar to drag the volume of the whole web (and the M key still mutes).
 * The bar closes clicking anywhere else. It never keeps the focus from a click, so the games keep their keys.
 */
export function VolumeControl({ variant, buttonClassName = "", padded = false, label = false }: VolumeControlProps) {
    const volume = useBitcenteStore((state) => state.volume);
    const muted = useBitcenteStore((state) => state.muted);
    const setVolume = useBitcenteStore((state) => state.setVolume);
    const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer);
    const silent = useSilent();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const percent = Math.round(volume * 100);

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [open]);

    const setFrom = (e: React.PointerEvent<HTMLDivElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        setVolume(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)));
    };

    return (
        <div className={ `volume volume--${ variant }` + (open ? " is-open" : "") + (muted ? " is-muted" : "") } ref={ rootRef }>
            <button
                className={ "volume__button " + buttonClassName }
                aria-label={ `Volume ${ silent ? "off" : percent + "%" }` }
                aria-expanded={ open }
                title={ silent ? "Sound off · M" : `Sound ${ percent }% · M mutes` }
                // never keeps the focus: space or enter for the games would press it again
                onPointerDown={ (e) => e.preventDefault() }
                onClick={ (e) => {
                    e.currentTarget.blur();
                    e.stopPropagation();
                    setOpen(!open);
                } }
                onPointerEnter={ () => setCursorPointer(true) }
                onPointerLeave={ () => setCursorPointer(false) }
            >
                <SpeakerIcon muted={ silent } padded={ padded } />
                { label && <span className="volume__label">{ silent ? "Sound off" : `Sound ${ percent }%` }</span> }
            </button>

            { open && <div className="volume__panel" onClick={ (e) => e.stopPropagation() }>
                <div
                    className="volume__track"
                    role="slider"
                    tabIndex={ 0 }
                    aria-label="Volume"
                    aria-valuemin={ 0 }
                    aria-valuemax={ 100 }
                    aria-valuenow={ muted ? 0 : percent }
                    style={ { "--volume": volume } as React.CSSProperties }
                    onPointerDown={ (e) => {
                        // the games listen for pointers too (swipes), and a click must not take the keyboard
                        e.preventDefault();
                        e.stopPropagation();
                        dragging.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setFrom(e);
                    } }
                    // the movement goes on up: the custom cursor follows it (a swipe of the games can't start here,
                    // the press that would start it is stopped above)
                    onPointerMove={ (e) => {
                        if (dragging.current) setFrom(e);
                    } }
                    onPointerUp={ () => { dragging.current = false; } }
                    onPointerCancel={ () => { dragging.current = false; } }
                    onPointerEnter={ () => setCursorPointer(true) }
                    onPointerLeave={ () => setCursorPointer(false) }
                    onKeyDown={ (e) => {
                        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? KEY_STEP
                            : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -KEY_STEP : 0;
                        if (e.key === "Home" || e.key === "End") setVolume(e.key === "End" ? 1 : 0);
                        else if (step) setVolume(Math.min(1, Math.max(0, Math.round((volume + step) * 10) / 10)));
                        else return;
                        // the arrows are only for the bar while it has the focus, not for the game behind
                        e.preventDefault();
                        e.stopPropagation();
                    } }
                >
                    <div className="volume__fill" />
                    <div className="volume__thumb" />
                </div>
            </div> }
        </div>
    );
}

/** The M key mutes and unmutes the whole web, wherever the player is. Used once, by the app. */
export function useMuteKey() {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== "m" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            // a name being written takes the letter
            if (useBitcenteStore.getState().typingClaims > 0) return;
            const target = e.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable]")) return;
            useBitcenteStore.getState().toggleMuted();
        };
        // capture: it works in the arcade room too, where the pages don't get the keyboard
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, []);
}

/** Sound button on its own in the top left corner, for the pages shown outside of the arcade (/old). */
export default function MuteButton() {
    return <VolumeControl variant="old" buttonClassName="mute-button" />;
}
