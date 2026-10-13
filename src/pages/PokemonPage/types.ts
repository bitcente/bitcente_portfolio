export type Btn = "up" | "down" | "left" | "right" | "a" | "b" | "start";
export type Dir = "up" | "down" | "left" | "right";
export type Mode = "title" | "overworld" | "menu" | "transition" | "battle" | "evolution";
export type Anim = "hidden" | "enter" | "idle" | "attack" | "hit" | "faint" | "absorb";
export type Kind = "lizard" | "bird" | "rat";
export type V3 = [number, number, number];
export type BattleResult = "win" | "lose" | "run" | "caught";

export type ItemId = "ball" | "potion";
export type Inventory = Record<ItemId, number>;

export type InputSubscribe = (fn: (b: Btn) => void) => () => void;

/* ---------------- creatures ---------------- */

export type PokeType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

/** Conditions that stay on a creature during a battle. */
export type Status = "burn" | "poison" | "paralysis" | "freeze";
export type StatId = "atk" | "def";
/** Attack / defense stage changes, from -6 to +6. */
export interface Stages {
  atk: number;
  def: number;
}

/** What a move does after it hits (see data/types.ts for the defaults of each type). */
export interface MoveEffect {
  /** Inflict a status condition. */
  status?: Status;
  /** Change a stat stage of the target ("foe") or the user ("self"). */
  stat?: { stat: StatId; stages: number; target: "foe" | "self" };
  /** Heal the user for this fraction of the damage dealt. */
  drain?: number;
  /** Chance (0..1) that the status / stat change happens. Default 1. */
  chance?: number;
}

export interface Move {
  id: string;
  name: string;
  type: PokeType;
  power: number;
  accuracy: number;
  /** undefined = the default effect of its type, null = no effect. */
  effect?: MoveEffect | null;
}

export interface LearnEntry {
  level: number;
  /** Move id (see data/moves.ts). */
  move: string;
}

/** Static data of a species (see data/species.ts). */
export interface SpeciesData {
  id: string;
  name: string;
  kind: Kind;
  types: PokeType[];
  main: string;
  accent: string;
  /** Color of the glowing tail tip (lizards only). */
  tail?: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseExp: number;
  /** Base chance (0..1) to catch it with a ball when its HP is almost 0. Default 0.8. */
  catchRate?: number;
  /** Evolves into another species when it reaches this level (checked after a battle). */
  evolution?: { level: number; into: string };
  /** 1 = basic form, 2 = evolved form (the 3D model gets extra parts: horns, wings, spikes...). */
  stage?: 1 | 2;
  /** Size of the 3D model (default 1). Evolved forms are bigger. */
  size?: number;
  learnset: LearnEntry[];
}

/** A creature ready to fight: species + level resolved into real stats. */
export interface Combatant {
  speciesId: string;
  name: string;
  kind: Kind;
  types: PokeType[];
  main: string;
  accent: string;
  tail?: string;
  level: number;
  maxHp: number;
  atk: number;
  def: number;
  baseExp: number;
  /** Model form (1 or 2) and size, from the species. */
  stage: number;
  size: number;
  moves: Move[];
}

/** A creature in the player's team (this is what gets saved). */
export interface PartyMember {
  speciesId: string;
  level: number;
  /** Total experience points. */
  exp: number;
  hp: number;
}

/* ---------------- world ---------------- */

export interface PlayerState {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Dir;
  moving: boolean;
  progress: number;
  parity: number;
}

export interface Pos {
  x: number;
  y: number;
}

/** Stepping on (x, y) takes you to map `to` at (toX, toY). */
export interface Warp extends Pos {
  to: string;
  toX: number;
  toY: number;
}

export interface EncounterEntry {
  speciesId: string;
  min: number;
  max: number;
  weight: number;
}

/** A character you can talk to (press A in front of it). */
export interface Npc extends Pos {
  id: string;
  name: string;
  kind: "nurse" | "villager";
  /** Direction it faces. */
  dir: Dir;
  /**
   * Extra spots to talk to it from, facing `dir` (the nurse is talked to over
   * the counter, so you stand in front of the counter).
   */
  talkFrom?: (Pos & { dir: Dir })[];
  /** What a villager says. */
  lines?: string[];
  /** Sprite sheet id: public/pokemon/npc_<id>.png. Default: its kind ("nurse", "villager"). */
  sprite?: string;
}

export interface Trainer extends Pos {
  id: string;
  name: string;
  speciesId: string;
  level: number;
  /** Sprite sheet id: public/pokemon/npc_<id>.png. Default "trainer". */
  sprite?: string;
  /** Direction it faces (default down). */
  dir?: Dir;
  /**
   * How many tiles in front of it it can see (default 4). Stepping on one of
   * them stops you: it spots you, walks up to you and challenges you. Walls,
   * trees and other characters block its sight.
   */
  sight?: number;
  /** Fixed trigger tiles instead of a line of sight (the gym leader never moves). */
  trigger?: Pos[];
  intro: string[];
  win: string[];
  badge?: string;
}

export interface GameMap {
  id: string;
  name: string;
  rows: string[];
  /** Tile used outside the map (default "T"). */
  outside?: string;
  warps: Warp[];
  /** Wild creatures found in tall grass ("G"). */
  encounters?: EncounterEntry[];
  trainers?: Trainer[];
  npcs?: Npc[];
}

/* ---------------- game state ---------------- */

export interface Respawn {
  mapId: string;
  x: number;
  y: number;
  /** Direction you face when you wake up there (default down). */
  dir?: Dir;
}

export interface SaveData {
  version: 1;
  mapId: string;
  x: number;
  y: number;
  dir: Dir;
  team: PartyMember[];
  inventory: Inventory;
  badges: string[];
  defeated: string[];
  respawn: Respawn;
}

/** A character that is being animated by a cutscene (a trainer walking up to you). */
export interface Walker {
  /** Position in tiles (can be fractional while walking). */
  x: number;
  y: number;
  dir: Dir;
  /** Show the "!" bubble above its head. */
  alert?: boolean;
  /** 0 or 1: leg frame while walking (procedural sprite). */
  stride?: number;
  /** Walking state for sprite sheets: progress of the current tile (0..1) and which foot (0/1). */
  moving?: boolean;
  progress?: number;
  parity?: number;
}

export interface DialogState {
  lines: string[];
  index: number;
  onDone?: () => void;
  /** Shown on the last line (YES / NO). Choosing one closes the dialog and runs it. */
  choices?: { label: string; run: () => void }[];
}

export interface BattleSetup {
  enemy: Combatant;
  trainer?: Trainer;
}