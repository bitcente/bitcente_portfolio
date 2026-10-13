import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { FxShared } from "./MoveFx";

interface Props {
  /** Camera distance that keeps both creatures in frame for the current aspect ratio. */
  distance: number;
  /** Z coordinate the camera looks at (middle of the two creatures). */
  lookZ: number;
  /** Shared with the attack effects: they ask for camera shake here. */
  shared: MutableRefObject<FxShared>;
}

/** Height of the point the camera looks at. */
const LOOK_Y = 0.6;
/** How far the mouse can swing the camera around the scene (radians, ~8 degrees). */
const MAX_YAW = 0.14;
/** How much the camera rises / lowers with the mouse (world units). */
const MAX_LIFT = 0.7;

/**
 * Push-in intro, a slow idle sway, and a slight tilt that follows the mouse:
 * the camera orbits a little around the scene while the view stays locked on
 * the creatures. The mouse is read from the whole window, so it also works
 * over the HUD boxes. Disabled for touch and for "reduce motion".
 */
export function CameraRig({ distance, lookZ, shared }: Props) {
  const camera = useThree((s) => s.camera);
  const clock = useThree((s) => s.clock);
  const t0 = useRef<number | null>(null);
  const mouse = useRef({ x: 0, y: 0 }); // -1..1, where the pointer is
  const eased = useRef({ x: 0, y: 0 }); // smoothed value the camera uses

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      mouse.current.x = 0;
      mouse.current.y = 0;
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useFrame((_, dt) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const k = Math.min(1, t / 1.6);
    const ease = 1 - Math.pow(1 - k, 3);

    // ease the mouse value so the camera glides instead of snapping
    const f = 1 - Math.exp(-dt * 4);
    eased.current.x += (mouse.current.x - eased.current.x) * f;
    eased.current.y += (mouse.current.y - eased.current.y) * f;

    // base position relative to the point we look at
    const height = 2.6 + (distance - 6.6) * 0.35; // the further the camera, the higher it is
    const dx = Math.sin(t * 0.35) * 0.5; // idle sway
    const dy = height - LOOK_Y;
    const dz = distance + (1 - ease) * 3.2 - lookZ;

    // orbit around the Y axis with the mouse (left / right)
    const yaw = eased.current.x * MAX_YAW;
    const x = dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const z = -dx * Math.sin(yaw) + dz * Math.cos(yaw);

    // attacks can shake the camera (the value is rewritten every frame while a shake is active)
    const sh = shared.current.shake;
    shared.current.shake = 0;
    const jx = sh > 0.001 ? (Math.random() - 0.5) * sh * 0.3 : 0;
    const jy = sh > 0.001 ? (Math.random() - 0.5) * sh * 0.3 : 0;

    camera.position.set(x + jx, LOOK_Y + dy - eased.current.y * MAX_LIFT + jy, lookZ + z);
    camera.lookAt(0, LOOK_Y, lookZ);
  });

  return null;
}