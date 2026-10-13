import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { MOVES, effectOf } from "../../data/moves";
import { SPECIES } from "../../data/species";
import {
  STATUS_IMMUNITY,
  STATUS_TAG,
  STATUS_TEXT,
  effectLabel,
  typeLabel,
  typeMultiplier,
} from "../../data/types";
import type { FxState, MotionState } from "../../fx/types";
import { animFor } from "../../fx/recipes";
import { MAX_TEAM, POTION_HEAL } from "../../items";
import {
  MAX_LEVEL,
  calcDamage,
  catchChance,
  expForLevel,
  expGain,
  expProgress,
  healMember,
  toCombatant,
} from "../../monsters";
import type {
  Anim,
  BattleResult,
  Combatant,
  InputSubscribe,
  Inventory,
  ItemId,
  Move,
  PartyMember,
  Stages,
  StatId,
  Status,
  Trainer,
} from "../../types";
import { sleep } from "../../utils";
import { BagPanel } from "../panels/BagPanel";
import { TeamPanel } from "../panels/TeamPanel";
import type { BallState } from "./Ball";
import { BATTLE_FOV, BattleScene } from "./BattleScene";
import { HpBar } from "./HpBar";

interface Props {
  team: PartyMember[];
  inventory: Inventory;
  enemy: Combatant;
  /** Set for trainer / gym battles: no running, no catching, more experience. */
  trainer?: Trainer;
  /** Screen scale, used to render the 3D view at game resolution (pixelated look). */
  scale: number;
  subscribe: InputSubscribe;
  /** Returns the final team and inventory (HP, exp, level, caught creatures, items used). */
  onFinish: (result: BattleResult, team: PartyMember[], inventory: Inventory) => void;
}

type Phase = "intro" | "menu" | "moves" | "bag" | "potion" | "team" | "forced" | "busy";
type Side = "player" | "enemy";
type Outcome = "ok" | "fainted" | "stop";

const other = (s: Side): Side => (s === "player" ? "enemy" : "player");
const NO_STAGES: Stages = { atk: 0, def: 0 };
const STAT_NAME: Record<StatId, string> = { atk: "ATTACK", def: "DEFENSE" };
const MENU = ["FIGHT", "BAG", "TEAM", "RUN"];

/** State that is also mirrored in a ref, so async turns always read the latest value. */
function useSynced<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    ref.current = typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
    setValue(ref.current);
  }, []);
  return [value, ref, set] as const;
}

