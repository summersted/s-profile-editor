import { parseGifInfo } from "../gif/info";
import { runGifsicle, type GifsicleRunner } from "../gif/gifsicle";
import { firstFitting } from "./search";
import {
  buildAutoLadder,
  buildOptimizeArgs,
  type OptimizeLabel,
  type OptimizeProgress,
  type OptimizeSettings,
  type OptimizeStep,
} from "./settings";

export interface OptimizeResult {
  blob: Blob;
  /** The step that produced `blob`; null = input returned untouched. */
  label: OptimizeLabel | null;
  fits: boolean;
  /** How many encoding passes it took. */
  runs: number;
}

export interface OptimizeOptions {
  /** Called whenever the phase or the pass count changes. */
  onProgress?: (progress: OptimizeProgress) => void;
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
  { onProgress, run = runGifsicle }: OptimizeOptions = {},
): Promise<OptimizeResult> {
  onProgress?.({ phase: { kind: "read" }, done: 0, total: 1 });
  const input = await blob.arrayBuffer();
  const { delaysCs } = parseGifInfo(new Uint8Array(input));
  const target = settings.targetBytes;

  let runs = 0;
  /** Pass bounds from the search; manual mode is always a single pass. */
  let bounds = { done: 0, total: 1 };
  const attempt = async (step: OptimizeStep): Promise<Blob | null> => {
    onProgress?.({ phase: { kind: "attempt", label: { type: "gif", step } }, ...bounds });
    runs++;
    return run(input, buildOptimizeArgs(step, delaysCs));
  };
  const finish = (out: Blob | null, step: OptimizeStep): OptimizeResult =>
    out && out.size < blob.size
      ? { blob: out, label: { type: "gif", step }, fits: out.size <= target, runs }
      : { blob, label: null, fits: blob.size <= target, runs };

  if (settings.mode === "manual") {
    return finish(await attempt(settings.manual), settings.manual);
  }

  const ladder = buildAutoLadder(settings.auto, delaysCs.length);
  const found = await firstFitting(ladder, attempt, target, (done, total) => {
    bounds = { done, total };
  });
  return finish(found.blob, found.step);
}
