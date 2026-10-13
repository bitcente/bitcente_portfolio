import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FxLayer, FxState, ShapeId } from "../../fx/types";
import type { V3 } from "../../types";

/** Values layers write every frame and the camera / flash read (reset after reading). */
export interface FxShared {
  shake: number;
  flash: number;
  flashColor: string;
}

interface Ctx {
  start: MutableRefObject<number>;
  /** Attacker and target centers. */
  from: V3;
  to: V3;
  miss: boolean;
  shared: MutableRefObject<FxShared>;
}
type L<K extends FxLayer["kind"]> = Extract<FxLayer, { kind: K }>;

/* ------------------------------ helpers ------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Deterministic pseudo-random number 0..1 from an index. */
const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};
const UP = new THREE.Vector3(0, 1, 0);

const setOpacity = (o: THREE.Object3D, v: number) => {
  ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = v;
};

function Geo({ shape }: { shape: ShapeId }) {
  switch (shape) {
    case "shard": return <coneGeometry args={[0.35, 1.6, 5]} />;
    case "dart": return <coneGeometry args={[0.18, 1.8, 4]} />;
    case "leaf": return <boxGeometry args={[1.5, 0.1, 0.7]} />;
    case "rock": return <dodecahedronGeometry args={[1, 0]} />;
    case "star": return <octahedronGeometry args={[1, 0]} />;
    case "spark": return <boxGeometry args={[0.5, 0.5, 2]} />;
    case "drop": return <sphereGeometry args={[1, 8, 6]} />;
    case "puff": return <sphereGeometry args={[1, 8, 6]} />;
    default: return <sphereGeometry args={[1, 10, 8]} />;
  }
}

