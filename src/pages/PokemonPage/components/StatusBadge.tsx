import { SPECIES } from "../data/species";
import { memberMaxHp } from "../monsters";
import type { PartyMember } from "../types";

interface Props {
  member: PartyMember;
  badges: number;
}

export function StatusBadge({ member, badges }: Props) {
  return (
    <div className="gb-status">
      {SPECIES[member.speciesId].name} Lv{member.level}
      <br />
      HP {member.hp}/{memberMaxHp(member)}
      {badges > 0 && (
        <>
          <br />
          BADGES {badges}
        </>
      )}
    </div>
  );
}