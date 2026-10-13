import { useEffect, useState } from "react";
import type { InputSubscribe } from "../types";
import { MenuList } from "./MenuList";

interface Props {
  hasSave: boolean;
  subscribe: InputSubscribe;
  onNew: () => void;
  onContinue: () => void;
}

/**
 * With a save: CONTINUE / NEW GAME menu. Choosing NEW GAME asks for
 * confirmation first, because it deletes the saved game.
 * Without a save: PRESS START (click, A or Start).
 */
export function TitleScreen({ hasSave, subscribe, onNew, onContinue }: Props) {
  const [confirming, setConfirming] = useState(false);
  const options = hasSave
    ? [
        { label: "CONTINUE", run: onContinue },
        { label: "NEW GAME", run: () => setConfirming(true) },
      ]
    : [{ label: "PRESS START", run: onNew }];
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (confirming) return; // the confirmation popup handles the buttons
    return subscribe((b) => {
      if (b === "up") setCursor(0);
      else if (b === "down") setCursor(Math.min(1, options.length - 1));
      else if (b === "a" || b === "start") options[cursor].run();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, cursor, hasSave, confirming, onNew, onContinue]);

  return (
    <div className="gb-title" onClick={hasSave ? undefined : onNew}>
      <div className="gb-title-name">
        POCKET
        <br />
        QUEST
      </div>

      {hasSave ? (
        <div className="gb-title-menu">
          {options.map((o, i) => (
            <button
              key={o.label}
              className="gb-menu-item"
              onPointerEnter={() => setCursor(i)}
              onClick={o.run}
            >
              {cursor === i ? ">" : "\u00a0"}
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="gb-title-start gb-blink">PRESS START</div>
      )}

      <div className="gb-title-hint">ARROWS MOVE · Z = A · X = B</div>

      {confirming && (
        <div className="gb-confirm">
          <div className="gb-confirm-box">
            <div>
              Start a new game?
              <br />
              Your saved game will be deleted!
            </div>
            {/* the cursor starts on NO so a stray A press can't delete the save */}
            <MenuList
              className="gb-confirm-menu"
              options={["YES", "NO"]}
              initialCursor={1}
              subscribe={subscribe}
              onSelect={(i) => (i === 0 ? onNew() : setConfirming(false))}
              onBack={() => setConfirming(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}