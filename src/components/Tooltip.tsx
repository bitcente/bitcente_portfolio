import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { formatText } from "../utils/Text";

gsap.registerPlugin(SplitText);

const OFFSET = 18;

interface TooltipProps {
  text?: string;
}

export default function Tooltip({ text }: TooltipProps) {
  const box = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  // keeps the last text while the box fades out
  const [content, setContent] = useState("");

  // follow the cursor (flips to the other side near the screen edges)
  useEffect(() => {
    const el = box.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3" });

    const onMove = (e: PointerEvent) => {
      const { width, height } = el.getBoundingClientRect();
      const x =
        e.clientX + OFFSET + width > window.innerWidth
          ? e.clientX - OFFSET - width
          : e.clientX + OFFSET;
      const y =
        e.clientY + OFFSET + height > window.innerHeight
          ? e.clientY - OFFSET - height
          : e.clientY + OFFSET;
      xTo(x);
      yTo(y);
    };

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // show / hide the box
  useEffect(() => {
    const el = box.current;
    if (!el) return;

    if (text) {
      setContent(text);
      gsap.to(el, { autoAlpha: 1, duration: 0.15, overwrite: "auto" });
    } else {
      gsap.to(el, {
        autoAlpha: 0,
        duration: 0.15,
        overwrite: "auto",
        onComplete: () => setContent(""),
      });
    }
  }, [text]);

  // SplitText reveal every time the text changes
  useEffect(() => {
    if (!content || !textRef.current) return;

    const split = new SplitText(textRef.current, {
        type: "words",
        wordsClass: "tooltip__word",
    });
    const tween = gsap.from(split.words, {
      autoAlpha: 0,
      y: 6,
      duration: 0.25,
      stagger: 0.03,
      ease: "power2.out",
    });

    return () => {
      tween.kill();
      split.revert();
    };
  }, [content]);

  return (
    <div className="tooltip" ref={box}>
      {/* key remounts the <p> so React never fights the split DOM */}
      <p className="tooltip__text text-base" ref={textRef} key={content}>
        {formatText(content)}
      </p>
    </div>
  );
}