/** Unlit, see-through material: effects keep the same brightness whatever the lights do. */
function Mat({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />;
}

/**
 * Every layer is a hidden group that shows itself during [at, at + dur] and
 * calls `update(k, group)` every frame, k going 0..1.
 */
function useLayer(
  layer: { at: number; dur: number },
  ctx: Ctx,
  update: (k: number, group: THREE.Group) => void
) {
  const group = useRef<THREE.Group>(null!);
  const clock = useThree((s) => s.clock);
  useFrame(() => {
    const g = group.current;
    const k = (clock.elapsedTime - ctx.start.current - layer.at) / layer.dur;
    const on = k >= 0 && k <= 1;
    g.visible = on;
    if (on) update(k, g);
  });
  return group;
}

const centerOf = (ctx: Ctx, on?: "target" | "user") => (on === "user" ? ctx.from : ctx.to);

/* ------------------------------ layers ------------------------------ */

function Projectile({ layer, ctx }: { layer: L<"projectile">; ctx: Ctx }) {
  const n = layer.count ?? 1;
  const trail = layer.trail ? 3 : 0;
  const q = useMemo(() => new THREE.Quaternion(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const group = useLayer(layer, ctx, (k, g) => {
    // when the attack misses, projectiles fly past the target
    const to: V3 = ctx.miss ? [ctx.to[0] + 1.8, ctx.to[1] + 0.3, ctx.to[2] + 0.6] : ctx.to;
    const stagger = n > 1 ? 0.5 / n : 0;
    dir.set(to[0] - ctx.from[0], to[1] - ctx.from[1], to[2] - ctx.from[2]).normalize();
    q.setFromUnitVectors(UP, dir);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= trail; j++) {
        const m = g.children[idx++] as THREE.Mesh;
        const ki = (k - i * stagger - j * 0.06) / (1 - (n - 1) * stagger);
        if (ki <= 0 || ki >= 1) {
          m.visible = false;
          continue;
        }
        m.visible = true;
        const lateral = (i - (n - 1) / 2) * 0.25;
        m.position.set(
          lerp(ctx.from[0], to[0], ki) + lateral,
          lerp(ctx.from[1], to[1], ki) + Math.sin(ki * Math.PI) * (layer.arc ?? 0),
          lerp(ctx.from[2], to[2], ki)
        );
        m.quaternion.copy(q);
        m.rotateY(ki * (layer.spin ?? 0));
        m.scale.setScalar(layer.size * (j === 0 ? 1 : 1 - j * 0.22));
        setOpacity(m, j === 0 ? 1 : 0.5 / j);
      }
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: n * (trail + 1) }, (_, idx) => (
        <mesh key={idx}>
          <Geo shape={layer.shape} />
          <Mat color={idx % (trail + 1) === 0 ? layer.color : layer.trail ?? layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Beam({ layer, ctx }: { layer: L<"beam">; ctx: Ctx }) {
  const q = useMemo(() => new THREE.Quaternion(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const group = useLayer(layer, ctx, (k, g) => {
    const m = g.children[0] as THREE.Mesh;
    dir.set(ctx.to[0] - ctx.from[0], ctx.to[1] - ctx.from[1], ctx.to[2] - ctx.from[2]);
    const len = dir.length();
    dir.normalize();
    q.setFromUnitVectors(UP, dir);
    // grows from the attacker, holds, then fades
    const grow = clamp01(k / 0.25);
    const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const w = layer.width * (0.8 + 0.4 * Math.sin(k * 70)) * fade;
    m.quaternion.copy(q);
    m.scale.set(w, len * grow, w);
    m.position.set(
      ctx.from[0] + (dir.x * len * grow) / 2,
      ctx.from[1] + (dir.y * len * grow) / 2,
      ctx.from[2] + (dir.z * len * grow) / 2
    );
    setOpacity(m, 0.85 * fade);
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <Mat color={layer.color} />
      </mesh>
    </group>
  );
}

function Burst({ layer, ctx }: { layer: L<"burst">; ctx: Ctx }) {
  const c = centerOf(ctx, layer.on);
  const group = useLayer(layer, ctx, (k, g) => {
    const e = easeOut(k);
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ang = rnd(i * 3 + 1) * Math.PI * 2;
      const el = (rnd(i * 7 + 2) * 0.9 - 0.1) * Math.PI * 0.5 + 0.1;
      m.position.set(
        c[0] + Math.cos(ang) * Math.cos(el) * layer.speed * e,
        c[1] + (Math.sin(el) + 0.15) * layer.speed * e - k * k * 0.4,
        c[2] + Math.sin(ang) * Math.cos(el) * layer.speed * e
      );
      const grow = layer.shape === "puff" ? 0.6 + k : 1 - k * 0.8;
      m.scale.setScalar(layer.size * grow);
      m.rotation.set(k * 6 + i, k * 5, 0);
      setOpacity(m, 1 - k * k);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <Geo shape={layer.shape} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Ring({ layer, ctx }: { layer: L<"ring">; ctx: Ctx }) {
  const n = layer.count ?? 1;
  const c = centerOf(ctx, layer.on);
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < n; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ki = (k - i * 0.2) / (1 - (n - 1) * 0.2);
      m.visible = ki > 0 && ki < 1;
      if (!m.visible) continue;
      m.position.set(c[0], layer.vertical ? c[1] : 0.12, c[2]);
      m.rotation.x = layer.vertical ? 0 : Math.PI / 2;
      m.scale.setScalar(lerp(0.3, layer.size, easeOut(ki)));
      setOpacity(m, 1 - ki);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i}>
          <torusGeometry args={[1, 0.07, 6, 30]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Slash({ layer, ctx }: { layer: L<"slash"> ; ctx: Ctx }) {
  const n = layer.count ?? 1;
  const c = ctx.to;
  const len = layer.length ?? 2;
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < n; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ki = clamp01(k - i * 0.08);
      const a = (layer.angle ?? -0.7) + i * (layer.spread ?? 0);
      const off = (i - (n - 1) / 2) * 0.38;
      m.position.set(c[0] - Math.sin(a) * off, c[1] + Math.cos(a) * off, c[2] + 0.3);
      m.rotation.z = a;
      m.scale.set(len * clamp01(ki / 0.45) + 0.01, 1, 1);
      setOpacity(m, ki < 0.6 ? 1 : 1 - (ki - 0.6) / 0.4);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[1, 0.13, 0.05]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

const BOLT_SEGMENTS = 7;
function Bolt({ layer, ctx }: { layer: L<"bolt">; ctx: Ctx }) {
  const q = useMemo(() => new THREE.Quaternion(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const group = useLayer(layer, ctx, (k, g) => {
    const tick = Math.floor(k * 14); // the bolt re-rolls its zig-zag a few times
    const top: V3 = [ctx.to[0], ctx.to[1] + 5, ctx.to[2]];
    const bottom: V3 = [ctx.to[0], 0.3, ctx.to[2]];
    const point = (j: number, out: THREE.Vector3) => {
      const t = j / BOLT_SEGMENTS;
      const sway = j === 0 || j === BOLT_SEGMENTS ? 0 : (rnd(j + tick * 13) - 0.5) * 1.0;
      return out.set(lerp(top[0], bottom[0], t) + sway, lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t));
    };
    for (let j = 0; j < BOLT_SEGMENTS; j++) {
      const m = g.children[j] as THREE.Mesh;
      point(j, a);
      point(j + 1, b);
      const len = a.distanceTo(b);
      m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      q.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      m.quaternion.copy(q);
      m.scale.set(0.14, len, 0.14);
      setOpacity(m, k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2);
    }
    const glow = g.children[BOLT_SEGMENTS] as THREE.Mesh;
    glow.position.set(bottom[0], bottom[1], bottom[2]);
    glow.scale.setScalar(0.5 + 0.4 * Math.sin(k * 40));
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: BOLT_SEGMENTS }, (_, j) => (
        <mesh key={j}>
          <cylinderGeometry args={[1, 1, 1, 5]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[1, 8, 6]} />
        <Mat color={layer.color} opacity={0.7} />
      </mesh>
    </group>
  );
}

function Fall({ layer, ctx }: { layer: L<"fall">; ctx: Ctx }) {
  const c = ctx.to;
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ki = (k - i * 0.12) / (1 - (layer.count - 1) * 0.12);
      m.visible = ki > 0 && ki < 1;
      if (!m.visible) continue;
      const fall = Math.pow(ki, 1.6);
      m.position.set(c[0] + (rnd(i * 5 + 3) - 0.5) * 1.4, lerp(c[1] + 4.5, 0.4, fall), c[2] + (rnd(i * 9 + 5) - 0.5) * 1.0);
      m.rotation.set(ki * 5 + i, ki * 4, 0);
      m.scale.setScalar(layer.size);
      setOpacity(m, ki > 0.9 ? (1 - ki) / 0.1 : 1);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <Geo shape={layer.shape} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Swirl({ layer, ctx }: { layer: L<"swirl">; ctx: Ctx }) {
  const c = centerOf(ctx, layer.on);
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const a = (i / layer.count) * Math.PI * 2 + k * (layer.turns ?? 2) * Math.PI * 2;
      const r = (layer.radius ?? 0.9) * (1 - 0.25 * k);
      m.position.set(c[0] + Math.cos(a) * r, c[1] - 0.5 + k * 1.3 + (i % 3) * 0.12, c[2] + Math.sin(a) * r);
      m.rotation.set(a, k * 8, 0);
      m.scale.setScalar(layer.size);
      setOpacity(m, k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <Geo shape={layer.shape} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Drain({ layer, ctx }: { layer: L<"drain">; ctx: Ctx }) {
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ki = (k - i * 0.1) / (1 - (layer.count - 1) * 0.1);
      m.visible = ki > 0 && ki < 1;
      if (!m.visible) continue;
      const side = (rnd(i * 11 + 1) - 0.5) * 1.2;
      m.position.set(
        lerp(ctx.to[0], ctx.from[0], ki) + side * Math.sin(ki * Math.PI),
        lerp(ctx.to[1], ctx.from[1], ki) + Math.sin(ki * Math.PI) * 0.8,
        lerp(ctx.to[2], ctx.from[2], ki)
      );
      m.scale.setScalar(layer.size * (1 - ki * 0.4));
      setOpacity(m, 1);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 6]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Aura({ layer, ctx }: { layer: L<"aura">; ctx: Ctx }) {
  const c = centerOf(ctx, layer.on ?? "user");
  const group = useLayer(layer, ctx, (k, g) => {
    const m = g.children[0] as THREE.Mesh;
    m.position.set(c[0], c[1], c[2]);
    m.scale.setScalar((layer.size ?? 1.1) * (0.8 + 0.5 * easeOut(k)));
    setOpacity(m, 0.45 * Math.sin(k * Math.PI));
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <sphereGeometry args={[1, 14, 10]} />
        <Mat color={layer.color} />
      </mesh>
    </group>
  );
}

function Jaws({ layer, ctx }: { layer: L<"jaws">; ctx: Ctx }) {
  const c = ctx.to;
  const group = useLayer(layer, ctx, (k, g) => {
    const gap = lerp(1.5, 0.2, easeOut(clamp01(k / 0.7)));
    const left = g.children[0] as THREE.Mesh;
    const right = g.children[1] as THREE.Mesh;
    left.position.set(c[0] - gap, c[1], c[2]);
    right.position.set(c[0] + gap, c[1], c[2]);
    left.rotation.z = -Math.PI / 2; // tips point at each other
    right.rotation.z = Math.PI / 2;
    const o = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    setOpacity(left, o);
    setOpacity(right, o);
  });
  return (
    <group ref={group} visible={false}>
      {[0, 1].map((i) => (
        <mesh key={i} scale={[0.55, 1.1, 0.55]}>
          <coneGeometry args={[1, 1.6, 6]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Cover({ layer, ctx }: { layer: L<"cover">; ctx: Ctx }) {
  const c = centerOf(ctx, layer.on);
  const ground = c[1] - 0.9; // creature centers are 0.9 above the floor
  const radius = layer.radius ?? 0.9;
  const gather = (layer.mode ?? "gather") === "gather";
  const group = useLayer(layer, ctx, (k, g) => {
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const ang0 = rnd(i * 3 + 1) * Math.PI * 2;
      const r0 = radius * (0.3 + 0.7 * rnd(i * 5 + 2));
      const h0 = rnd(i * 7 + 3) * 1.9;
      if (gather) {
        // puffs appear one after another, spiral in and pile up around the creature
        const delay = rnd(i * 11 + 4) * 0.55;
        const ki = clamp01((k - delay) / (1 - delay));
        m.visible = ki > 0;
        if (!m.visible) continue;
        const e = easeOut(ki);
        const ang = ang0 + k * 3;
        const r = r0 * (1.8 - 0.8 * e);
        m.position.set(c[0] + Math.cos(ang) * r, ground + 0.15 + h0 * (0.4 + 0.6 * e), c[2] + Math.sin(ang) * r);
        m.scale.setScalar(layer.size * (0.25 + 0.75 * e));
        setOpacity(m, 0.92);
      } else {
        // the dust is blown away
        const e = easeOut(k);
        const ang = ang0 + k * 1.5;
        const r = r0 * (1 + 3 * e);
        m.position.set(c[0] + Math.cos(ang) * r, ground + 0.15 + h0 + k * 0.9, c[2] + Math.sin(ang) * r);
        m.scale.setScalar(layer.size * (1 + 0.7 * k));
        setOpacity(m, Math.max(0, 1 - k * k * 1.1));
      }
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 6]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Rays({ layer, ctx }: { layer: L<"rays">; ctx: Ctx }) {
  const c = centerOf(ctx, layer.on);
  const len = layer.length ?? 2.6;
  const group = useLayer(layer, ctx, (k, g) => {
    const envelope = Math.sin(k * Math.PI);
    for (let i = 0; i < layer.count; i++) {
      const m = g.children[i] as THREE.Mesh;
      const a = (i / layer.count) * Math.PI * 2 + k * 1.6;
      const l = len * (0.7 + 0.3 * Math.sin(k * 12 + i * 1.7));
      m.position.set(c[0] + (Math.cos(a) * l) / 2, c[1] + (Math.sin(a) * l) / 2, c[2] - 0.2);
      m.rotation.z = a;
      m.scale.set(l, 1, 1);
      setOpacity(m, 0.75 * envelope);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: layer.count }, (_, i) => (
        <mesh key={i}>
          <boxGeometry args={[1, 0.09, 0.02]} />
          <Mat color={layer.color} />
        </mesh>
      ))}
    </group>
  );
}

function Shake({ layer, ctx }: { layer: L<"shake">; ctx: Ctx }) {
  const clock = useThree((s) => s.clock);
  useFrame(() => {
    const k = (clock.elapsedTime - ctx.start.current - layer.at) / layer.dur;
    if (k >= 0 && k <= 1) ctx.shared.current.shake = Math.max(ctx.shared.current.shake, layer.amp * (1 - k));
  });
  return null;
}

function Flash({ layer, ctx }: { layer: L<"flash">; ctx: Ctx }) {
  const clock = useThree((s) => s.clock);
  useFrame(() => {
    const k = (clock.elapsedTime - ctx.start.current - layer.at) / layer.dur;
    if (k >= 0 && k <= 1) {
      ctx.shared.current.flash = Math.max(ctx.shared.current.flash, (layer.strength ?? 0.5) * (1 - k));
      ctx.shared.current.flashColor = layer.color ?? "#ffffff";
    }
  });
  return null;
}

function LayerView({ layer, ctx }: { layer: FxLayer; ctx: Ctx }) {
  switch (layer.kind) {
    case "projectile": return <Projectile layer={layer} ctx={ctx} />;
    case "beam": return <Beam layer={layer} ctx={ctx} />;
    case "burst": return <Burst layer={layer} ctx={ctx} />;
    case "ring": return <Ring layer={layer} ctx={ctx} />;
    case "slash": return <Slash layer={layer} ctx={ctx} />;
    case "bolt": return <Bolt layer={layer} ctx={ctx} />;
    case "fall": return <Fall layer={layer} ctx={ctx} />;
    case "swirl": return <Swirl layer={layer} ctx={ctx} />;
    case "drain": return <Drain layer={layer} ctx={ctx} />;
    case "aura": return <Aura layer={layer} ctx={ctx} />;
    case "jaws": return <Jaws layer={layer} ctx={ctx} />;
    case "cover": return <Cover layer={layer} ctx={ctx} />;
    case "rays": return <Rays layer={layer} ctx={ctx} />;
    case "shake": return <Shake layer={layer} ctx={ctx} />;
    case "flash": return <Flash layer={layer} ctx={ctx} />;
  }
}

/* ------------------------------ entry points ------------------------------ */

interface Props {
  fx: FxState | null;
  playerPos: V3;
  enemyPos: V3;
  shared: MutableRefObject<FxShared>;
}

/** Plays the visual layers of the current attack. Mounts / unmounts with `fx`. */
export function MoveFx({ fx, playerPos, enemyPos, shared }: Props) {
  const clock = useThree((s) => s.clock);
  const start = useRef(0);

  // the animation clock starts when a new attack appears
  useEffect(() => {
    start.current = clock.elapsedTime;
  }, [fx?.key, clock]);

  if (!fx) return null;
  const [src, dst] = fx.side === "player" ? [playerPos, enemyPos] : [enemyPos, playerPos];
  const ctx: Ctx = {
    start,
    from: [src[0], src[1] + 0.9, src[2]],
    to: [dst[0], dst[1] + 0.9, dst[2]],
    miss: fx.miss,
    shared,
  };
  return (
    <>
      {fx.anim.layers.map((layer, i) =>
        fx.miss && layer.at >= fx.anim.hitAt ? null : (
          <LayerView key={`${fx.key}-${i}`} layer={layer} ctx={ctx} />
        )
      )}
    </>
  );
}

/** A plane stuck in front of the camera that tints the whole screen for flashes. */
export function ScreenFlash({ shared }: { shared: MutableRefObject<FxShared> }) {
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null!);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const f = shared.current.flash;
    shared.current.flash = 0; // layers write it again every frame while active
    const m = mesh.current;
    m.visible = f > 0.01;
    if (!m.visible) return;
    camera.getWorldDirection(fwd);
    m.position.copy(camera.position).addScaledVector(fwd, 0.6);
    m.quaternion.copy(camera.quaternion);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(1, f);
    mat.color.set(shared.current.flashColor);
  });
  return (
    <mesh ref={mesh} visible={false} renderOrder={999}>
      <planeGeometry args={[6, 6]} />
      <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} color="#ffffff" />
    </mesh>
  );
}