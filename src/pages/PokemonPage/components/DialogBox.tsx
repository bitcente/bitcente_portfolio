import { useEffect } from "react";
import type { InputSubscribe } from "../types";
import { MenuList } from "./MenuList";

interface Props {
  text: string;
  subscribe: InputSubscribe;
  onNext: () => void;
  /** Options shown on the last line (e.g. YES / NO). */
  choices?: string[];
  onChoose?: (index: number) => void;
}

/**
 * Overworld message box. A / B / Start or a click shows the next line.
 * When `choices` is set (last line only) a small menu is shown instead and
 * the answer is sent to `onChoose` (B picks the last option, usually NO).
 */
export function DialogBox({ text, subscribe, onNext, choices, onChoose }: Props) {
  useEffect(() => {
    if (choices) return; // the choice menu handles the buttons
    return subscribe((b) => {
      if (b === "a" || b === "b" || b === "start") onNext();
    });
  }, [subscribe, onNext, choices]);

  return (
    <>
      <div
        className="gb-box gb-dialog gb-ov-dialog"
        onClick={choices ? undefined : onNext}
      >
        <div className="gb-msg">{text}</div>
        {!choices && <span className="gb-more gb-blink">▼</span>}
      </div>
      {choices && onChoose && (
        <MenuList
          className="gb-choice-menu"
          options={choices}
          subscribe={subscribe}
          onSelect={onChoose}
          onBack={() => onChoose(choices.length - 1)}
        />
      )}
    </>
  );
}