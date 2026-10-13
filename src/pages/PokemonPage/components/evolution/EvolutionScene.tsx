import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import type { FxState } from "../../fx/types";
import type { Combatant, V3 } from "../../types";
import { CreatureModel } from "../battle/CreatureModel";
import { MoveFx, ScreenFlash } from "../battle/MoveFx";
import type { FxShared } from "../battle/MoveFx";

/**
 * intro  - the creature drops in
 * dance  - it hops and wiggles
 * cover  - light and dust gather until it is covered (the effects play)
 * reveal - the dust is blown away and the new form pops out
 * done   - the new form stands there
 */
export type EvoStage = "intro" | "dance" | "cover" | "reveal" | "done";

const POS: V3 = [0, 0, 0];
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface CreatureProps {
  c: Combatant;
  role: "old" | "new";
  stage: EvoStage;
  visible: boolean;
}

/** One of the two forms. The old one dances and shakes; the new one pops out. */
function EvoCreature({ c, role, stage, visible }: CreatureProps) {
  const group = useRef<THREE.Group>(null!);
  const clock = useThree((s) => s.clock);
  const start = useRef(0);

  useEffect(() => {
    start.current = clock.elapsedTime;
  }, [stage, visible, clock]);

  useFrame(() => {
    const g = group.current;
    g.visible = visible;
    if (!visible) return;
    const t = clock.elapsedTime;
    const a = t - start.current;
    let y = Math.sin(t * 2.2) * 0.04;
    let yaw = 0;
    let s = 1;

    if (role === "old") {
      if (stage === "intro") {
        const k = Math.min(1, a / 0.7);
        s = Math.max(0.001, k);
        y += (1 - k) * 3;
      } else if (stage === "dance") {
        y += Math.abs(Math.sin(a * 6)) * 0.45;
        yaw = Math.sin(a * 4) * 0.5;
        s = 1 + 0.05 * Math.sin(a * 12);
      } else if (stage === "cover") {
        // shakes harder and harder while the light builds up
        const p = Math.min(1, a / 3);
        y += Math.abs(Math.sin(a * 9)) * 0.3 * (1 - p * 0.4);
        yaw = Math.sin(a * 16) * (0.15 + 0.25 * p);
        s = 1 + 0.1 * Math.sin(a * 14) + 0.12 * p;
      }
    } else {
      // the new form pops out of the dust, spinning
      const k = Math.min(1, a / 1.2);
      s = 0.25 + 0.75 * easeOutBack(k);
      y += (1 - k) * 0.4;
      yaw = (1 - k) * Math.PI * 2;
    }

    g.position.set(0, y, 0);
    g.rotation.y = yaw;
    g.scale.setScalar(Math.max(0.001, s));
  });

  return (
    <group ref={group} visible={false}>
      <group rotation-y={0.35} scale={c.size}>
        <CreatureModel kind={c.kind} main={c.main} accent={c.accent} tail={c.tail} stage={c.stage} />
      </group>
    </group>
  );
}

/** Slow dolly-in while the effect builds, a little shake on the big moments. */
function EvoCamera({ stage, shared }: { stage: EvoStage; shared: MutableRefObject<FxShared> }) {
  const camera = useThree((s) => s.camera);
  const clock = useThree((s) => s.clock);
  const start = useRef(0);
  useEffect(() => {
    start.current = clock.elapsedTime;
  }, [stage, clock]);

  useFrame(() => {
    const t = clock.elapsedTime;
    const a = t - start.current;
    const dolly =
      stage === "cover"
        ? easeOut(Math.min(1, a / 3)) * 0.9
        : stage === "reveal"
        ? 0.9 - Math.min(1, a / 1.5) * 0.5
        : stage === "done"
        ? 0.4
        : 0;
    const sh = shared.current.shake;
    shared.current.shake = 0;
    camera.position.set(
      Math.sin(t * 0.3) * 0.4 + (sh > 0.001 ? (Math.random() - 0.5) * sh * 0.3 : 0),
      1.6 + (sh > 0.001 ? (Math.random() - 0.5) * sh * 0.3 : 0),
      5.6 - dolly
    );
    camera.lookAt(0, 0.9, 0);
  });
  return null;
}

interface Props {
  stage: EvoStage;
  /** The new form is on stage (the old one is gone). */
  showNew: boolean;
  from: Combatant;
  to: Combatant;
  /** The dust and lights (fx/recipes.ts: EVOLUTION_ANIM). */
  fx: FxState | null;
}

/**
 * The evolution stage: a dark background so the light stands out, a round
 * platform and the creature in the middle. The dust, rays, rings and flash
 * come from the same effect engine as the attacks (MoveFx).
 */
export function EvolutionScene({ stage, showNew, from, to, fx }: Props) {
  const shared = useRef<FxShared>({ shake: 0, flash: 0, flashColor: "#ffffff" });
  return (
    <>
      <color attach="background" args={["#141414"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 6, 4]} intensity={1.6} />
      <EvoCamera stage={stage} shared={shared} />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.13}>
        <circleGeometry args={[14, 32]} />
        <meshStandardMaterial color="#262626" />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[1.7, 1.9, 0.12, 28]} />
        <meshStandardMaterial color="#8a8a8a" flatShading />
      </mesh>

      <EvoCreature c={from} role="old" stage={stage} visible={!showNew} />
      <EvoCreature c={to} role="new" stage={stage} visible={showNew} />

      <MoveFx fx={fx} playerPos={POS} enemyPos={POS} shared={shared} />
      <ScreenFlash shared={shared} />
    </>
  );
}