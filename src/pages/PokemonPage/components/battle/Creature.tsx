import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { MOTIONS } from "../../fx/motions";
import type { MotionState } from "../../fx/types";
import type { Anim, Combatant, V3 } from "../../types";
import { CreatureModel } from "./CreatureModel";

interface Props {
  species: Combatant;
  anim: Anim;
  position: V3;
  lookAt: V3;
  scale?: number;
  /** How the body moves during an "attack" animation (set by the move being used). */
  motion?: MotionState;
}

/** A creature standing at `position`, facing `lookAt`, driven by an `Anim` state. */
export function Creature({ species, anim, position, lookAt, scale = 1, motion }: Props) {
  const inner = useRef<THREE.Group>(null!);
  const clock = useThree((s) => s.clock);
  const start = useRef(0);

  // restart the animation timer whenever the animation changes
  useEffect(() => {
    start.current = clock.elapsedTime;
  }, [anim, clock]);

  const facing = useMemo(() => {
    const dx = lookAt[0] - position[0];
    const dz = lookAt[2] - position[2];
    const l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l, yaw: Math.atan2(dx, dz) };
  }, [position, lookAt]);

  useFrame(() => {
    const t = clock.elapsedTime;
    const a = t - start.current;
    let ox = 0;
    let oy = Math.sin(t * 2.2) * 0.04;
    let oz = 0;
    let s = 1;
    let yaw = 0;
    let pitch = 0;
    let visible = true;

    switch (anim) {
      case "hidden":
        visible = false;
        break;
      case "enter": {
        const k = Math.min(1, a / 0.7);
        s = Math.max(0.001, k);
        oy += (1 - k) * 3;
        break;
      }
      case "attack": {
        const m = MOTIONS[motion?.id ?? "lunge"](Math.min(1, a / (motion?.duration ?? 0.5)));
        ox = facing.x * m.forward;
        oz = facing.z * m.forward;
        oy += m.y;
        yaw = m.yaw;
        pitch = m.pitch;
        s = m.scale;
        break;
      }
      case "hit": {
        const k = Math.min(1, a / 0.7);
        ox = Math.sin(a * 70) * 0.14 * (1 - k);
        visible = k >= 1 || Math.floor(a * 14) % 2 === 0;
        break;
      }
      case "absorb": {
        // shrinks into the ball (or back to the trainer's ball when switching)
        const k = Math.min(1, a / 0.35);
        s = Math.max(0.001, 1 - k);
        oy += k * 0.6;
        visible = k < 1;
        break;
      }
      case "faint": {
        const k = Math.min(1, a / 0.9);
        oy -= k * 1.6;
        s = Math.max(0.001, 1 - k * 0.9);
        visible = k < 1;
        break;
      }
    }

    inner.current.position.set(ox, oy, oz);
    inner.current.rotation.set(pitch, yaw, 0);
    inner.current.scale.setScalar(s);
    inner.current.visible = visible;
  });

  return (
    <group position={position}>
      <group ref={inner}>
        <group rotation-y={facing.yaw} scale={scale}>
          <CreatureModel
            kind={species.kind}
            main={species.main}
            accent={species.accent}
            tail={species.tail}
            stage={species.stage}
          />
        </group>
      </group>
    </group>
  );
}