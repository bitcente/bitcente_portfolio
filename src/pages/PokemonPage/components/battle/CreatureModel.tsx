import type { Kind, V3 } from "../../types";

interface BlobProps {
  p?: V3;
  s?: V3;
  r?: V3;
  c: string;
  g?: "sphere" | "box" | "cone";
  glow?: boolean;
}

function Blob({ p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], c, g = "sphere", glow }: BlobProps) {
  return (
    <mesh position={p} scale={s} rotation={r}>
      {g === "sphere" ? (
        <sphereGeometry args={[1, 14, 10]} />
      ) : g === "box" ? (
        <boxGeometry args={[1, 1, 1]} />
      ) : (
        <coneGeometry args={[1, 1, 10]} />
      )}
      <meshStandardMaterial
        color={c}
        flatShading
        roughness={0.85}
        emissive={glow ? c : "#000000"}
        emissiveIntensity={glow ? 0.8 : 0}
      />
    </mesh>
  );
}

const EYE = "#111111";

interface Props {
  kind: Kind;
  main: string;
  accent: string;
  /** Color of the glowing tail tip (lizards). */
  tail?: string;
  /** 2 = evolved form: extra parts (horns, wings, spikes, crest...). */
  stage?: number;
}

/**
 * Placeholder models built from primitives (front faces +Z).
 * Replace with a GLTF loaded through drei's `useGLTF` if you have real models.
 */
