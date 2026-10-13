import { useMemo } from "react";

/** Decorative grass cones scattered behind the battle platforms. */
export function Tufts() {
  const items = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const a = Math.PI * (1 + i / 59);
        const r = 3.5 + (((i * 37) % 50) / 50) * 6;
        const h = 0.4 + ((i * 13) % 10) / 20;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r - 1, h };
      }),
    []
  );

  return (
    <>
      {items.map((g, i) => (
        <mesh key={i} position={[g.x, g.h / 2 - 0.1, g.z]}>
          <coneGeometry args={[0.18, g.h, 5]} />
          <meshStandardMaterial color="#6a6a6a" flatShading />
        </mesh>
      ))}
    </>
  );
}