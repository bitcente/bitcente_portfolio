import { useEffect, useMemo } from "react";
import { useBitcenteStore } from "../store";
import { Sound, SoundBoardClass } from "../classes/SoundBoard";
import { isMobile } from "../utils/Screen";

export default function SoundBoard() {
    const soundPlayed = useBitcenteStore((state) => state.soundPlayed);
    const playSound = useBitcenteStore((state) => state.playSound);

    const SoundBoardElement = useMemo(() => {
        return new SoundBoardClass();
    }, [])

    useEffect(() => {
        if (!soundPlayed) return;
        if (soundPlayed === Sound.Hover && isMobile()) {
            playSound(null);
            return;
        }
        SoundBoardElement.play(soundPlayed);
        playSound(null);
    }, [soundPlayed])

    return <></>;
}