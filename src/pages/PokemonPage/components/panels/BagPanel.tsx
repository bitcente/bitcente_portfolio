import { ITEM_LIST } from "../../items";
import { useListNav } from "../../hooks/useListNav";
import type { InputSubscribe, Inventory, ItemId } from "../../types";

interface Props {
  inventory: Inventory;
  subscribe: InputSubscribe;
  onSelect: (id: ItemId) => void;
  onBack: () => void;
  /** Message shown at the bottom (replaces the item description). */
  note?: string;
}

/** Full-screen list of items with their counts. */
export function BagPanel({ inventory, subscribe, onSelect, onBack, note }: Props) {
  const [cursor, setCursor] = useListNav(
    subscribe,
    ITEM_LIST.length + 1,
    (i) => (i < ITEM_LIST.length ? onSelect(ITEM_LIST[i].id) : onBack()),
    onBack
  );

  return (
    <div className="gb-panel">
      <div className="gb-panel-title">BAG</div>
      <div className="gb-panel-list">
        {ITEM_LIST.map((item, i) => (
          <button
            key={item.id}
            className="gb-list-item gb-list-flat"
            onPointerEnter={() => setCursor(i)}
            onClick={() => onSelect(item.id)}
          >
            <span>
              {cursor === i ? ">" : "\u00a0"}
              {item.name}
            </span>
            <span>x{inventory[item.id]}</span>
          </button>
        ))}
        <button
          className="gb-list-item gb-list-flat"
          onPointerEnter={() => setCursor(ITEM_LIST.length)}
          onClick={onBack}
        >
          {cursor === ITEM_LIST.length ? ">" : "\u00a0"}BACK
        </button>
      </div>
      <div className="gb-panel-note">
        {note ?? (cursor < ITEM_LIST.length ? ITEM_LIST[cursor].desc : "\u00a0")}
      </div>
    </div>
  );
}