import { useEffect, useState } from "react";
import { BASE_H, BASE_W } from "../constants";

export interface ScreenSize {
  /** CSS pixels per logical pixel. */
  scale: number;
  /** Logical screen size in game pixels (never smaller than BASE_W x BASE_H). */
  width: number;
  height: number;
}

const compute = (): ScreenSize => {
  if (typeof window === "undefined") return { scale: 3, width: BASE_W, height: BASE_H };
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Scale so that at least 160x144 logical pixels fit, then use all the
  // extra space on the other axis for more logical pixels.
  const scale = Math.max(1, Math.min(w / BASE_W, h / BASE_H));
  return {
    scale,
    width: Math.max(BASE_W, Math.floor(w / scale + 1e-6)),
    height: Math.max(BASE_H, Math.floor(h / scale + 1e-6)),
  };
};

/**
 * Responsive screen: fills the whole viewport at any aspect ratio.
 * Recomputed on resize / rotation.
 */
export function useScale(): ScreenSize {
  const [size, setSize] = useState(compute);
  useEffect(() => {
    const f = () => setSize(compute());
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("orientationchange", f);
    };
  }, []);
  return size;
}