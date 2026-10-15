export enum Sound {
    StartIntro = "startup_intro.wav",
    StartDing = "startup_ding.wav",
    Bitcente = "bitcente.mp3",
    Hover = "hover.mp3",
    OpenLink = "open_link.mp3",
    Eat = "eat.wav",
    Secret = "secret.mp3",

    // TETRIS
    TetrisMove = "tetris/tetris_move_piece.mp3",
    TetrisRotate = "tetris/tetris_rotate_piece.mp3",
    TetrisLand = "tetris/tetris_piece_landed.wav",
    TetrisLine = "tetris/tetris_line_clear.wav",
    TetrisPause = "tetris/tetris_pause.wav",
    TetrisGameOver = "tetris/tetris_game_over.wav",

    // LETTERS
    A = "a.wav",
    B = "b.wav",
    C = "c.wav",
    D = "d.wav",
    E = "e.wav",
    G = "g.wav",
    I = "i.wav",
    J = "j.wav",
    K = "k.wav",
    M = "m.wav",
    N = "n.wav",
    O = "o.wav",
    P = "p.wav",
    Q = "q.wav",
    R = "r.wav",
    S = "s.wav",
    T = "t.wav",
    TO = "t_old.wav",
    U = "u.wav",
    W = "w.wav",
    Z = "z.wav",
}


// input that counts as the user wanting the page to make sound
const UNLOCK_EVENTS = ["touchend", "pointerup", "click", "keydown"];

export class SoundBoardClass {
    audioContext: AudioContext;
    cache: Map<string, AudioBuffer>;
    // every sound goes through here, so the whole board can be muted at once
    output: GainNode;

    constructor() {
        this.audioContext = new AudioContext();
        this.cache = new Map();

        this.output = this.audioContext.createGain();
        this.output.connect(this.audioContext.destination);

        // silent while the tab is in the background
        this.updateMute();
        document.addEventListener("visibilitychange", this.updateMute);

        // iOS: like music, not like a ringtone, so the silent switch doesn't mute the sounds (the music still played)
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback";

        // phones only let the audio start inside a tap: the sounds are played later (after an animation, through the
        // store), so every tap wakes it up in case it's asleep (it's put back to sleep by calls, other apps...)
        UNLOCK_EVENTS.forEach((event) => window.addEventListener(event, this.unlock, true));
    }

    private unlock = () => {
        if (this.audioContext.state === "running") return;
        this.audioContext.resume().catch(() => {});
        // older iOS also wants a sound started right inside the tap, an empty one does
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioContext.createBuffer(1, 1, 22050);
        source.connect(this.audioContext.destination);
        source.start(0);
    }

    muted = false;
    // songs played with <audio> (music), muted along with the rest
    tracked = new Set<HTMLAudioElement>();

    updateMute = () => {
        this.output.gain.value = document.hidden || this.muted ? 0 : 1;
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        this.updateMute();
        this.tracked.forEach((audio) => { audio.muted = muted; });
    }

    // an <audio> that has to follow the mute button
    track(audio: HTMLAudioElement) {
        audio.muted = this.muted;
        this.tracked.add(audio);
        return audio;
    }

    // sounds asked for again while they're still loading wait for that same load
    loading = new Map<string, Promise<AudioBuffer>>();

    async loadSound(name: string) {
        if (this.cache.has(name)) return this.cache.get(name)!;
        if (this.loading.has(name)) return this.loading.get(name)!;

        const load = fetch("/audio/" + name)
            .then((res) => res.arrayBuffer())
            .then((arrayBuffer) => this.audioContext.decodeAudioData(arrayBuffer))
            .then((audioBuffer) => {
                this.cache.set(name, audioBuffer);
                return audioBuffer;
            })
            .finally(() => this.loading.delete(name));
        this.loading.set(name, load);
        return load;
    }

    // volume from 0 to 1, rate speeds the sound up (and pitches it up) from 1
    async play(name: string, volume = 1, rate = 1) {
        if (!name || document.hidden) return;
        // browsers keep the audio asleep until the page has been interacted with
        if (this.audioContext.state === "suspended") this.audioContext.resume().catch(() => {});

        // load from cache (or fetch + decode)
        const buffer = await this.loadSound(name);

        // create a new source node (required for overlapping sounds)
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        if (volume === 1) {
            source.connect(this.output);
        } else {
            const gain = this.audioContext.createGain();
            gain.gain.value = volume;
            source.connect(gain).connect(this.output);
        }
        source.start(0);
    }
}

// The one sound board of the page. Games call it directly: many sounds in a row (a piece sliding) would be lost
// going through the store, which only keeps the last one
let instance: SoundBoardClass | undefined;
export const soundBoard = () => instance ??= new SoundBoardClass();