export function CreatureModel({ kind, main, accent, tail = "#ffb347", stage = 1 }: Props) {
  const evolved = stage >= 2;
  if (kind === "lizard") {
    return (
      <group>
        <Blob p={[0, 0.75, 0]} s={[0.5, 0.55, 0.55]} c={main} />
        <Blob p={[0, 0.7, 0.2]} s={[0.36, 0.42, 0.4]} c={accent} />
        <Blob p={[0, 1.45, 0.2]} s={[0.45, 0.42, 0.42]} c={main} />
        <Blob p={[0, 1.36, 0.58]} s={[0.22, 0.15, 0.2]} c={main} g="box" />
        <Blob p={[-0.18, 1.55, 0.52]} s={[0.07, 0.07, 0.07]} c={EYE} />
        <Blob p={[0.18, 1.55, 0.52]} s={[0.07, 0.07, 0.07]} c={EYE} />
        <Blob p={[-0.5, 0.85, 0.2]} s={[0.12, 0.12, 0.22]} c={main} />
        <Blob p={[0.5, 0.85, 0.2]} s={[0.12, 0.12, 0.22]} c={main} />
        <Blob p={[-0.28, 0.2, 0.1]} s={[0.2, 0.22, 0.3]} c={main} />
        <Blob p={[0.28, 0.2, 0.1]} s={[0.2, 0.22, 0.3]} c={main} />
        <Blob p={[0, 0.5, -0.6]} s={[0.12, 0.12, 0.5]} c={main} />
        <Blob p={[0, 0.9, -1.05]} s={[0.16, 0.36, 0.16]} c={tail} g="cone" glow />
        {evolved && (
          <>
            {/* horns */}
            <Blob p={[-0.2, 1.9, 0.05]} s={[0.07, 0.32, 0.07]} r={[0.3, 0, -0.25]} c={accent} g="cone" />
            <Blob p={[0.2, 1.9, 0.05]} s={[0.07, 0.32, 0.07]} r={[0.3, 0, 0.25]} c={accent} g="cone" />
            {/* back spikes */}
            <Blob p={[0, 1.2, -0.35]} s={[0.1, 0.26, 0.1]} r={[-0.5, 0, 0]} c={accent} g="cone" />
            <Blob p={[0, 0.95, -0.5]} s={[0.1, 0.26, 0.1]} r={[-0.6, 0, 0]} c={accent} g="cone" />
            <Blob p={[0, 0.7, -0.65]} s={[0.1, 0.26, 0.1]} r={[-0.7, 0, 0]} c={accent} g="cone" />
            {/* wings */}
            <Blob p={[-0.62, 1.15, -0.3]} s={[0.05, 0.55, 0.4]} r={[0, 0, 0.55]} c={main} g="box" />
            <Blob p={[0.62, 1.15, -0.3]} s={[0.05, 0.55, 0.4]} r={[0, 0, -0.55]} c={main} g="box" />
          </>
        )}
      </group>
    );
  }

  if (kind === "bird") {
    return (
      <group>
        <Blob p={[0, 0.7, 0]} s={[0.5, 0.45, 0.6]} c={main} />
        <Blob p={[0, 0.62, 0.18]} s={[0.38, 0.34, 0.42]} c={accent} />
        <Blob p={[0, 1.25, 0.28]} s={[0.36, 0.34, 0.34]} c={main} />
        <Blob p={[0, 1.2, 0.68]} s={[0.1, 0.26, 0.1]} r={[Math.PI / 2, 0, 0]} c="#f2c230" g="cone" />
        <Blob p={[-0.16, 1.32, 0.52]} s={[0.06, 0.06, 0.06]} c={EYE} />
        <Blob p={[0.16, 1.32, 0.52]} s={[0.06, 0.06, 0.06]} c={EYE} />
        <Blob p={[-0.52, 0.8, -0.05]} s={[0.08, 0.3, 0.46]} r={[0, 0, 0.35]} c={main} />
        <Blob p={[0.52, 0.8, -0.05]} s={[0.08, 0.3, 0.46]} r={[0, 0, -0.35]} c={main} />
        <Blob p={[0, 0.72, -0.7]} s={[0.2, 0.04, 0.4]} r={[0.3, 0, 0]} c={accent} g="box" />
        <Blob p={[-0.15, 0.2, 0.05]} s={[0.04, 0.4, 0.04]} c="#f2c230" g="box" />
        <Blob p={[0.15, 0.2, 0.05]} s={[0.04, 0.4, 0.04]} c="#f2c230" g="box" />
        {evolved && (
          <>
            {/* crest */}
            <Blob p={[0, 1.62, 0.2]} s={[0.07, 0.32, 0.07]} c={accent} g="cone" />
            <Blob p={[-0.13, 1.56, 0.12]} s={[0.07, 0.26, 0.07]} r={[0, 0, 0.35]} c={accent} g="cone" />
            <Blob p={[0.13, 1.56, 0.12]} s={[0.07, 0.26, 0.07]} r={[0, 0, -0.35]} c={accent} g="cone" />
            {/* long tail feathers */}
            <Blob p={[0, 0.82, -0.98]} s={[0.1, 0.04, 0.5]} r={[0.2, 0, 0]} c={accent} g="box" />
            <Blob p={[-0.2, 0.8, -0.92]} s={[0.1, 0.04, 0.46]} r={[0.2, 0.3, 0]} c={main} g="box" />
            <Blob p={[0.2, 0.8, -0.92]} s={[0.1, 0.04, 0.46]} r={[0.2, -0.3, 0]} c={main} g="box" />
            {/* bigger wing tips */}
            <Blob p={[-0.74, 0.98, -0.2]} s={[0.06, 0.42, 0.55]} r={[0, 0, 0.6]} c={main} g="box" />
            <Blob p={[0.74, 0.98, -0.2]} s={[0.06, 0.42, 0.55]} r={[0, 0, -0.6]} c={main} g="box" />
          </>
        )}
      </group>
    );
  }

  return (
    <group>
      <Blob p={[0, 0.55, 0]} s={[0.45, 0.4, 0.65]} c={main} />
      <Blob p={[0, 0.82, 0.55]} s={[0.32, 0.3, 0.34]} c={main} />
      <Blob p={[0, 0.78, 0.88]} s={[0.07, 0.07, 0.07]} c="#e88aa0" />
      <Blob p={[-0.22, 1.15, 0.45]} s={[0.16, 0.22, 0.04]} c={accent} />
      <Blob p={[0.22, 1.15, 0.45]} s={[0.16, 0.22, 0.04]} c={accent} />
      <Blob p={[-0.13, 0.9, 0.82]} s={[0.05, 0.05, 0.05]} c={EYE} />
      <Blob p={[0.13, 0.9, 0.82]} s={[0.05, 0.05, 0.05]} c={EYE} />
      <Blob p={[0, 0.64, 0.86]} s={[0.1, 0.1, 0.03]} c="#ffffff" g="box" />
      <Blob p={[0, 0.5, -1.0]} s={[0.05, 0.05, 0.6]} c={accent} />
      <Blob p={[0, 0.5, -1.62]} s={[0.1, 0.1, 0.1]} c={accent} />
      <Blob p={[-0.25, 0.15, 0.3]} s={[0.12, 0.15, 0.22]} c={main} g="box" />
      <Blob p={[0.25, 0.15, 0.3]} s={[0.12, 0.15, 0.22]} c={main} g="box" />
      <Blob p={[-0.25, 0.15, -0.35]} s={[0.12, 0.15, 0.22]} c={main} g="box" />
      <Blob p={[0.25, 0.15, -0.35]} s={[0.12, 0.15, 0.22]} c={main} g="box" />
      {evolved && (
        <>
          {/* bigger ears */}
          <Blob p={[-0.3, 1.38, 0.38]} s={[0.2, 0.32, 0.04]} c={accent} g="box" />
          <Blob p={[0.3, 1.38, 0.38]} s={[0.2, 0.32, 0.04]} c={accent} g="box" />
          {/* whiskers */}
          <Blob p={[-0.42, 0.8, 0.85]} s={[0.4, 0.02, 0.02]} c={accent} g="box" />
          <Blob p={[0.42, 0.8, 0.85]} s={[0.4, 0.02, 0.02]} c={accent} g="box" />
          <Blob p={[-0.4, 0.72, 0.85]} s={[0.36, 0.02, 0.02]} r={[0, 0, -0.2]} c={accent} g="box" />
          <Blob p={[0.4, 0.72, 0.85]} s={[0.36, 0.02, 0.02]} r={[0, 0, 0.2]} c={accent} g="box" />
          {/* back spikes and fangs */}
          <Blob p={[0, 0.98, 0.25]} s={[0.09, 0.28, 0.09]} r={[-0.3, 0, 0]} c={accent} g="cone" />
          <Blob p={[0, 0.98, -0.05]} s={[0.09, 0.28, 0.09]} r={[-0.5, 0, 0]} c={accent} g="cone" />
          <Blob p={[0, 0.92, -0.35]} s={[0.09, 0.28, 0.09]} r={[-0.7, 0, 0]} c={accent} g="cone" />
          <Blob p={[-0.08, 0.56, 0.9]} s={[0.04, 0.12, 0.03]} c="#ffffff" g="box" />
          <Blob p={[0.08, 0.56, 0.9]} s={[0.04, 0.12, 0.03]} c="#ffffff" g="box" />
        </>
      )}
    </group>
  );
}