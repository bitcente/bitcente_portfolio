import { useEffect, useMemo } from "react";
import { useBitcenteStore } from "../store";
import { Sound, soundBoard } from "../classes/SoundBoard";
import { isMobile } from "../utils/Screen";

export default function SoundBoard() {
    const soundPlayed = useBitcenteStore((state) => state.soundPlayed);
    const playSound = useBitcenteStore((state) => state.playSound);

    const SoundBoardElement = useMemo(() => soundBoard(), [])
    const muted = useBitcenteStore((state) => state.muted);
    const volume = useBitcenteStore((state) => state.volume);

    useEffect(() => {
        SoundBoardElement.setMuted(muted);
    }, [muted])

    useEffect(() => {
        SoundBoardElement.setVolume(volume);
    }, [volume])

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