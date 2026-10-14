import { useCallback, useEffect, useRef } from "react";
import { KEYMAP } from "../constants";
import { usePlaying } from "../../../arcade/store";
import type { Btn } from "../types";

/**
 * Input bus shared by keyboard and on-screen buttons.
 * - `held`: buttons currently down (used for continuous walking)
 * - `subscribe`: one-shot "button pressed" events (menus, title screen)
 */
export function useGameInput() {
  const held = useRef(new Set<Btn>());
  const listeners = useRef(new Set<(b: Btn) => void>());

  const press = useCallback((b: Btn) => {
    if (held.current.has(b)) return;
    held.current.add(b);
    listeners.current.forEach((l) => l(b));
  }, []);

  const release = useCallback((b: Btn) => {
    held.current.delete(b);
  }, []);

  const subscribe = useCallback((fn: (b: Btn) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // the keyboard is only for this game while its arcade machine is the one being played
  const playing = usePlaying();

  useEffect(() => {
    if (!playing) {
      held.current.clear();
      return;
    }
    const norm = (k: string) => (k.length === 1 ? k.toLowerCase() : k);
    const down = (e: KeyboardEvent) => {
      const b = KEYMAP[norm(e.key)];
      if (!b) return;
      e.preventDefault();
      press(b);
    };
    const up = (e: KeyboardEvent) => {
      const b = KEYMAP[norm(e.key)];
      if (b) release(b);
    };
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [press, release, playing]);

  return { held, press, release, subscribe };
}