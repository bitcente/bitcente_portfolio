import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useArcadeStore, usePlaying } from "../../../arcade/store";
import { soundBoard } from "../../../classes/SoundBoard";

/** A song from public/audio/pokemon, looped unless `once`. */
export interface Music {
  file: string;
  once?: boolean;
}

/**
 * Music of each map (by map id). Maps that share a song keep it playing when the player walks from one to the
 * other.
 */
const MAP_TRACKS: Record<string, string> = {
  sprout_town: "music_pallet_town.mp3",
  route_1: "music_route.mp3",
  pebble_town: "music_viridian_and_pewter_city.mp3",
  pine_forest: "music_viridian_forest.mp3",
  iron_city: "music_viridian_and_pewter_city.mp3",
  iron_gym: "music_gym.mp3",
  pebble_center: "music_pokemon_center.mp3",
  iron_center: "music_pokemon_center.mp3",
};

export const mapMusic = (mapId: string): Music | undefined =>
  MAP_TRACKS[mapId] ? { file: MAP_TRACKS[mapId] } : undefined;

const VOLUME = 0.4;
// while the camera is out in the arcade room, the game is just one of the machines there
const ROOM_VOLUME = 0.1;
// seconds to fade between songs, and in and out
const FADE = 0.8;

const fadeOut = (audio: HTMLAudioElement, rewind: boolean) => {
  gsap.to(audio, {
    volume: 0,
    duration: FADE,
    ease: "none",
    overwrite: true,
    onComplete: () => {
      audio.pause();
      if (rewind) audio.currentTime = 0;
    },
  });
};

/**
 * Plays `music`, fading from one song to the next. Quieter while the camera is out in the arcade room, and
 * silent while another arcade machine is being played or the tab is hidden (then it goes on from where it was).
 * `onEnded` is called when a song that plays `once` is over.
 */
export function useGameMusic(music: Music | undefined, onEnded: () => void) {
  const playing = usePlaying();
  const settled = useArcadeStore((state) => state.settled);
  const view = useArcadeStore((state) => state.view);
  const [hidden, setHidden] = useState(document.hidden);

  const audios = useRef(new Map<string, HTMLAudioElement>());
  const current = useRef<{ music: Music; audio: HTMLAudioElement } | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  // heard while this is the machine being played, or from the room; inside any other machine, not at all
  const audible = !hidden && (playing || view === "room");
  const volume = settled ? VOLUME : ROOM_VOLUME;
  const file = music?.file;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    // each song is only downloaded the first time it's needed
    const audioFor = (name: string) => {
      let audio = audios.current.get(name);
      if (!audio) {
        audio = soundBoard().track(new Audio("/audio/pokemon/" + name));
        audio.volume = 0;
        audio.addEventListener("ended", () => {
          if (current.current?.audio === audio) endedRef.current();
        });
        audios.current.set(name, audio);
      }
      return audio;
    };

    const next = music && audible ? { music, audio: audioFor(music.file) } : null;
    const previous = current.current;
    // a song interrupted by another one starts over next time, unless what interrupts it is a short jingle (it
    // picks up where it was after it) or it's just silenced for a while
    if (previous && previous.audio !== next?.audio) {
      fadeOut(previous.audio, !!music && previous.music.file !== music.file && !music.once);
    }

    if (next) {
      next.audio.loop = !next.music.once;
      if (next.audio.paused) {
        // a jingle always plays from its beginning
        if (next.music.once && previous?.audio !== next.audio) next.audio.currentTime = 0;
        next.audio.volume = 0;
        next.audio.play().catch(() => {});
      }
      gsap.to(next.audio, { volume, duration: next.music.once ? 0.1 : FADE, ease: "none", overwrite: true });
    }
    current.current = next;
  }, [file, audible, volume]);

  useEffect(() => () => {
    audios.current.forEach((audio) => {
      gsap.killTweensOf(audio);
      audio.pause();
    });
  }, []);
}
