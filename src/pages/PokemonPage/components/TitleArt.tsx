import { useEffect, useRef, useState } from "react";
import { url } from "../sprites";

/**
 * The art of the title screen, drawn on canvases at Game Boy pixels:
 * - the logo, with a reflection sweeping over its letters every 6 seconds
 * - the trainer, throwing his ball up in the air and catching it every 3 seconds
 * The sprites are public/pokemon/PokemonLogo.png and AshStartScreenAnimation.png (2 frames of 40x56: ball in
 * the hand, and arm up). The ball of the second frame is taken out and flies on its own.
 */

const LOGO_SRC = url("PokemonLogo.png");
const TRAINER_SRC = url("AshStartScreenAnimation.png");

const SHINE_EVERY = 6000;
const SHINE_TIME = 700;
// px wide of the band of the reflection, and how slanted it is
const SHINE_WIDTH = 7;
const SHINE_SLANT = .6;

const THROW_EVERY = 3000;
// ms of the throw: the arm goes up, the ball flies, it's caught, and the arm comes down
const ARM_UP = 100;
const FLIGHT = 700;
const CAUGHT = 150;
// how high the ball goes, in px above where it leaves the hand
const THROW_HEIGHT = 22;

const FRAME_W = 40;
const FRAME_H = 56;
// room over the trainer for the ball to fly
const HEADROOM = 8;
// the ball in the second frame
const BALL = { x: 41, y: 16, size: 7 };

// the 4 greys of the sprites, from dark to light: the reflection takes each one a step lighter
const GREYS = [0, 96, 168, 255];

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function useImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [src]);
  return { image, failed };
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// calls draw on every animation frame with the ms since it started, unless motion is reduced (then only once)
function useLoop(draw: ((time: number) => void) | null) {
  useEffect(() => {
    if (!draw) return;
    const start = performance.now();
    if (reducedMotion()) {
      draw(-1);
      return;
    }
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      draw(now - start);
    });
    return () => cancelAnimationFrame(frame);
  }, [draw]);
}

export function TitleLogo({ fallback }: { fallback: React.ReactNode }) {
  const { image, failed } = useImage(LOGO_SRC);
  const ref = useRef<HTMLCanvasElement>(null);
  const [draw, setDraw] = useState<((time: number) => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!image || !canvas || !ctx) return;
    const { width, height } = image;
    canvas.width = width;
    canvas.height = height;

    const source = canvasOf(width, height).getContext("2d")!;
    source.drawImage(image, 0, 0);
    const pixels = source.getImageData(0, 0, width, height);
    const output = ctx.createImageData(width, height);
    // the band is drawn only where it moves, so nothing is redrawn between reflections
    let last = Number.NaN;

    setDraw(() => (time: number) => {
      const progress = time < 0 ? -1 : ((time + SHINE_EVERY - 1000) % SHINE_EVERY) / SHINE_TIME;
      // from fully left of the logo to fully right of it
      const band = progress >= 0 && progress <= 1 ? Math.round(-SHINE_WIDTH - height * SHINE_SLANT + progress * (width + height * SHINE_SLANT + SHINE_WIDTH * 2)) : null;
      const key = band ?? -999;
      if (key === last) return;
      last = key;

      output.data.set(pixels.data);
      if (band !== null) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const along = x + y * SHINE_SLANT - band;
            if (along < 0 || along >= SHINE_WIDTH) continue;
            const i = (y * width + x) * 4;
            const grey = output.data[i];
            // the letters only, not the white around them
            if (grey === 255 || output.data[i + 3] < 128) continue;
            // white in the middle of the band, a step lighter at its edges
            const core = along >= 2 && along < SHINE_WIDTH - 2;
            const step = GREYS.findIndex((value) => value >= grey);
            const lit = core ? 255 : GREYS[Math.min(GREYS.length - 1, step + 1)];
            output.data[i] = output.data[i + 1] = output.data[i + 2] = lit;
          }
        }
      }
      ctx.putImageData(output, 0, 0);
    });
  }, [image]);

  useLoop(draw);

  if (failed) return <>{fallback}</>;
  return <canvas ref={ref} className="gb-title-logo" role="img" aria-label="Pokemon" />;
}

export function TitleTrainer() {
  const { image } = useImage(TRAINER_SRC);
  const ref = useRef<HTMLCanvasElement>(null);
  const [draw, setDraw] = useState<((time: number) => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!image || !canvas || !ctx) return;
    canvas.width = FRAME_W;
    canvas.height = FRAME_H + HEADROOM;

    // ball in the hand, arm up without the ball, and the ball on its own (round, see-through around it)
    const holding = canvasOf(FRAME_W, FRAME_H);
    holding.getContext("2d")!.drawImage(image, 0, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    const armUp = canvasOf(FRAME_W, FRAME_H);
    const arm = armUp.getContext("2d")!;
    arm.drawImage(image, FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    arm.fillStyle = "#ffffff";
    arm.fillRect(BALL.x - FRAME_W, BALL.y, BALL.size, BALL.size);
    const ball = canvasOf(BALL.size, BALL.size);
    const ballCtx = ball.getContext("2d")!;
    ballCtx.drawImage(image, BALL.x, BALL.y, BALL.size, BALL.size, 0, 0, BALL.size, BALL.size);
    const ballPixels = ballCtx.getImageData(0, 0, BALL.size, BALL.size);
    const radius = BALL.size / 2;
    for (let y = 0; y < BALL.size; y++) {
      for (let x = 0; x < BALL.size; x++) {
        if ((x + .5 - radius) ** 2 + (y + .5 - radius) ** 2 > radius * radius) ballPixels.data[(y * BALL.size + x) * 4 + 3] = 0;
      }
    }
    ballCtx.putImageData(ballPixels, 0, 0);

    let last = "";
    setDraw(() => (time: number) => {
      const t = time < 0 ? THROW_EVERY : (time + THROW_EVERY - 600) % THROW_EVERY;
      let frame = holding;
      let ballY: number | null = null;
      let flipped = false;
      if (t < ARM_UP + FLIGHT + CAUGHT) {
        frame = armUp;
        ballY = BALL.y;
        if (t >= ARM_UP && t < ARM_UP + FLIGHT) {
          const u = (t - ARM_UP) / FLIGHT;
          ballY = Math.round(BALL.y - THROW_HEIGHT * 4 * u * (1 - u));
          // it spins on the way
          flipped = Math.floor((t - ARM_UP) / 90) % 2 === 1;
        }
      }
      const key = `${ frame === armUp }${ ballY }${ flipped }`;
      if (key === last) return;
      last = key;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, HEADROOM);
      if (ballY === null) return;
      const x = BALL.x - FRAME_W;
      if (flipped) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(ball, -x - BALL.size, ballY + HEADROOM);
        ctx.restore();
      } else ctx.drawImage(ball, x, ballY + HEADROOM);
    });
  }, [image]);

  useLoop(draw);

  return <canvas ref={ref} className="gb-title-trainer" aria-hidden="true" />;
}
