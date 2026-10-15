import { useEffect } from "react";
import { useBitcenteStore } from "../store";

// pixel speaker, with waves when the sound is on and a cross when it's off (8x8 grid)
const SPEAKER = "M1 3h2v2H1zM3 2h1v4H3zM4 1h1v6H4z";
const WAVES = "M6 2h1v1H6zM6 5h1v1H6zM7 3h1v2H7z";
const CROSS = "M5 3h1v1H5zM7 3h1v1H7zM6 4h1v1H6zM5 5h1v1H5zM7 5h1v1H7z";

/** The speaker icon, filled with the text colour. `padded` leaves room around it like the social icons. */
export function SpeakerIcon({ muted, padded = false }: { muted: boolean; padded?: boolean }) {
    return (
        <svg viewBox={ padded ? "-2.5 -2.5 13 13" : "0 0 8 8" } shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
            <path d={ SPEAKER + (muted ? CROSS : WAVES) } />
        </svg>
    );
}

/** What a mute button of any page needs: the state, and the props of the button. */
export function useMuteButton() {
    const muted = useBitcenteStore((state) => state.muted);
    const toggleMuted = useBitcenteStore((state) => state.toggleMuted);
    const setCursorPointer = useBitcenteStore((state) => state.setCursorPointer);

    return {
        muted,
        props: {
            onClick: (e: React.MouseEvent<HTMLElement>) => {
                // never keeps the focus: space or enter for the games would press it again
                e.currentTarget.blur();
                e.stopPropagation();
                toggleMuted();
            },
            onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
            onPointerEnter: () => setCursorPointer(true),
            onPointerLeave: () => setCursorPointer(false),
            "aria-label": muted ? "Turn sound on (M)" : "Mute (M)",
            "aria-pressed": muted,
            title: muted ? "Sound off · M" : "Sound on · M",
        },
    };
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

/** Mute button on its own in the top left corner, for the pages shown outside of the arcade (/old). */
export default function MuteButton() {
    const { muted, props } = useMuteButton();
    return (
        <button className="mute-button" { ...props }>
            <SpeakerIcon muted={ muted } />
        </button>
    );
}
