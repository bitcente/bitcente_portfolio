import type { MouseEvent, PointerEvent } from "react";
import type { Btn } from "../types";

interface Props {
  press: (b: Btn) => void;
  release: (b: Btn) => void;
  /** Label of the START pill: "START" on the title screen, "MENU" while walking. */
  startLabel?: string;
}

/** Touch / mouse controls drawn on top of the game screen. */
export function GamepadControls({ press, release, startLabel }: Props) {
  const bind = (b: Btn) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      press(b);
    },
    onPointerUp: () => release(b),
    onPointerLeave: () => release(b),
    onPointerCancel: () => release(b),
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="gb-overlay">
      <div className="gb-dpad">
        <button className="gb-pad-btn gb-pad-up" aria-label="Up" {...bind("up")}>▲</button>
        <button className="gb-pad-btn gb-pad-left" aria-label="Left" {...bind("left")}>◀</button>
        <button className="gb-pad-btn gb-pad-right" aria-label="Right" {...bind("right")}>▶</button>
        <button className="gb-pad-btn gb-pad-down" aria-label="Down" {...bind("down")}>▼</button>
      </div>

      <div className="gb-ab">
        <button className="gb-pad-btn gb-btn-b" aria-label="B" {...bind("b")}>B</button>
        <button className="gb-pad-btn gb-btn-a" aria-label="A" {...bind("a")}>A</button>
      </div>

      {startLabel && (
        <button className="gb-pad-btn gb-start" aria-label="Start" {...bind("start")}>
          {startLabel}
        </button>
      )}
    </div>
  );
}