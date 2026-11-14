import { parseGifInfo } from "../gif/info";
import { runGifsicle, type GifsicleRunner } from "../gif/gifsicle";
import {
  buildAutoLadder,
  buildOptimizeArgs,
  describeStep,
  type OptimizeSettings,
  type OptimizeStep,
} from "./settings";

export interface OptimizeResult {
  blob: Blob;
  /** Description of the step that produced `blob`; null = input returned untouched. */
  label: string | null;
  fits: boolean;
  /** How many gifsicle passes it took. */
  runs: number;
}

export interface OptimizeOptions {
  /** Called before each gifsicle pass with the step being tried. */
  onAttempt?: (label: string) => void;
  run?: GifsicleRunner;
}

/**
 * Shrink a GIF according to `settings`.
 *
 * Auto: find the gentlest ladder rung that fits `targetBytes`; if nothing
 * fits, return the smallest result with `fits: false`.
 * Manual: apply the configured step once, whatever size comes out.
 *
 * Never returns something larger than the input: if a pass doesn't help, the
 * input blob comes back with `label: null`.
 */
export async function optimizeGif(
  blob: Blob,
  settings: OptimizeSettings,
  { onAttempt, run = runGifsicle }: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const input = await blob.arrayBuffer();
  const { delaysCs } = parseGifInfo(new Uint8Array(input));
  const target = settings.targetBytes;

  let runs = 0;
  const attempt = async (step: OptimizeStep): Promise<Blob | null> => {
    onAttempt?.(describeStep(step));
    runs++;
    return run(input, buildOptimizeArgs(step, delaysCs));
  };
  const finish = (out: Blob | null, step: OptimizeStep): OptimizeResult =>
    out && out.size < blob.size
      ? { blob: out, label: describeStep(step), fits: out.size <= target, runs }
      : { blob, label: null, fits: blob.size <= target, runs };

  if (settings.mode === "manual") {
    return finish(await attempt(settings.manual), settings.manual);
  }

  const ladder = buildAutoLadder(settings.auto, delaysCs.length);
  const found = await firstFitting(ladder, attempt, target);
  return finish(found.blob, found.step);
}

/**
 * Find the first ladder rung whose output fits the target, assuming sizes
 * shrink along the ladder. Gallops (0, 1, 2, 4, 8…) then bisects, so a GIF
 * that needs only a light touch costs 1–2 passes and the worst case is
 * ~2·log2(n) instead of n. Falls back to the smallest output seen.
 */
async function firstFitting(
  ladder: OptimizeStep[],
  attempt: (step: OptimizeStep) => Promise<Blob | null>,
  target: number,
): Promise<{ blob: Blob | null; step: OptimizeStep }> {
  const outputs = new Map<number, Blob | null>();
  const fitsAt = async (i: number): Promise<boolean> => {
    if (!outputs.has(i)) outputs.set(i, await attempt(ladder[i]));
    const out = outputs.get(i);
    return !!out && out.size <= target;
  };

  const last = ladder.length - 1;
  // Gallop: `lo` is the last rung known not to fit, `hi` the first known to fit.
  let lo = -1;
  let hi = 0;
  while (!(await fitsAt(hi))) {
    lo = hi;
    if (hi === last) {
      hi = -1;
      break;
    }
    hi = Math.min(last, hi === 0 ? 1 : hi * 2);
  }

  if (hi >= 0) {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (await fitsAt(mid)) hi = mid;
      else lo = mid;
    }
    return { blob: outputs.get(hi) ?? null, step: ladder[hi] };
  }

  // Nothing fits: best effort is the smallest thing we produced.
  let best = last;
  for (const [i, out] of outputs) {
    const bestOut = outputs.get(best);
    if (out && (!bestOut || out.size < bestOut.size)) best = i;
  }
  return { blob: outputs.get(best) ?? null, step: ladder[best] };
}
