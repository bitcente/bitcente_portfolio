import { useState } from "react";
import { SPECIES } from "../data/species";
import type { InputSubscribe, Inventory, ItemId, PartyMember } from "../types";
import { MenuList } from "./MenuList";
import { BagPanel } from "./panels/BagPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { TeamPanel } from "./panels/TeamPanel";

interface Props {
  team: PartyMember[];
  inventory: Inventory;
  subscribe: InputSubscribe;
  onClose: () => void;
  /** Swap two creatures in the team order. */
  onSwap: (i: number, j: number) => void;
  /** Use a potion on team[i]. */
  onUsePotion: (i: number) => { ok: boolean; msg: string };
}

type View =
  | { k: "main" }
  | { k: "team" }
  | { k: "member"; i: number }
  | { k: "stats"; i: number }
  | { k: "move"; i: number }
  | { k: "bag" }
  | { k: "potion" };

/** Overworld menu: TEAM (stats, reorder), BAG (potions) and CLOSE. */
export function PauseMenu({ team, inventory, subscribe, onClose, onSwap, onUsePotion }: Props) {
  const [view, setView] = useState<View>({ k: "main" });
  const [note, setNote] = useState<string | undefined>();
  const go = (v: View, n?: string) => {
    setNote(n);
    setView(v);
  };

  switch (view.k) {
    case "main":
      return (
        <MenuList
          options={["TEAM", "BAG", "CLOSE"]}
          subscribe={subscribe}
          onSelect={(i) => (i === 0 ? go({ k: "team" }) : i === 1 ? go({ k: "bag" }) : onClose())}
          onBack={onClose}
        />
      );

    case "team":
      return (
        <TeamPanel
          title="TEAM"
          team={team}
          subscribe={subscribe}
          onSelect={(i) => go({ k: "member", i })}
          onBack={() => go({ k: "main" })}
        />
      );

    case "member": {
      const m = team[view.i];
      if (!m) return null;
      return (
        <div className="gb-panel">
          <div className="gb-panel-title gb-row">
            <span>{SPECIES[m.speciesId].name}</span>
            <span className="gb-lv">Lv{m.level}</span>
          </div>
          <MenuList
            className="gb-panel-list"
            options={["STATS", "MOVE", "BACK"]}
            subscribe={subscribe}
            onSelect={(i) =>
              i === 0
                ? go({ k: "stats", i: view.i })
                : i === 1
                ? go({ k: "move", i: view.i }, "Choose where to move it.")
                : go({ k: "team" })
            }
            onBack={() => go({ k: "team" })}
          />
        </div>
      );
    }

    case "stats": {
      const m = team[view.i];
      if (!m) return null;
      return <StatsPanel member={m} subscribe={subscribe} onBack={() => go({ k: "team" })} />;
    }

    case "move":
      return (
        <TeamPanel
          title={`MOVE ${SPECIES[team[view.i]?.speciesId]?.name ?? ""} TO:`}
          team={team}
          marked={view.i}
          note={note}
          subscribe={subscribe}
          onSelect={(j) => {
            if (j !== view.i) onSwap(view.i, j);
            go({ k: "team" });
          }}
          onBack={() => go({ k: "team" })}
        />
      );

    case "bag":
      return (
        <BagPanel
          inventory={inventory}
          note={note}
          subscribe={subscribe}
          onSelect={(id: ItemId) =>
            id === "potion"
              ? inventory.potion > 0
                ? go({ k: "potion" })
                : setNote("No POTIONs left!")
              : setNote("You can't use that here.")
          }
          onBack={() => go({ k: "main" })}
        />
      );

    case "potion":
      return (
        <TeamPanel
          title="USE POTION ON:"
          team={team}
          note={note}
          subscribe={subscribe}
          onSelect={(i) => {
            const r = onUsePotion(i);
            if (r.ok) go({ k: "bag" }, r.msg);
            else setNote(r.msg);
          }}
          onBack={() => go({ k: "bag" })}
        />
      );
  }
}