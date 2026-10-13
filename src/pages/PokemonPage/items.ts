import type { Inventory, ItemId } from "./types";

export const POTION_HEAL = 20;
/** Maximum creatures in the team. */
export const MAX_TEAM = 6;
/** Items a new game starts with. */
export const STARTING_ITEMS: Inventory = { ball: 5, potion: 3 };

export const ITEM_LIST: { id: ItemId; name: string; desc: string }[] = [
  { id: "ball", name: "BALL", desc: "Throw it at a wild creature to catch it. Works best when its HP is low." },
  { id: "potion", name: "POTION", desc: `Restores ${POTION_HEAL} HP of one creature.` },
];