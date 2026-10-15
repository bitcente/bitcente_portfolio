import { RefObject, useEffect, useRef } from "react";

// px of the generated noise tile
const NOISE_SIZE = 128;

// Elements seen clean, without the effect over them (see useCrtExclusion), and the effect layers that cut holes for them
const exclusions = new Set<HTMLElement>();
const layers = new Set<HTMLElement>();
let frame = 0;

const FILL = "linear-gradient(#000, #000)";

// one mask layer per hole plus the whole screen below, xor'ed together (holes don't overlap)
function updateHoles(layer: HTMLElement) {
    const bounds = layer.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    // the screens of the arcade are scaled, the mask goes in the layer's own px
    const scale = layer.offsetWidth / bounds.width;
    // only the ones in the same page as this overlay
    const page = layer.parentElement?.parentElement;

    const sizes: string[] = [];
    const positions: string[] = [];
    exclusions.forEach((element) => {
        if (!page?.contains(element) || getComputedStyle(element).visibility === "hidden") return;
        const rect = element.getBoundingClientRect();
        if (rect.bottom < bounds.top || rect.top > bounds.bottom || rect.right < bounds.left || rect.left > bounds.right) return;
        sizes.push(`${Math.round(rect.width * scale)}px ${Math.round(rect.height * scale)}px`);
        positions.push(`${Math.round((rect.left - bounds.left) * scale)}px ${Math.round((rect.top - bounds.top) * scale)}px`);
    });

    const image = sizes.length ? [...sizes.map(() => FILL), FILL].join(", ") : "";
    const size = sizes.length ? [...sizes, "100% 100%"].join(", ") : "";
    const position = sizes.length ? [...positions, "0 0"].join(", ") : "";
    // nothing moved, nothing to restyle
    if (layer.dataset.holes === image + size + position) return;
    layer.dataset.holes = image + size + position;
    layer.style.setProperty("mask-image", image);
    layer.style.setProperty("-webkit-mask-image", image);
    layer.style.setProperty("mask-size", size);
    layer.style.setProperty("-webkit-mask-size", size);
    layer.style.setProperty("mask-position", position);
    layer.style.setProperty("-webkit-mask-position", position);
}

// follows the excluded elements every frame while there are any (they scroll, grow and fly around)
function tick() {
    layers.forEach(updateHoles);
    frame = exclusions.size ? requestAnimationFrame(tick) : 0;
}

function watch() {
    if (!frame) frame = requestAnimationFrame(tick);
}

// keeps an image or video out of the CRT effect: the effect gets a hole wherever it is
export function useCrtExclusion(ref: RefObject<HTMLElement>) {
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        exclusions.add(element);
        watch();
        return () => {
            exclusions.delete(element);
            // one last pass to close its hole
            layers.forEach(updateHoles);
        };
    }, [ref]);
}

// Layers drawn over the whole web to make it look like it's seen through an old CRT tv playing a VHS tape:
// scanlines, phosphor mask, tape noise, a tracking bar rolling down and the rounded, darkened glass
export default function CrtOverlay() {
    const noiseRef = useRef<HTMLDivElement>(null);
    const effectRef = useRef<HTMLDivElement>(null);

    // static grain generated once, App.css moves it around
    useEffect(() => {
        const canvas = document.createElement("canvas");
        canvas.width = NOISE_SIZE;
        canvas.height = NOISE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx || !noiseRef.current) return;

        const image = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
        for (let i = 0; i < image.data.length; i += 4) {
            const value = Math.random() * 255;
            image.data[i] = value;
            image.data[i + 1] = value;
            image.data[i + 2] = value;
            image.data[i + 3] = Math.random() * 255;
        }
        ctx.putImageData(image, 0, 0);
        noiseRef.current.style.backgroundImage = `url(${canvas.toDataURL()})`;
    }, [])

    useEffect(() => {
        const effect = effectRef.current;
        if (!effect) return;
        layers.add(effect);
        watch();
        return () => { layers.delete(effect) };
    }, [])

    // the bezel stays on .crt, everything else in .crt__effect so it can have holes
    return <div className="crt" aria-hidden="true">
        <div className="crt__effect" ref={effectRef}>
            <div className="crt__noise" ref={noiseRef}></div>
            <div className="crt__scanlines"></div>
            <div className="crt__mask"></div>
            <div className="crt__roll"></div>
            <div className="crt__glass"></div>
        </div>
    </div>
}
