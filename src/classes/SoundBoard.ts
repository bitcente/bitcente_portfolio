export enum Sound {
    StartIntro = "startup_intro.wav",
    StartDing = "startup_ding.wav",
    Bitcente = "bitcente.mp3",
    Hover = "hover.mp3",
    OpenLink = "open_link.mp3",
    Eat = "eat.wav",
    Secret = "secret.mp3",

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
    }

    updateMute = () => {
        this.output.gain.value = document.hidden ? 0 : 1;
    }

    async loadSound(name: string) {
        if (this.cache.has(name)) return this.cache.get(name)!;

        const res = await fetch("/audio/" + name);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        this.cache.set(name, audioBuffer);
        return audioBuffer;
    }

    async play(name: string) {
        if (!name || document.hidden) return;

        // load from cache (or fetch + decode)
        const buffer = await this.loadSound(name);

        // create a new source node (required for overlapping sounds)
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.output);
        source.start(0);
    }
}