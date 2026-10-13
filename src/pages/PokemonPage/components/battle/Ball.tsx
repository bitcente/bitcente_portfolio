import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import type { V3 } from "../../types";

export type BallState = "none" | "throw" | "shake" | "caught";

interface Props {
  state: BallState;
  /** Where it is thrown from (the player's creature). */
  from: V3;
  /** Where it lands (the wild creature). */
  to: V3;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const R = 0.4;

/** Capture ball: flies in an arc, wobbles on the ground and stays shut when it catches. */
export function Ball({ state, from, to }: Props) {
  const group = useRef<THREE.Group>(null!);
  const clock = useThree((s) => s.clock);
  const start = useRef(0);

  useEffect(() => {
    start.current = clock.elapsedTime;
  }, [state, clock]);

  useFrame(() => {
    const g = group.current;
    const a = clock.elapsedTime - start.current;
    g.visible = state !== "none";
    if (state === "throw") {
      const k = Math.min(1, a / 0.8);
      g.position.set(
        lerp(from[0], to[0], k),
        lerp(0.9, R, k) + Math.sin(k * Math.PI) * 1.8,
        lerp(from[2], to[2], k)
      );
      g.rotation.set(0, 0, k * Math.PI * 6);
    } else if (state === "shake") {
      g.position.set(to[0], R, to[2]);
      g.rotation.set(0, 0, Math.sin(a * 7) * 0.5);
    } else if (state === "caught") {
      g.position.set(to[0], R, to[2]);
      g.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh>
        <sphereGeometry args={[R, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c83232" flatShading />
      </mesh>
      <mesh>
        <sphereGeometry args={[R, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#f4f4f4" flatShading />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[R, 0.045, 6, 18]} />
        <meshStandardMaterial color="#111111" flatShading />
      </mesh>
      <mesh position={[0, 0, R]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color="#f4f4f4" flatShading />
      </mesh>
    </group>
  );
}