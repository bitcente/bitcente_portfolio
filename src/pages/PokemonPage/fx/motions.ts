import type { MotionId } from "./types";

/**
 * Body animation of the attacker. Each motion maps progress k (0..1) to a
 * pose: distance moved toward the target, height, spin, tilt and scale.
 */
export interface MotionPose {
  forward: number;
  y: number;
  yaw: number;
  pitch: number;
  scale: number;
}

const pose = (p: Partial<MotionPose>): MotionPose => ({
  forward: 0,
  y: 0,
  yaw: 0,
  pitch: 0,
  scale: 1,
  ...p,
});
const sin = (k: number) => Math.sin(k * Math.PI);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const MOTIONS: Record<MotionId, (k: number) => MotionPose> = {
  lunge: (k) => pose({ forward: 1.3 * sin(k) }),

  charge: (k) =>
    k < 0.35
      ? pose({ forward: -0.5 * (k / 0.35), scale: 1 - 0.06 * (k / 0.35) })
      : k < 0.6
      ? pose({ forward: lerp(-0.5, 1.7, (k - 0.35) / 0.25) })
      : pose({ forward: lerp(1.7, 0, (k - 0.6) / 0.4) }),

  hop: (k) => pose({ forward: 1.0 * sin(k), y: 1.1 * sin(k), pitch: -0.25 * sin(k) }),

  spin: (k) => pose({ yaw: k * Math.PI * 4, forward: 0.4 * sin(k), y: 0.2 * sin(k) }),

  cast: (k) =>
    pose({
      y: 0.35 * sin(Math.min(1, k * 1.3)),
      pitch: -0.35 * sin(Math.min(1, k * 1.6)),
      scale: 1 + 0.08 * sin(k),
    }),

  shake: (k) => pose({ yaw: Math.sin(k * 60) * 0.22 * (1 - k), scale: 1 + 0.06 * sin(k) }),

  rush: (k) => pose({ forward: 2.3 * Math.pow(sin(k), 0.6) }),

  stomp: (k) =>
    k < 0.6
      ? pose({ y: 1.6 * sin(k / 0.6), forward: 0.9 * (k / 0.6) })
      : pose({
          forward: lerp(0.9, 0, (k - 0.6) / 0.4),
          scale: 1 - 0.15 * sin((k - 0.6) / 0.4),
        }),

  recoil: (k) => pose({ forward: k < 0.5 ? -0.7 * sin(k * 2) : 0.9 * sin((k - 0.5) * 2) }),
};