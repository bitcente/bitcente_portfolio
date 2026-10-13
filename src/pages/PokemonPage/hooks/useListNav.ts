import { useEffect, useRef, useState } from "react";
import type { InputSubscribe } from "../types";

/**
 * Cursor for a vertical list driven by the game buttons:
 * up/down move, A selects, B (or Start) goes back.
 */
export function useListNav(
  subscribe: InputSubscribe,
  count: number,
  onSelect: (index: number) => void,
  onBack?: () => void,
  initialCursor = 0
) {
  const [cursor, setCursor] = useState(initialCursor);
  const safe = Math.min(cursor, Math.max(0, count - 1));

  const live = useRef({ cursor: safe, count, onSelect, onBack });
  live.current = { cursor: safe, count, onSelect, onBack };

  useEffect(
    () =>
      subscribe((b) => {
        const s = live.current;
        if (b === "up") setCursor(Math.max(0, s.cursor - 1));
        else if (b === "down") setCursor(Math.min(s.count - 1, s.cursor + 1));
        else if (b === "a") s.onSelect(s.cursor);
        else if (b === "b" || b === "start") {
          if (s.onBack) s.onBack();
          else if (b === "start") s.onSelect(s.cursor);
        }
      }),
    [subscribe]
  );

  return [safe, setCursor] as const;
}