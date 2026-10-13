import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SPECIES } from "../../data/species";
import { EVOLUTION_ANIM } from "../../fx/recipes";
import type { FxState } from "../../fx/types";
import { toCombatant } from "../../monsters";
import type { InputSubscribe, PartyMember } from "../../types";
import { sleep } from "../../utils";
import { EvolutionScene } from "./EvolutionScene";
import type { EvoStage } from "./EvolutionScene";

interface Props {
  member: PartyMember;
  /** Species it turns into. */
  toId: string;
  /** Screen scale, used to render the 3D view at game resolution (pixelated look). */
  scale: number;
  subscribe: InputSubscribe;
  /** `evolved` is false if the player cancelled. */
  onFinish: (evolved: boolean) => void;
}

/**
 * The evolution cutscene:
 *   "What? X is evolving!"  ->  X dances  ->  light and dust cover it  ->
 *   flash, the dust blows away and the new form appears  ->  "Congratulations!"
 * B (or the CANCEL button) stops it until the dust has covered the creature.
 */
export function Evolution({ member, toId, scale, subscribe, onFinish }: Props) {
  const from = useMemo(() => toCombatant(SPECIES[member.speciesId], member.level), [member]);
  const to = useMemo(() => toCombatant(SPECIES[toId], member.level), [toId, member.level]);

  const [stage, setStage] = useState<EvoStage>("intro");
  const [showNew, setShowNew] = useState(false);
  const [fx, setFx] = useState<FxState | null>(null);
  const [msg, setMsg] = useState(`What? ${from.name} is evolving!`);
  const [canCancel, setCanCancel] = useState(true);
  const [ready, setReady] = useState(false); // "Congratulations!" is on screen

  const mounted = useRef(true);
  const stopped = useRef(false); // cancelled
  const finished = useRef(false);
  const live = useRef({ canCancel, ready });
  live.current = { canCancel, ready };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const finish = (evolved: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(evolved);
  };

  const cancel = () => {
    if (!live.current.canCancel || stopped.current) return;
    stopped.current = true;
    setCanCancel(false);
    setFx(null);
    setStage("done");
    setMsg(`Huh? ${from.name} stopped evolving!`);
    setTimeout(() => {
      if (mounted.current) finish(false);
    }, 1700);
  };

  // The cutscene timeline
  useEffect(() => {
    let cancelled = false;
    const alive = () => !cancelled && !stopped.current && mounted.current;
    (async () => {
      await sleep(1800);
      if (!alive()) return;
      setStage("dance");
      await sleep(2200);
      if (!alive()) return;

      // light and dust cover the creature (3 s), then the flash hides the swap
      setStage("cover");
      setFx({ key: 1, side: "player", anim: EVOLUTION_ANIM, miss: false });
      await sleep(EVOLUTION_ANIM.hitAt * 1000);
      if (!alive()) return;
      setCanCancel(false);
      setShowNew(true);
      setStage("reveal");
      await sleep((EVOLUTION_ANIM.duration - EVOLUTION_ANIM.hitAt) * 1000);
      if (!alive()) return;

      setFx(null);
      setStage("done");
      setMsg(`Congratulations! ${from.name} evolved into ${to.name}!`);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B cancels; once it is over, A / B / Start close the cutscene
  useEffect(
    () =>
      subscribe((b) => {
        if (live.current.ready) {
          if (b === "a" || b === "b" || b === "start") finish(true);
        } else if (b === "b") cancel();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribe]
  );

  return (
    <div className="gb-battle gb-evolution">
      <Canvas
        className="gb-battle-canvas"
        dpr={1 / scale}
        gl={{ antialias: false }}
        camera={{ position: [0, 1.6, 5.6], fov: 36 }}
      >
        <EvolutionScene stage={stage} showNew={showNew} from={from} to={to} fx={fx} />
      </Canvas>

      {canCancel && (
        <button className="gb-evo-cancel" onClick={cancel}>
          B: CANCEL
        </button>
      )}

      <div className="gb-box gb-dialog" onClick={ready ? () => finish(true) : undefined}>
        <div className="gb-msg">{msg}</div>
        {ready && <span className="gb-more gb-blink">▼</span>}
      </div>
    </div>
  );
}