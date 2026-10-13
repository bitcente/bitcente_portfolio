import { useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import type { Anim, Combatant, V3 } from "../../types";
import { Ball } from "./Ball";
import type { BallState } from "./Ball";
import { CameraRig } from "./CameraRig";
import { Creature } from "./Creature";
import { MoveFx, ScreenFlash } from "./MoveFx";
import type { FxShared } from "./MoveFx";
import type { FxState, MotionState } from "../../fx/types";
import { Tufts } from "./Tufts";

export const BATTLE_FOV = 36;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Positions the creatures and camera for the current screen shape:
 * side by side on wide screens, stacked diagonally (and further away)
 * on tall / portrait screens, so both always fit.
 */
function useBattleLayout() {
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const key = Math.max(0.2, Math.round(aspect * 50) / 50); // stable under tiny resizes

  return useMemo(() => {
    const t = Math.min(1, Math.max(0, (key - 0.5) / (1.3 - 0.5))); // 0 = portrait, 1 = wide
    const player: V3 = [lerp(-0.9, -1.7, t), 0, lerp(2.4, 1.4, t)];
    const enemy: V3 = [lerp(0.9, 1.9, t), 0, lerp(-3.2, -1.9, t)];
    const halfSpan = Math.max(Math.abs(player[0]), Math.abs(enemy[0])) + 1.3;
    const tanHalfFov = Math.tan(((BATTLE_FOV / 2) * Math.PI) / 180);
    const distance = Math.max(6.6, halfSpan / (tanHalfFov * key));
    return { player, enemy, distance, lookZ: (player[2] + enemy[2]) / 2 };
  }, [key]);
}

interface Props {
  player: Combatant;
  enemy: Combatant;
  pAnim: Anim;
  eAnim: Anim;
  ball?: BallState;
  /** The attack being played (visual layers). */
  fx?: FxState | null;
  /** How each creature moves when it attacks. */
  pMotion?: MotionState;
  eMotion?: MotionState;
}

export function BattleScene({
  player,
  enemy,
  pAnim,
  eAnim,
  ball = "none",
  fx = null,
  pMotion,
  eMotion,
}: Props) {
  const layout = useBattleLayout();
  const shared = useRef<FxShared>({ shake: 0, flash: 0, flashColor: "#ffffff" });

  return (
    <>
      <color attach="background" args={["#f4f4f4"]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 5]} intensity={1.8} />
      <CameraRig distance={layout.distance} lookZ={layout.lookZ} shared={shared} />

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.13}>
        <circleGeometry args={[24, 32]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>

      {/* platforms */}
      {[layout.player, layout.enemy].map((p, i) => (
        <mesh key={i} position={[p[0], -0.06, p[2]]}>
          <cylinderGeometry args={[1.5, 1.7, 0.12, 24]} />
          <meshStandardMaterial color="#b4b4b4" flatShading />
        </mesh>
      ))}

      <Tufts />
      <ContactShadows
        position={[0, -0.05, 0]}
        opacity={0.55}
        scale={16}
        blur={1.4}
        far={2.5}
        resolution={256}
      />

      <Creature
        species={enemy}
        anim={eAnim}
        position={layout.enemy}
        lookAt={layout.player}
        scale={enemy.size}
        motion={eMotion}
      />
      <Creature
        species={player}
        anim={pAnim}
        position={layout.player}
        lookAt={layout.enemy}
        scale={1.15 * player.size}
        motion={pMotion}
      />
      <Ball state={ball} from={layout.player} to={layout.enemy} />
      <MoveFx fx={fx} playerPos={layout.player} enemyPos={layout.enemy} shared={shared} />
      <ScreenFlash shared={shared} />
    </>
  );
}