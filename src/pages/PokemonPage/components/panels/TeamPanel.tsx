import { SPECIES } from "../../data/species";
import { useListNav } from "../../hooks/useListNav";
import { memberMaxHp } from "../../monsters";
import type { InputSubscribe, PartyMember } from "../../types";
import { HpBar } from "../battle/HpBar";

interface Props {
  title: string;
  team: PartyMember[];
  subscribe: InputSubscribe;
  onSelect: (index: number) => void;
  /** Without it the panel cannot be closed (forced switch after a faint). */
  onBack?: () => void;
  /** Message shown at the bottom. */
  note?: string;
  /** Index marked with a "*" (current creature, or the one being moved). */
  marked?: number;
}

/** Full-screen list of the team with level and HP. Used for the menu, switching and potions. */
export function TeamPanel({ title, team, subscribe, onSelect, onBack, note, marked }: Props) {
  const rows = team.length + (onBack ? 1 : 0);
  const [cursor, setCursor] = useListNav(
    subscribe,
    rows,
    (i) => (i < team.length ? onSelect(i) : onBack?.()),
    onBack
  );

  return (
    <div className="gb-panel">
      <div className="gb-panel-title">{title}</div>
      <div className="gb-panel-list">
        {team.map((m, i) => {
          const max = memberMaxHp(m);
          return (
            <button
              key={i}
              className="gb-list-item"
              onPointerEnter={() => setCursor(i)}
              onClick={() => onSelect(i)}
            >
              <span>
                {cursor === i ? ">" : "\u00a0"}
                {SPECIES[m.speciesId].name}
                {marked === i ? "*" : ""}
              </span>
              <span className="gb-lv">Lv{m.level}</span>
              <span className="gb-list-hp">
                <HpBar value={m.hp} max={max} />
                <small>{m.hp > 0 ? `${m.hp}/${max}` : "FAINT"}</small>
              </span>
            </button>
          );
        })}
        {onBack && (
          <button
            className="gb-list-item gb-list-back"
            onPointerEnter={() => setCursor(team.length)}
            onClick={onBack}
          >
            {cursor === team.length ? ">" : "\u00a0"}BACK
          </button>
        )}
      </div>
      <div className="gb-panel-note">{note ?? "\u00a0"}</div>
    </div>
  );
}