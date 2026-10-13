/**
 * Attack animation system.
 *
 * Every move has a MoveAnim (fx/recipes.ts): how the attacker moves (`motion`)
 * plus a list of timed visual layers (projectiles, beams, bursts, bolts...)
 * that are drawn in the 3D scene by components/battle/MoveFx.tsx.
 * All times are in seconds from the start of the attack.
 */

/** How the attacker's body moves while attacking (fx/motions.ts). */
export type MotionId =
  | "lunge"   // dash forward and back
  | "charge"  // pull back, then dash through the target
  | "hop"     // jump toward the target
  | "spin"    // spin around
  | "cast"    // stay put, rise up and rear back (for ranged attacks)
  | "shake"   // tremble in place
  | "rush"    // very fast dash past the target
  | "stomp"   // jump up and slam down
  | "recoil"; // step back, then forward

export type ShapeId = "orb" | "shard" | "leaf" | "rock" | "dart" | "drop" | "star" | "puff" | "spark";
/** Where a layer is drawn: on the target (default) or on the attacker. */
export type Where = "target" | "user";

interface Timed {
  /** Start time (s). Layers that start at or after `hitAt` are skipped when the move misses. */
  at: number;
  /** Duration (s). */
  dur: number;
}

export type FxLayer =
  /** Objects flying from the attacker to the target (a volley if count > 1). */
  | (Timed & { kind: "projectile"; shape: ShapeId; color: string; size: number; count?: number; arc?: number; spin?: number; trail?: string })
  /** A continuous beam from the attacker to the target. */
  | (Timed & { kind: "beam"; color: string; width: number })
  /** Particles flying out from a point. */
  | (Timed & { kind: "burst"; shape: ShapeId; color: string; count: number; size: number; speed: number; on?: Where })
  /** Expanding rings (flat on the ground, or facing the camera if vertical). */
  | (Timed & { kind: "ring"; color: string; size: number; on?: Where; count?: number; vertical?: boolean })
  /** Claw / blade marks that draw themselves across the target. */
  | (Timed & { kind: "slash"; color: string; count?: number; angle?: number; spread?: number; length?: number })
  /** A zig-zag lightning bolt from the sky to the target. */
  | (Timed & { kind: "bolt"; color: string })
  /** Objects falling from the sky onto the target. */
  | (Timed & { kind: "fall"; shape: ShapeId; color: string; count: number; size: number })
  /** Particles circling and rising around a creature. */
  | (Timed & { kind: "swirl"; shape: ShapeId; color: string; count: number; size: number; on?: Where; turns?: number; radius?: number })
  /** Orbs flowing from the target to the attacker. */
  | (Timed & { kind: "drain"; color: string; count: number; size: number })
  /** A glowing sphere around a creature (charging up). */
  | (Timed & { kind: "aura"; color: string; on?: Where; size?: number })
  /** Two jaws closing on the target. */
  | (Timed & { kind: "jaws"; color: string })
  /** Dust puffs that gather around a creature until they cover it ("gather"), or scatter outward ("disperse"). */
  | (Timed & { kind: "cover"; color: string; count: number; size: number; radius?: number; mode?: "gather" | "disperse"; on?: Where })
  /** Rays of light radiating from a creature, slowly rotating. */
  | (Timed & { kind: "rays"; color: string; count: number; length?: number; on?: Where })
  /** Camera shake. */
  | (Timed & { kind: "shake"; amp: number })
  /** Whole-screen flash. */
  | (Timed & { kind: "flash"; color?: string; strength?: number });

export interface MoveAnim {
  motion: MotionId;
  /** Total length of the attack (s). */
  duration: number;
  /** Moment of impact (s): damage and the target's reaction happen here. */
  hitAt: number;
  layers: FxLayer[];
}

/** The attack that is being played in the scene. */
export interface FxState {
  key: number;
  side: "player" | "enemy";
  anim: MoveAnim;
  /** The attack misses: impact layers are skipped and projectiles fly past. */
  miss: boolean;
}

export interface MotionState {
  id: MotionId;
  duration: number;
}