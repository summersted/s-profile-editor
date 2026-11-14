import { effectiveDelayCs } from "../gif/info";
import { GIF_INPUT } from "../gif/gifsicle";
import { FILE_LIMIT_BYTES } from "../steam/showcases";

/**
 * Optimizer configuration and the pure logic that turns it into gifsicle
 * commands. Nothing here touches wasm or the DOM.
 */

export type OptimizeMode = "auto" | "manual";

/** One concrete compression recipe. The identity values mean "leave as is". */
export interface OptimizeStep {
  /** gifsicle --lossy, 0 = lossless. */
  lossy: number;
  /** Palette size, 256 = untouched. */
  colors: number;
  /** Keep every Nth frame, 1 = all frames. */
  frameStep: number;
  /** Resolution multiplier, 1 = untouched. */
  scale: number;
}

export const LOSSLESS_STEP: OptimizeStep = { lossy: 0, colors: 256, frameStep: 1, scale: 1 };

export interface OptimizeSettings {
  mode: OptimizeMode;
  /** Size the result should fit into, bytes. */
  targetBytes: number;
  /** Auto mode: which kinds of quality loss the optimizer may use to hit the target. */
  auto: {
    lossy: boolean;
    colors: boolean;
    fps: boolean;
  };
  /** Manual mode: applied exactly as set. */
  manual: OptimizeStep;
}

export const DEFAULT_OPTIMIZE_SETTINGS: OptimizeSettings = {
  mode: "auto",
  targetBytes: FILE_LIMIT_BYTES,
  auto: { lossy: true, colors: true, fps: false },
  manual: { lossy: 40, colors: 256, frameStep: 1, scale: 1 },
};

export const LOSSY_RANGE = { min: 0, max: 200, step: 5 } as const;
export const COLOR_OPTIONS = [256, 128, 64, 32, 16] as const;
export const FRAME_STEP_OPTIONS = [1, 2, 3, 4] as const;
export const SCALE_OPTIONS = [1, 0.75, 0.5] as const;

type AutoAxis = keyof OptimizeSettings["auto"];

/**
 * Auto-mode escalation, ordered by how much each move hurts visually:
 * light lossy is nearly invisible, palette cuts band gradients, dropped
 * frames make motion choppy. Each move raises one axis and keeps the rest.
 */
const AUTO_MOVES: ReadonlyArray<readonly [AutoAxis, number]> = [
  ["lossy", 20],
  ["lossy", 40],
  ["lossy", 60],
  ["lossy", 80],
  ["colors", 128],
  ["lossy", 120],
  ["colors", 64],
  ["fps", 2],
  ["lossy", 160],
  ["colors", 32],
  ["lossy", 200],
  ["fps", 3],
  ["colors", 16],
];

/** Fewest frames an animation may be thinned down to. */
const MIN_FRAMES_AFTER_DROP = 4;

/**
 * The ladder auto mode climbs: starts lossless, every next rung is strictly
 * more aggressive (so output size shrinks along it), limited to allowed axes.
 */
export function buildAutoLadder(allow: OptimizeSettings["auto"], frameCount: number): OptimizeStep[] {
  const ladder: OptimizeStep[] = [LOSSLESS_STEP];
  let current = LOSSLESS_STEP;
  for (const [axis, value] of AUTO_MOVES) {
    if (!allow[axis]) continue;
    if (axis === "fps") {
      if (Math.ceil(frameCount / value) < MIN_FRAMES_AFTER_DROP) continue;
      current = { ...current, frameStep: value };
    } else {
      current = { ...current, [axis]: value };
    }
    ladder.push(current);
  }
  return ladder;
}

/**
 * gifsicle args (without the output flag) for a step.
 * `delaysCs` are the input's per-frame delays; needed only when dropping
 * frames, to hand each kept frame the time of the ones removed after it.
 */
export function buildOptimizeArgs(step: OptimizeStep, delaysCs: readonly number[]): string {
  const dropFrames = step.frameStep > 1 && delaysCs.length > 1;
  const args: string[] = [];
  // Frames are stored as diffs against previous ones; expand before removing any.
  if (dropFrames) args.push("-U");
  args.push("-O3");
  if (step.lossy > 0) args.push(`--lossy=${Math.round(step.lossy)}`);
  if (step.colors < 256) args.push(`--colors ${Math.max(2, Math.round(step.colors))}`);
  if (step.scale < 1) args.push(`--scale ${step.scale}`);
  args.push(GIF_INPUT);
  if (dropFrames) args.push(...frameSelection(step.frameStep, delaysCs));
  return args.join(" ");
}

/** `-dN #i` pairs keeping every `step`-th frame with the group's summed delay. */
function frameSelection(step: number, delaysCs: readonly number[]): string[] {
  const args: string[] = [];
  let lastDelay = -1;
  for (let i = 0; i < delaysCs.length; i += step) {
    let delay = 0;
    for (let j = i; j < Math.min(i + step, delaysCs.length); j++) {
      delay += effectiveDelayCs(delaysCs[j]);
    }
    // A delay option applies to all following frames, so repeat it only on change.
    if (delay !== lastDelay) {
      args.push(`-d${delay}`);
      lastDelay = delay;
    }
    args.push(`#${i}`);
  }
  return args;
}

export function describeStep(step: OptimizeStep): string {
  const parts: string[] = [];
  if (step.lossy > 0) parts.push(`lossy ${step.lossy}`);
  if (step.colors < 256) parts.push(`${step.colors} ${colorsWord(step.colors)}`);
  if (step.frameStep > 1) parts.push(`кожен ${step.frameStep}-й кадр`);
  if (step.scale < 1) parts.push(`масштаб ${Math.round(step.scale * 100)}%`);
  return parts.length ? parts.join(" · ") : "без втрат";
}

/** Ukrainian plural of «колір» for a count: 32 кольори, 16 кольорів. */
function colorsWord(n: number): string {
  const last = n % 10;
  const teens = n % 100 >= 11 && n % 100 <= 14;
  if (last === 1 && !teens) return "колір";
  if (last >= 2 && last <= 4 && !teens) return "кольори";
  return "кольорів";
}
