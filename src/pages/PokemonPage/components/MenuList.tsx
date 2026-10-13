import { useListNav } from "../hooks/useListNav";
import type { InputSubscribe } from "../types";

interface Props {
  options: string[];
  subscribe: InputSubscribe;
  onSelect: (index: number) => void;
  onBack?: () => void;
  className?: string;
  /** Option the cursor starts on (default the first). */
  initialCursor?: number;
}

/** A small vertical menu with a ">" cursor (keyboard, gamepad, mouse and touch). */
export function MenuList({
  options,
  subscribe,
  onSelect,
  onBack,
  className = "gb-pause-menu",
  initialCursor,
}: Props) {
  const [cursor, setCursor] = useListNav(subscribe, options.length, onSelect, onBack, initialCursor);
  return (
    <div className={className}>
      {options.map((label, i) => (
        <button
          key={label}
          className="gb-menu-item"
          onPointerEnter={() => setCursor(i)}
          onClick={() => onSelect(i)}
        >
          {cursor === i ? ">" : "\u00a0"}
          {label}
        </button>
      ))}
    </div>
  );
}