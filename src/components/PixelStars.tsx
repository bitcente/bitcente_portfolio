import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// ms between stars
const SPAWN_EVERY = 140;
// px from the middle where a star pops, and px it travels from there
const START = [20, 40];
const DISTANCE = [60, 140];
// px of each pixel of a star
const PIXEL = [2, 4];
// outline and fill, so they show on top of Bitcente and on the light background around him
const OUTLINE = "#0D1403";
const FILLS = ["#A8B987", "#e6f0c8", "#7F8E5A"];

// 9x9 sparkle: o is outline, x is fill
const STAR = [
    "....o....",
    "...oxo...",
    "...oxo...",
    ".ooxxxoo.",
    "oxxxxxxxo",
    ".ooxxxoo.",
    "...oxo...",
    "...oxo...",
    "....o....",
];

function starSvg(fill: string) {
    const rects = STAR.flatMap((row, y) => [...row].map((pixel, x) => (
        pixel === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${pixel === "o" ? OUTLINE : fill}"/>`
    ))).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAR.length} ${STAR.length}" shape-rendering="crispEdges">${rects}</svg>`;
}

const random = ([min, max]: number[]) => min + Math.random() * (max - min);

// Pixelated stars popping out of the middle of their container while active
export default function PixelStars({ active }: { active: boolean }) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!active || !container) return;

        const spawn = () => {
            const star = document.createElement("div");
            const size = Math.round(random(PIXEL)) * STAR.length;
            star.className = "pixel-stars__star";
            star.style.width = star.style.height = size + "px";
            star.innerHTML = starSvg(FILLS[Math.floor(Math.random() * FILLS.length)]);
            container.appendChild(star);

            const angle = Math.random() * Math.PI * 2;
            const start = random(START);
            const end = start + random(DISTANCE);
            gsap.timeline({ onComplete: () => star.remove() })
                .fromTo(star,
                    { xPercent: -50, yPercent: -50, x: Math.cos(angle) * start, y: Math.sin(angle) * start, scale: 0 },
                    { x: Math.cos(angle) * end, y: Math.sin(angle) * end, scale: 1, duration: 1.1, ease: "steps(10)" })
                // twinkles out
                .to(star, { autoAlpha: 0, duration: .35, ease: "steps(3)" }, "-=.35");
        };

        spawn();
        const interval = window.setInterval(spawn, SPAWN_EVERY);
        return () => clearInterval(interval);
    }, [active]);

    // the ones already out finish their way when it stops, and are cleaned up if it goes away
    useEffect(() => {
        const container = containerRef.current;
        return () => container?.querySelectorAll(".pixel-stars__star").forEach((star) => {
            gsap.killTweensOf(star);
            star.remove();
        });
    }, []);

    return <div className="pixel-stars" ref={containerRef} aria-hidden="true"></div>;
}
