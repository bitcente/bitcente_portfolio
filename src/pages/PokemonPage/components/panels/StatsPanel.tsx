import { useEffect } from "react";
import { SPECIES } from "../../data/species";
import { typeLabel } from "../../data/types";
import { expForLevel, memberMaxHp, toCombatant } from "../../monsters";
import type { InputSubscribe, PartyMember } from "../../types";

interface Props {
  member: PartyMember;
  subscribe: InputSubscribe;
  onBack: () => void;
}

/** Stats and moves of one creature. Any button or a click closes it. */
export function StatsPanel({ member, subscribe, onBack }: Props) {
  useEffect(
    () =>
      subscribe((b) => {
        if (b === "a" || b === "b" || b === "start") onBack();
      }),
    [subscribe, onBack]
  );

  const sp = SPECIES[member.speciesId];
  const c = toCombatant(sp, member.level);
  const toNext = Math.max(0, expForLevel(member.level + 1) - member.exp);

  return (
    <div className="gb-panel" onClick={onBack}>
      <div className="gb-panel-title gb-row">
        <span>{sp.name}</span>
        <span className="gb-lv">Lv{member.level}</span>
      </div>
      <div className="gb-types">{c.types.map(typeLabel).join(" / ")}</div>
      <div className="gb-stats">
        <div className="gb-row">
          <span>HP</span>
          <span>
            {member.hp}/{memberMaxHp(member)}
          </span>
        </div>
        <div className="gb-row">
          <span>ATTACK</span>
          <span>{c.atk}</span>
        </div>
        <div className="gb-row">
          <span>DEFENSE</span>
          <span>{c.def}</span>
        </div>
        <div className="gb-row">
          <span>EXP</span>
          <span>{member.exp}</span>
        </div>
        <div className="gb-row">
          <span>TO NEXT LV</span>
          <span>{toNext}</span>
        </div>
      </div>
      {sp.evolution && member.level < sp.evolution.level && (
        <div className="gb-row gb-evo-hint">
          <span>EVOLVES AT</span>
          <span>LV{sp.evolution.level}</span>
        </div>
      )}
      <div className="gb-stats gb-stats-moves">
        {c.moves.map((m) => (
          <div className="gb-row" key={m.id}>
            <span>{m.name}</span>
            <span>
              {typeLabel(m.type)} {m.power}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}