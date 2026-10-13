import { useEffect, useRef } from "react";

// px of the generated noise tile
const NOISE_SIZE = 128;

// Layers drawn over the whole web to make it look like it's seen through an old CRT tv playing a VHS tape:
// scanlines, phosphor mask, tape noise, a tracking bar rolling down and the rounded, darkened glass
export default function CrtOverlay() {
    const noiseRef = useRef<HTMLDivElement>(null);

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

    return <div className="crt" aria-hidden="true">
        <div className="crt__noise" ref={noiseRef}></div>
        <div className="crt__scanlines"></div>
        <div className="crt__mask"></div>
        <div className="crt__roll"></div>
        <div className="crt__glass"></div>
    </div>
}
