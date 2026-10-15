import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { DELTA, ENCOUNTER_RATE, NEW_GAME, STEP_TIME } from "../constants";
import { SPECIES } from "../data/species";
import { POTION_HEAL, STARTING_ITEMS } from "../items";
import { MAPS, npcToTalk, tileAt, trainerDir, triggeredTrainer, warpAt } from "../maps";
import {
  STARTER,
  createMember,
  evolutionOf,
  evolveMember,
  healMember,
  memberMaxHp,
  rollEncounter,
  toCombatant,
} from "../monsters";
import { createPlayerState } from "../player";
import { clearSave, loadSave, writeSave } from "../save";
import type {
  BattleResult,
  BattleSetup,
  Btn,
  Dir,
  DialogState,
  InputSubscribe,
  Inventory,
  Mode,
  Npc,
  PartyMember,
  Respawn,
  Trainer,
  Walker,
} from "../types";

/**
 * All game rules and state: current map, team, badges, dialogs, battles and
 * saving. The UI (PokemonPage) just renders what this hook returns.
 *
 * Saved to localStorage (save.ts): map, position, team, badges, defeated
 * trainers and the respawn point. Saving happens on every step, after
 * battles, when healing and when the page is closed.
 */
export function useGame(held: MutableRefObject<Set<Btn>>, subscribe: InputSubscribe) {
  const [mode, setMode] = useState<Mode>("title");
  const [mapId, setMapId] = useState(NEW_GAME.mapId);
  const [team, setTeamState] = useState<PartyMember[]>(() => [
    createMember(STARTER.speciesId, STARTER.level),
  ]);
  const [inventory, setInventoryState] = useState<Inventory>({ ...STARTING_ITEMS });
  const [badges, setBadgesState] = useState<string[]>([]);
  const [battle, setBattleState] = useState<BattleSetup | null>(null);
  const [battleId, setBattleId] = useState(0);
  const [dialog, setDialogState] = useState<DialogState | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const [healing, setHealing] = useState(false);
  /** The evolution cutscene that is playing: which team member and into what. */
  const [evolution, setEvolution] = useState<{ index: number; toId: string } | null>(null);
  const [cutscene, setCutscene] = useState(false);
  /** A trainer is about to battle you: from the "!" (or talking to it) until the battle starts. */
  const [trainerSpotted, setTrainerSpotted] = useState(false);
  /** A battle was won: until the player can walk again (EXP, evolutions, the trainer's last words...). */
  const [victory, setVictory] = useState<"wild" | "trainer" | null>(null);
  const [hasSave] = useState(() => loadSave() !== null);

  // Mirrors of the state for callbacks that must stay stable (game loop)
  const player = useRef(createPlayerState(NEW_GAME.x, NEW_GAME.y, NEW_GAME.dir));
  const mapIdRef = useRef(NEW_GAME.mapId);
  const teamRef = useRef(team);
  const invRef = useRef<Inventory>({ ...STARTING_ITEMS });
  const badgesRef = useRef<string[]>([]);
  const defeatedRef = useRef<string[]>([]);
  const respawnRef = useRef<Respawn>({ mapId: NEW_GAME.mapId, x: NEW_GAME.x, y: NEW_GAME.y });
  const battleRef = useRef<BattleSetup | null>(null);
  const dialogRef = useRef<DialogState | null>(null);
  const healTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkers = useRef<Record<string, Walker>>({}); // trainers moved by a cutscene
  const evoQueueRef = useRef<number[]>([]); // team members waiting to evolve
  const evolutionRef = useRef<{ index: number; toId: string } | null>(null);
  const afterEvoRef = useRef<(() => void) | null>(null); // runs when the evolutions are over
  const mountedRef = useRef(true);
  const startedRef = useRef(false); // never overwrite a save before the game starts

  const setTeam = useCallback((t: PartyMember[]) => {
    teamRef.current = t;
    setTeamState(t);
  }, []);
  const setInventory = useCallback((v: Inventory) => {
    invRef.current = v;
    setInventoryState(v);
  }, []);
  const setBadges = useCallback((b: string[]) => {
    badgesRef.current = b;
    setBadgesState(b);
  }, []);
  const setDialog = useCallback((d: DialogState | null) => {
    dialogRef.current = d;
    setDialogState(d);
  }, []);

  /* ---------- saving ---------- */

  const persist = useCallback(() => {
    if (!startedRef.current) return;
    const p = player.current;
    writeSave({
      version: 1,
      mapId: mapIdRef.current,
      x: p.x,
      y: p.y,
      dir: p.dir,
      team: teamRef.current,
      inventory: invRef.current,
      badges: badgesRef.current,
      defeated: defeatedRef.current,
      respawn: respawnRef.current,
    });
  }, []);

  useEffect(() => {
    const save = () => persist();
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", save);
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", save);
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  /* ---------- helpers ---------- */

  const openDialog = useCallback(
    (lines: string[], onDone?: () => void, choices?: DialogState["choices"]) =>
      setDialog({ lines, index: 0, onDone, choices }),
    [setDialog]
  );

  /** Answer to the YES / NO choice on the last line. */
  const chooseDialog = useCallback(
    (i: number) => {
      const d = dialogRef.current;
      if (!d?.choices?.[i]) return;
      setDialog(null);
      d.choices[i].run();
    },
    [setDialog]
  );

  const advanceDialog = useCallback(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (d.index + 1 < d.lines.length) {
      setDialog({ ...d, index: d.index + 1 });
    } else {
      setDialog(null);
      d.onDone?.();
    }
  }, [setDialog]);

  const goToMap = useCallback((id: string, x: number, y: number, dir?: Dir) => {
    mapIdRef.current = id;
    const p = player.current;
    p.x = p.tx = x;
    p.y = p.ty = y;
    p.moving = false;
    p.progress = 0;
    if (dir) p.dir = dir;
    walkers.current = {};
    setMapId(id);
    setBanner({ text: MAPS[id].name, key: Date.now() });
    setFadeKey((k) => k + 1);
  }, []);

  const clearBanner = useCallback(() => setBanner(null), []);

  const beginBattle = useCallback((setup: BattleSetup) => {
    battleRef.current = setup;
    setTrainerSpotted(false);
    setVictory(null);
    setBanner(null);
    setBattleState(setup);
    setBattleId((i) => i + 1);
    setMode("transition");
  }, []);

  const startTrainer = useCallback(
    (t: Trainer) => {
      setTrainerSpotted(true);
      openDialog(t.intro, () =>
        beginBattle({ enemy: toCombatant(SPECIES[t.speciesId], t.level), trainer: t })
      );
    },
    [openDialog, beginBattle]
  );

  /**
   * A trainer spotted you: you stop, a "!" appears, it walks up to you,
   * says its line and the battle starts.
   */
  const approachTrainer = useCallback(
    async (t: Trainer) => {
      const alive = () => mountedRef.current;
      const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      /** Calls `fn(0..1)` every frame for `ms` milliseconds. */
      const tween = (ms: number, fn: (k: number) => void) =>
        new Promise<void>((resolve) => {
          const t0 = performance.now();
          const step = (now: number) => {
            const k = Math.min(1, (now - t0) / ms);
            fn(k);
            if (k < 1 && alive()) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });

      const p = player.current;
      const dir = trainerDir(t);
      const [dx, dy] = DELTA[dir];
      // how many tiles away you are, if you stand right on its line of sight
      const dist = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
      const onLine = !t.trigger && p.x === t.x + dx * dist && p.y === t.y + dy * dist;
      const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

      setCutscene(true);
      setTrainerSpotted(true);
      walkers.current[t.id] = { x: t.x, y: t.y, dir, alert: true };
      await wait(750); // "!"
      if (!alive()) return;
      walkers.current[t.id].alert = false;

      if (onLine) {
        for (let i = 0; i < dist - 1; i++) {
          await tween(STEP_TIME * 1000, (k) => {
            walkers.current[t.id] = {
              x: t.x + dx * (i + k),
              y: t.y + dy * (i + k),
              dir,
              stride: (Math.floor(k * 2) + i) % 2, // alternate legs (built-in sprite)
              moving: true, // walk cycle for sprite sheets
              progress: k,
              parity: i % 2,
            };
          });
          if (!alive()) return;
        }
        walkers.current[t.id] = { x: t.x + dx * (dist - 1), y: t.y + dy * (dist - 1), dir };
      }
      p.dir = OPPOSITE[dir]; // you turn to face it
      await wait(250);
      if (!alive()) return;
      setCutscene(false);
      startTrainer(t);
    },
    [startTrainer]
  );

  /** Talking to the nurse: ask, play the healing machine, heal, and remember this center. */
  const talkToNurse = useCallback(
    (npc: Npc) => {
      const spot = npc.talkFrom?.[0];
      const heal = () => {
        openDialog(["OK, we'll take your team for a moment."], () => {
          setHealing(true);
          healTimer.current = setTimeout(() => {
            healTimer.current = null;
            setTeam(teamRef.current.map((m) => ({ ...m, hp: memberMaxHp(m) })));
            if (spot) {
              respawnRef.current = { mapId: mapIdRef.current, x: spot.x, y: spot.y, dir: spot.dir };
            }
            setHealing(false);
            persist();
            openDialog([
              "Thank you for waiting.",
              "Your team is back to full health!",
              "We hope to see you again!",
            ]);
          }, 2400);
        });
      };
      openDialog(
        [
          "Welcome to our HEAL CENTER!",
          "We restore your creatures to full health.",
          "Shall we heal your team?",
        ],
        undefined,
        [
          { label: "YES", run: heal },
          { label: "NO", run: () => openDialog(["We hope to see you again!"]) },
        ]
      );
    },
    [openDialog, setTeam, persist]
  );

  /** Pressing A: talk to whoever you are facing. */
  const interact = useCallback(() => {
    const p = player.current;
    if (p.moving) return;
    const npc = npcToTalk(MAPS[mapIdRef.current], p.x, p.y, p.dir);
    if (!npc) return;
    if (npc.kind === "nurse") talkToNurse(npc);
    else openDialog(npc.lines ?? ["..."]);
  }, [talkToNurse, openDialog]);

  /* ---------- game loop callback ---------- */

  /** Called by the overworld after every step. Returns true if the loop must stop. */
  const handleStep = useCallback(
    (x: number, y: number): boolean => {
      const map = MAPS[mapIdRef.current];

      const warp = warpAt(map, x, y);
      if (warp) {
        goToMap(warp.to, warp.toX, warp.toY);
        persist();
        return true;
      }

      const trainer = triggeredTrainer(map, x, y, defeatedRef.current);
      if (trainer) {
        void approachTrainer(trainer);
        return true;
      }

      if (tileAt(map, x, y) === "G" && map.encounters && Math.random() < ENCOUNTER_RATE) {
        const enemy = rollEncounter(map.encounters);
        if (enemy) {
          beginBattle({ enemy });
          return true;
        }
      }

      persist();
      return false;
    },
    [goToMap, persist, approachTrainer, beginBattle]
  );

  /* ---------- starting / continuing ---------- */

  const startNew = useCallback(() => {
    clearSave();
    startedRef.current = true;
    defeatedRef.current = [];
    respawnRef.current = { mapId: NEW_GAME.mapId, x: NEW_GAME.x, y: NEW_GAME.y };
    setTeam([createMember(STARTER.speciesId, STARTER.level)]);
    setInventory({ ...STARTING_ITEMS });
    setBadges([]);
    goToMap(NEW_GAME.mapId, NEW_GAME.x, NEW_GAME.y, NEW_GAME.dir);
    persist();
    setMode("overworld");
  }, [setTeam, setInventory, setBadges, goToMap, persist]);

  const continueGame = useCallback(() => {
    const s = loadSave();
    if (!s) {
      startNew();
      return;
    }
    startedRef.current = true;
    defeatedRef.current = s.defeated;
    respawnRef.current = s.respawn;
    setTeam(s.team);
    setInventory(s.inventory);
    setBadges(s.badges);
    goToMap(s.mapId, s.x, s.y, s.dir);
    setMode("overworld");
  }, [startNew, setTeam, setInventory, setBadges, goToMap]);

  /* ---------- end of a battle ---------- */

  /** Starts the next evolution of the queue, or goes back to the overworld when it is empty. */
  const nextEvolution = useCallback(() => {
    while (evoQueueRef.current.length > 0) {
      const index = evoQueueRef.current.shift()!;
      const m = teamRef.current[index];
      const toId = m ? evolutionOf(m) : null;
      if (toId) {
        evolutionRef.current = { index, toId };
        setEvolution({ index, toId });
        return;
      }
    }
    evolutionRef.current = null;
    setEvolution(null);
    setMode("overworld");
    persist();
    const after = afterEvoRef.current;
    afterEvoRef.current = null;
    after?.();
  }, [persist]);

  /** The evolution cutscene ended (`evolved` is false if the player cancelled it). */
  const finishEvolution = useCallback(
    (evolved: boolean) => {
      const evo = evolutionRef.current;
      if (evo && evolved) {
        setTeam(teamRef.current.map((m, i) => (i === evo.index ? evolveMember(m, evo.toId) : m)));
      }
      persist();
      nextEvolution();
    },
    [setTeam, persist, nextEvolution]
  );

  const finishBattle = useCallback(
    (result: BattleResult, newTeam: PartyMember[], newInventory: Inventory) => {
      const trainer = battleRef.current?.trainer;
      walkers.current = {}; // the trainer goes back to its post
      setInventory(newInventory);
      let after: (() => void) | null = null;
      let queue: number[] = [];

      if (result === "lose") {
        setTeam(newTeam.map((m) => ({ ...m, hp: memberMaxHp(m) })));
        const r = respawnRef.current;
        goToMap(r.mapId, r.x, r.y, r.dir ?? "down");
        after = () =>
          openDialog([
            "You have no healthy creatures left!",
            "You hurried back to the last HEAL CENTER.",
          ]);
      } else {
        // creatures that gained a level and reached their evolution level evolve now
        const before = teamRef.current;
        queue = newTeam
          .map((m, i) => (before[i] && m.level > before[i].level && evolutionOf(m) ? i : -1))
          .filter((i) => i >= 0);
        setTeam(newTeam);
        if (result === "win" && trainer) {
          defeatedRef.current = [...defeatedRef.current, trainer.id];
          const lines = [...trainer.win];
          if (trainer.badge && !badgesRef.current.includes(trainer.badge)) {
            setBadges([...badgesRef.current, trainer.badge]);
            lines.push(`You received the ${trainer.badge}!`);
          }
          after = () => openDialog(lines);
        }
      }
      persist();

      if (queue.length > 0) {
        // evolutions first, then the trainer's words
        evoQueueRef.current = queue;
        afterEvoRef.current = after;
        setMode("evolution");
        nextEvolution();
      } else {
        setMode("overworld");
        after?.();
      }
    },
    [setTeam, setInventory, setBadges, goToMap, openDialog, persist, nextEvolution]
  );

  /* ---------- menu (team order, potions) ---------- */

  const closeMenu = useCallback(() => {
    setMode("overworld");
    persist();
  }, [persist]);

  const swapTeam = useCallback(
    (i: number, j: number) => {
      const t = [...teamRef.current];
      if (!t[i] || !t[j]) return;
      [t[i], t[j]] = [t[j], t[i]];
      setTeam(t);
      persist();
    },
    [setTeam, persist]
  );

  /** Uses a potion on team[i] outside of battle. */
  const healWithPotion = useCallback(
    (i: number): { ok: boolean; msg: string } => {
      const m = teamRef.current[i];
      if (!m) return { ok: false, msg: "" };
      if (invRef.current.potion <= 0) return { ok: false, msg: "No POTIONs left!" };
      const healed = healMember(m, POTION_HEAL);
      if (!healed) {
        return {
          ok: false,
          msg: m.hp <= 0 ? "A fainted creature can't be healed." : "It won't have any effect.",
        };
      }
      setInventory({ ...invRef.current, potion: invRef.current.potion - 1 });
      setTeam(teamRef.current.map((x, k) => (k === i ? healed : x)));
      persist();
      return { ok: true, msg: `${SPECIES[m.speciesId].name} recovered ${healed.hp - m.hp} HP!` };
    },
    [setInventory, setTeam, persist]
  );

  // While walking: A talks to what you face, Start opens the menu
  useEffect(() => {
    if (mode !== "overworld" || dialog || healing || cutscene) return;
    return subscribe((b) => {
      if (b === "a") interact();
      else if (b === "start") setMode("menu");
    });
  }, [mode, dialog, healing, cutscene, subscribe, interact]);

  // Stop timers and cutscenes if the page closes
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (healTimer.current) clearTimeout(healTimer.current);
    };
  }, []);

  // Encounter flash -> battle (the flash animation lasts 1.1s, see .gb-flash in pokemon.css)
  useEffect(() => {
    if (mode !== "transition") return;
    const id = setTimeout(() => setMode("battle"), 1100);
    return () => clearTimeout(id);
  }, [mode]);

  // Buttons held on screen disappear with their overlay, so release them
  // whenever the overworld is not in control (avoids auto-walking afterwards).
  useEffect(() => {
    if (
      mode === "transition" ||
      mode === "battle" ||
      mode === "menu" ||
      mode === "evolution" ||
      dialog ||
      cutscene
    ) {
      held.current.clear();
    }
  }, [mode, dialog, cutscene, held]);

  // the victory is over once the player is free to walk again
  useEffect(() => {
    if (victory && mode === "overworld" && !dialog) setVictory(null);
  }, [victory, mode, dialog]);

  /** The battle was won, before its EXP and level ups are shown. */
  const winBattle = useCallback(() => {
    setVictory(battleRef.current?.trainer ? "trainer" : "wild");
  }, []);

  return {
    mode,
    mapId,
    map: MAPS[mapId],
    team,
    inventory,
    badges,
    battle,
    battleId,
    dialog,
    banner,
    fadeKey,
    healing,
    cutscene,
    trainerSpotted,
    victory,
    winBattle,
    evolution,
    hasSave,
    player,
    /** True while the player can walk. */
    active: mode === "overworld" && !dialog && !healing && !cutscene,
    /** Keep the overworld repainting while a trainer walks up to you. */
    animating: cutscene,
    walkers,
    handleStep,
    startNew,
    continueGame,
    finishBattle,
    finishEvolution,
    closeMenu,
    swapTeam,
    healWithPotion,
    advanceDialog,
    chooseDialog,
    clearBanner,
  };
}