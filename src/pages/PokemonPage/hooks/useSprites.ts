import { useEffect, useState } from "react";
import { EMPTY_SPRITES, getCachedSprites, loadSprites } from "../sprites";
import type { LoadedSprites } from "../sprites";

/** Loads the sprite sheets once; returns nulls until loaded (or if missing). */
export function useSprites(): LoadedSprites {
  const [sprites, setSprites] = useState<LoadedSprites>(
    () => getCachedSprites() ?? EMPTY_SPRITES
  );

  useEffect(() => {
    let alive = true;
    loadSprites().then((s) => {
      if (alive) setSprites(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return sprites;
}