export function Battle({ team: team0, inventory, enemy, trainer, scale, subscribe, onFinish }: Props) {
  const [team, teamRef, setTeam] = useSynced(team0);
  const [inv, invRef, setInv] = useSynced(inventory);
  const [active, activeRef, setActive] = useSynced(Math.max(0, team0.findIndex((m) => m.hp > 0)));
  const [eHp, eHpRef, setEHp] = useSynced(enemy.maxHp);
  // status conditions and stat stages only last for this battle
  const [pStatuses, pStatusRef, setPStatuses] = useSynced<Record<number, Status>>({});
  const [eStatus, eStatusRef, setEStatus] = useSynced<Status | null>(null);
  const [, pStagesRef, setPStages] = useSynced<Stages>(NO_STAGES);
  const [, eStagesRef, setEStages] = useSynced<Stages>(NO_STAGES);

  const member = team[active];
  const species = SPECIES[member.speciesId];
  const player = useMemo(() => toCombatant(species, member.level), [species, member.level]);
  const foe = trainer ? `Foe ${enemy.name}` : `Wild ${enemy.name}`;
  const pStatus = pStatuses[active] ?? null;

  const [phase, setPhase] = useState<Phase>("intro");
  const [msg, setMsg] = useState(
    trainer ? `${trainer.name} wants to battle!` : `Wild ${enemy.name} appeared!`
  );
  const [note, setNote] = useState<string | undefined>();
  const [cursor, setCursor] = useState(0);
  const [moveCursor, setMoveCursor] = useState(0);
  const [pAnim, setPAnim] = useState<Anim>("hidden");
  const [eAnim, setEAnim] = useState<Anim>(trainer ? "hidden" : "enter");
  const [ball, setBall] = useState<BallState>("none");
  const [fx, setFx] = useState<FxState | null>(null);
  const [pMotion, setPMotion] = useState<MotionState>({ id: "lunge", duration: 0.5 });
  const [eMotion, setEMotion] = useState<MotionState>({ id: "lunge", duration: 0.5 });
  const fxKey = useRef(0);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* ------------------------- accessors (work for both sides) ------------------------- */

  /** The creature that is currently fighting for the player. */
  const current = () => {
    const m = teamRef.current[activeRef.current];
    const sp = SPECIES[m.speciesId];
    return { m, sp, c: toCombatant(sp, m.level) };
  };
  const patchActive = (patch: Partial<PartyMember>) =>
    setTeam((t) => t.map((m, i) => (i === activeRef.current ? { ...m, ...patch } : m)));

  const combatantOf = (s: Side) => (s === "player" ? current().c : enemy);
  const nameOf = (s: Side) => (s === "player" ? current().c.name : foe);
  const hpOf = (s: Side) => (s === "player" ? teamRef.current[activeRef.current].hp : eHpRef.current);
  const maxHpOf = (s: Side) => (s === "player" ? current().c.maxHp : enemy.maxHp);
  const setHpOf = (s: Side, hp: number) => (s === "player" ? patchActive({ hp }) : setEHp(hp));
  const setAnimOf = (s: Side, a: Anim) => (s === "player" ? setPAnim(a) : setEAnim(a));
  const statusOf = (s: Side): Status | null =>
    s === "player" ? pStatusRef.current[activeRef.current] ?? null : eStatusRef.current;
  const setStatusOf = (s: Side, st: Status | null) => {
    if (s === "enemy") return setEStatus(st);
    setPStatuses((m) => {
      const n = { ...m };
      if (st) n[activeRef.current] = st;
      else delete n[activeRef.current];
      return n;
    });
  };
  const stagesOf = (s: Side) => (s === "player" ? pStagesRef : eStagesRef);
  const setStagesOf = (s: Side, v: Stages) => (s === "player" ? setPStages(v) : setEStages(v));

  const say = async (text: string, ms = 1200) => {
    setMsg(text);
    await sleep(ms);
    return mounted.current;
  };
  const finish = (result: BattleResult) => onFinish(result, teamRef.current, invRef.current);
  const toMenu = () => {
    setNote(undefined);
    setMsg(`What will ${current().c.name} do?`);
    setPhase("menu");
  };

  // Intro sequence
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await sleep(1500);
      if (cancelled) return;
      if (trainer) {
        setMsg(`${trainer.name} sent out ${enemy.name}!`);
        setEAnim("enter");
        await sleep(1400);
        if (cancelled) return;
      }
      setMsg(`Go! ${species.name}!`);
      setPAnim("enter");
      await sleep(1100);
      if (cancelled) return;
      setPAnim("idle");
      toMenu();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- status conditions, stat changes, effects ------------------------- */

  /** Can this side act? Frozen and paralyzed creatures sometimes can't. */
  const statusGate = async (s: Side): Promise<"go" | "skip" | "stop"> => {
    const st = statusOf(s);
    const name = nameOf(s);
    if (st === "freeze") {
      if (Math.random() < 0.2) {
        setStatusOf(s, null);
        return (await say(`${name} thawed out!`)) ? "go" : "stop";
      }
      return (await say(`${name} is frozen solid!`)) ? "skip" : "stop";
    }
    if (st === "paralysis" && Math.random() < 0.25) {
      return (await say(`${name} is fully paralyzed!`)) ? "skip" : "stop";
    }
    return "go";
  };

  const changeStage = async (target: Side, stat: StatId, delta: number): Promise<boolean> => {
    const cur = stagesOf(target).current;
    const next = Math.max(-6, Math.min(6, cur[stat] + delta));
    const name = nameOf(target);
    if (next === cur[stat]) {
      return say(`${name}'s ${STAT_NAME[stat]} won't go any ${delta > 0 ? "higher" : "lower"}!`);
    }
    setStagesOf(target, { ...cur, [stat]: next });
    return say(`${name}'s ${STAT_NAME[stat]} ${delta > 0 ? "rose" : "fell"}!`);
  };

  /** The extra effect of a move after it hit (status, stat change, drain). Returns false if unmounted. */
  const applyEffects = async (s: Side, move: Move, dealt: number): Promise<boolean> => {
    const eff = effectOf(move);
    if (!eff) return true;
    const d = other(s);

    if (eff.drain && dealt > 0) {
      const heal = Math.max(1, Math.floor(dealt * eff.drain));
      setHpOf(s, Math.min(maxHpOf(s), hpOf(s) + heal));
      if (!(await say(`${nameOf(s)} drained ${nameOf(d)}'s energy!`))) return false;
    }

    if (eff.status && hpOf(d) > 0 && statusOf(d) === null && Math.random() < (eff.chance ?? 1)) {
      const immune = combatantOf(d).types.some((t) => STATUS_IMMUNITY[eff.status!].includes(t));
      if (!immune) {
        setStatusOf(d, eff.status);
        if (!(await say(`${nameOf(d)} ${STATUS_TEXT[eff.status]}`))) return false;
      }
    }

    if (eff.stat && Math.random() < (eff.chance ?? 1)) {
      const target = eff.stat.target === "self" ? s : d;
      if (hpOf(target) > 0) {
        if (!(await changeStage(target, eff.stat.stat, eff.stat.stages))) return false;
      }
    }
    return true;
  };

  /** Burn and poison hurt at the end of every turn. */
  const residual = async (s: Side): Promise<Outcome> => {
    const st = statusOf(s);
    if (st !== "burn" && st !== "poison") return "ok";
    const dmg = Math.max(1, Math.floor(maxHpOf(s) / (st === "burn" ? 16 : 8)));
    setAnimOf(s, "hit");
    setHpOf(s, Math.max(0, hpOf(s) - dmg));
    if (!(await say(`${nameOf(s)} is hurt by its ${st === "burn" ? "burn" : "poison"}!`, 1100))) return "stop";
    setAnimOf(s, "idle");
    return hpOf(s) <= 0 ? "fainted" : "ok";
  };

  /* ------------------------- attacking ------------------------- */

  /**
   * One attack from `s`: status check, "used MOVE!", the move's animation,
   * damage with type effectiveness, then its extra effects.
   */
  const performMove = async (s: Side, move: Move): Promise<Outcome> => {
    const d = other(s);
    const gate = await statusGate(s);
    if (gate === "stop") return "stop";
    if (gate === "skip") return "ok";

    const atk = combatantOf(s);
    const def = combatantOf(d);
    const aName = nameOf(s);
    const dName = nameOf(d);
    const anim = animFor(move);
    const hit = Math.random() * 100 < move.accuracy;
    const mult = typeMultiplier(move.type, def.types);

    // play the animation: the attacker moves and the visual layers start
    setMsg(`${aName} used ${move.name}!`);
    fxKey.current += 1;
    setFx({ key: fxKey.current, side: s, anim, miss: !hit });
    const motion = { id: anim.motion, duration: anim.duration };
    if (s === "player") setPMotion(motion);
    else setEMotion(motion);
    setAnimOf(s, "attack");

    // impact
    await sleep(anim.hitAt * 1000);
    if (!mounted.current) return "stop";
    let dealt = 0;
    if (hit && mult > 0) {
      const r = calcDamage(atk, move, def, {
        atkStage: stagesOf(s).current.atk,
        defStage: stagesOf(d).current.def,
        burned: statusOf(s) === "burn",
      });
      dealt = Math.min(r.damage, hpOf(d));
      setHpOf(d, hpOf(d) - dealt);
      setAnimOf(d, "hit");
    }
    await sleep((anim.duration - anim.hitAt) * 1000);
    if (!mounted.current) return "stop";
    setAnimOf(s, "idle");
    setAnimOf(d, "idle");
    setFx(null);

    if (!hit) return (await say(`${aName}'s attack missed!`)) ? "ok" : "stop";
    if (mult === 0) return (await say(`It doesn't affect ${dName}...`, 1400)) ? "ok" : "stop";
    if (mult > 1 && !(await say("It's super effective!"))) return "stop";
    if (mult < 1 && !(await say("It's not very effective..."))) return "stop";
    if (!(await applyEffects(s, move, dealt))) return "stop";
    return hpOf(d) <= 0 ? "fainted" : "ok";
  };

  /** Trainers pick the move that should hurt most; wild creatures pick at random. */
  const pickEnemyMove = (): Move => {
    const ms = enemy.moves;
    if (!trainer || Math.random() < 0.3) return ms[Math.floor(Math.random() * ms.length)];
    const me = current().c;
    const score = (m: Move) =>
      m.power * typeMultiplier(m.type, me.types) * (enemy.types.includes(m.type) ? 1.5 : 1) * (m.accuracy / 100);
    return ms.reduce((best, m) => (score(m) > score(best) ? m : best), ms[0]);
  };

  /* ------------------------- turn flow ------------------------- */

  const victory = async () => {
    setMsg(`${foe} fainted!`);
    setEAnim("faint");
    await sleep(1500);
    if (!mounted.current) return;

    const { m, sp, c } = current();
    const gain = expGain(enemy, !!trainer);
    const total = m.exp + gain;
    let lvl = m.level;
    let hp = m.hp;
    patchActive({ exp: total });
    setMsg(`${c.name} gained ${gain} EXP. points!`);
    await sleep(1700);
    if (!mounted.current) return;

    while (lvl < MAX_LEVEL && total >= expForLevel(lvl + 1)) {
      const oldMax = toCombatant(sp, lvl).maxHp;
      lvl += 1;
      const grown = toCombatant(sp, lvl);
      hp = Math.min(grown.maxHp, hp + (grown.maxHp - oldMax));
      patchActive({ level: lvl, hp });
      setMsg(`${c.name} grew to LV. ${lvl}!`);
      await sleep(1700);
      if (!mounted.current) return;
      for (const entry of sp.learnset) {
        if (entry.level === lvl) {
          setMsg(`${c.name} learned ${MOVES[entry.move].name}!`);
          await sleep(1700);
          if (!mounted.current) return;
        }
      }
    }
    finish("win");
  };

  const playerFainted = async () => {
    setMsg(`${current().c.name} fainted!`);
    setPAnim("faint");
    setStatusOf("player", null);
    setPStages(NO_STAGES);
    await sleep(1700);
    if (!mounted.current) return;
    if (!teamRef.current.some((m) => m.hp > 0)) {
      finish("lose");
      return;
    }
    setNote(undefined);
    setMsg("Choose your next creature!");
    setPhase("forced");
  };

  /** The end of a turn: burn / poison damage, then back to the menu. */
  const endOfTurn = async () => {
    const a = await residual("player");
    if (a === "stop") return;
    if (a === "fainted") return playerFainted();
    const b = await residual("enemy");
    if (b === "stop") return;
    if (b === "fainted") return victory();
    toMenu();
  };

  /** The enemy's half of the turn (after the player used a move, switched, healed or threw a ball). */
  const enemyTurn = async () => {
    const r = await performMove("enemy", pickEnemyMove());
    if (r === "stop") return;
    if (r === "fainted") return playerFainted();
    await endOfTurn();
  };

  const playerMove = async (move: Move) => {
    setPhase("busy");
    const r = await performMove("player", move);
    if (r === "stop") return;
    if (r === "fainted") return victory();
    await enemyTurn();
  };

  /** Sends team[i] out. Costs the turn unless it replaces a fainted creature. */
  const switchTo = async (i: number) => {
    const target = teamRef.current[i];
    const forced = phase === "forced";
    if (target.hp <= 0) return setNote("That creature has fainted!");
    if (i === activeRef.current && !forced) {
      return setNote(`${SPECIES[target.speciesId].name} is already out!`);
    }
    setNote(undefined);
    setPhase("busy");
    if (!forced) {
      setMsg(`Come back, ${current().c.name}!`);
      setPAnim("absorb");
      await sleep(800);
      if (!mounted.current) return;
    }
    setActive(i);
    setPStages(NO_STAGES);
    setMsg(`Go! ${current().c.name}!`);
    setPAnim("enter");
    await sleep(1100);
    if (!mounted.current) return;
    setPAnim("idle");
    if (forced) toMenu();
    else await enemyTurn();
  };

  const drinkPotion = async (i: number) => {
    const m = teamRef.current[i];
    const name = SPECIES[m.speciesId].name;
    if (invRef.current.potion <= 0) return setNote("No POTIONs left!");
    const healed = healMember(m, POTION_HEAL);
    if (!healed) {
      return setNote(m.hp <= 0 ? "A fainted creature can't be healed." : "It won't have any effect.");
    }
    setNote(undefined);
    setPhase("busy");
    setInv((v) => ({ ...v, potion: v.potion - 1 }));
    setTeam((t) => t.map((x, k) => (k === i ? healed : x)));
    setMsg(`You used a POTION on ${name}! It recovered ${healed.hp - m.hp} HP.`);
    await sleep(1600);
    if (!mounted.current) return;
    await enemyTurn();
  };

  const throwBall = async () => {
    if (trainer) return setNote("You can't catch another trainer's creature!");
    if (invRef.current.ball <= 0) return setNote("No BALLs left!");
    if (teamRef.current.length >= MAX_TEAM) return setNote("Your team is full!");
    setNote(undefined);
    setPhase("busy");
    setInv((v) => ({ ...v, ball: v.ball - 1 }));
    setMsg("You threw a BALL!");
    setBall("throw");
    await sleep(900);
    if (!mounted.current) return;

    setEAnim("absorb");
    setBall("shake");
    // low HP and a status condition (burned, frozen...) make it easier
    let chance = catchChance(enemy.speciesId, eHpRef.current, enemy.maxHp);
    if (eStatusRef.current) chance = Math.min(0.95, chance * 1.5);
    const caught = Math.random() < chance;
    const shakes = caught ? 3 : Math.floor(Math.random() * 3);
    await sleep(600);
    for (let i = 0; i < shakes; i++) {
      if (!mounted.current) return;
      setMsg(".".repeat(i + 1));
      await sleep(900);
    }
    if (!mounted.current) return;

    if (caught) {
      setBall("caught");
      setMsg(`Gotcha! ${enemy.name} was caught!`);
      await sleep(1900);
      if (!mounted.current) return;
      setTeam((t) => [
        ...t,
        {
          speciesId: enemy.speciesId,
          level: enemy.level,
          exp: expForLevel(enemy.level),
          hp: Math.max(1, eHpRef.current),
        },
      ]);
      finish("caught");
      return;
    }

    setBall("none");
    setEAnim("enter");
    setMsg(
      shakes === 0
        ? "Oh no! It broke free!"
        : shakes === 1
        ? "Aww! It appeared to be caught!"
        : "Shoot! It was so close too!"
    );
    await sleep(1400);
    if (!mounted.current) return;
    await enemyTurn();
  };

  const run = async () => {
    setPhase("busy");
    if (trainer) {
      setMsg("No! You can't run from a trainer battle!");
      await sleep(1500);
      if (mounted.current) toMenu();
      return;
    }
    setMsg("Got away safely!");
    await sleep(1000);
    if (mounted.current) finish("run");
  };

  const openPanel = (p: Phase) => {
    setNote(undefined);
    setPhase(p);
  };
  const chooseMenu = (i: number) => {
    setCursor(i);
    if (i === 0) setPhase("moves");
    else if (i === 1) openPanel("bag");
    else if (i === 2) openPanel("team");
    else run();
  };
  const chooseItem = (id: ItemId) => {
    if (id === "ball") throwBall();
    else if (invRef.current.potion <= 0) setNote("No POTIONs left!");
    else openPanel("potion");
  };

  /* ------------------------- input ------------------------- */

  const live = useRef({ phase, cursor, moveCursor, moves: player.moves });
  live.current = { phase, cursor, moveCursor, moves: player.moves };
  const actions = useRef({ playerMove, chooseMenu });
  actions.current = { playerMove, chooseMenu };

  // Keyboard / gamepad navigation of the main menu and the moves list
  // (bag, team and potion panels handle their own input).
  useEffect(
    () =>
      subscribe((raw) => {
        const b = raw === "start" ? "a" : raw;
        const s = live.current;
        if (s.phase === "menu") {
          const c = s.cursor;
          if (b === "left" && c % 2 === 1) setCursor(c - 1);
          else if (b === "right" && c % 2 === 0) setCursor(c + 1);
          else if (b === "up" && c >= 2) setCursor(c - 2);
          else if (b === "down" && c < 2) setCursor(c + 2);
          else if (b === "a") actions.current.chooseMenu(c);
        } else if (s.phase === "moves") {
          const i = s.moveCursor;
          const n = s.moves.length;
          if (b === "up" && i > 0) setMoveCursor(i - 1);
          else if (b === "down" && i + 1 < n) setMoveCursor(i + 1);
          else if (b === "b") setPhase("menu");
          else if (b === "a") actions.current.playerMove(s.moves[i]);
        }
      }),
    [subscribe]
  );

  const arrow = (selected: boolean) => (selected ? ">" : "\u00a0");
  const selectedMove = player.moves[Math.min(moveCursor, player.moves.length - 1)];
  const selectedEffect = effectLabel(effectOf(selectedMove));
  const stab = player.types.includes(selectedMove.type);

  return (
    <div className={`gb-battle${phase === "moves" ? " gb-moves-open" : ""}`}>
      {/* 3D view, rendered at game resolution and scaled up for the pixelated look */}
      <Canvas
        className="gb-battle-canvas"
        dpr={1 / scale}
        gl={{ antialias: false }}
        camera={{ position: [0, 2.6, 9.8], fov: BATTLE_FOV }}
      >
        <BattleScene
          player={player}
          enemy={enemy}
          pAnim={pAnim}
          eAnim={eAnim}
          ball={ball}
          fx={fx}
          pMotion={pMotion}
          eMotion={eMotion}
        />
      </Canvas>

      {/* Enemy info */}
      <div className="gb-box gb-box-enemy">
        <div className="gb-row">
          <span>{enemy.name}</span>
          <span className="gb-lv">
            {eStatus && <span className="gb-tag">{STATUS_TAG[eStatus]}</span>}Lv{enemy.level}
          </span>
        </div>
        <HpBar value={eHp} max={enemy.maxHp} />
        <div className="gb-types">{enemy.types.map(typeLabel).join("/")}</div>
      </div>

      {/* Player info */}
      <div className="gb-box gb-box-player">
        <div className="gb-row">
          <span>{player.name}</span>
          <span className="gb-lv">
            {pStatus && <span className="gb-tag">{STATUS_TAG[pStatus]}</span>}Lv{member.level}
          </span>
        </div>
        <HpBar value={member.hp} max={player.maxHp} />
        <div className="gb-hp-count">
          {member.hp}/{player.maxHp}
        </div>
        <div className="gb-exp">
          <span className="gb-hp-label">XP</span>
          <div className="gb-exp-track">
            <div
              className="gb-exp-fill"
              style={{ width: `${expProgress(member.level, member.exp) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dialog / menu box */}
      <div className="gb-box gb-dialog">
        {phase !== "moves" && <div className="gb-msg">{msg}</div>}

        {phase === "menu" && (
          <div className="gb-menu gb-menu-grid">
            {MENU.map((label, i) => (
              <button
                key={label}
                className="gb-menu-item"
                onPointerEnter={() => setCursor(i)}
                onClick={() => chooseMenu(i)}
              >
                {arrow(cursor === i)}
                {label}
              </button>
            ))}
          </div>
        )}

        {phase === "moves" && (
          <>
            <div className="gb-moves">
              {player.moves.map((m, i) => (
                <button
                  key={m.id}
                  className="gb-menu-item"
                  onPointerEnter={() => setMoveCursor(i)}
                  onClick={() => {
                    setMoveCursor(i);
                    playerMove(m);
                  }}
                >
                  {arrow(moveCursor === i)}
                  {m.name}
                </button>
              ))}
            </div>
            <div className="gb-move-info">
              <div>
                {typeLabel(selectedMove.type)}
                {stab ? "*" : ""}
              </div>
              <div>
                POW {selectedMove.power} ACC {selectedMove.accuracy}
              </div>
              <div>{selectedEffect || "\u00a0"}</div>
              <button className="gb-menu-item" onClick={() => setPhase("menu")}>
                {"<"}BACK
              </button>
            </div>
          </>
        )}
      </div>

      {/* Full-screen panels: bag, potion target, switching */}
      {phase === "bag" && (
        <BagPanel
          inventory={inv}
          note={note}
          subscribe={subscribe}
          onSelect={chooseItem}
          onBack={() => setPhase("menu")}
        />
      )}
      {phase === "potion" && (
        <TeamPanel
          title="USE POTION ON:"
          team={team}
          note={note}
          subscribe={subscribe}
          onSelect={drinkPotion}
          onBack={() => openPanel("bag")}
        />
      )}
      {phase === "team" && (
        <TeamPanel
          title="SWITCH TO:"
          team={team}
          marked={active}
          note={note}
          subscribe={subscribe}
          onSelect={switchTo}
          onBack={() => setPhase("menu")}
        />
      )}
      {phase === "forced" && (
        <TeamPanel
          title="CHOOSE NEXT:"
          team={team}
          marked={active}
          note={note}
          subscribe={subscribe}
          onSelect={switchTo}
        />
      )}
    </div>
  );
}