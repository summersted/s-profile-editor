import { FILE_LIMIT_BYTES } from "@/lib/steam/showcases";

export interface OptimizeAttempt {
  label: string;
  args: string;
}

export interface OptimizeResult {
  blob: Blob;
  bytes: number;
  /** Which rung of the ladder produced the result; null = already fit. */
  applied: OptimizeAttempt | null;
  fits: boolean;
}

/**
 * Squeeze a GIF under the Steam cap, degrading as little as possible.
 * Ladder is ordered by visual cost: light lossy first, palette cuts last.
 * (Community tools prefer keeping colors and dropping fps; gifsicle can't
 * resample fps directly, so lossy + colors is our axis.)
 */
const LADDER: OptimizeAttempt[] = [
  { label: "lossy 30", args: "-O2 --lossy=30" },
  { label: "lossy 60", args: "-O2 --lossy=60" },
  { label: "lossy 100", args: "-O2 --lossy=100" },
  { label: "lossy 100, 128 кольорів", args: "-O2 --lossy=100 --colors 128" },
  { label: "lossy 160, 128 кольорів", args: "-O3 --lossy=160 --colors 128" },
  { label: "lossy 160, 64 кольори", args: "-O3 --lossy=160 --colors 64" },
  { label: "lossy 200, 64 кольори", args: "-O3 --lossy=200 --colors 64" },
  { label: "lossy 200, 32 кольори", args: "-O3 --lossy=200 --colors 32" },
];

export async function optimizeGif(
  blob: Blob,
  limit: number = FILE_LIMIT_BYTES,
  onProgress?: (attempt: OptimizeAttempt) => void,
): Promise<OptimizeResult> {
  if (blob.size <= limit) {
    return { blob, bytes: blob.size, applied: null, fits: true };
  }
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  let best: { blob: Blob; attempt: OptimizeAttempt } | null = null;
  for (const attempt of LADDER) {
    onProgress?.(attempt);
    const files = await gifsicle.run({
      input: [{ file: blob, name: "in.gif" }],
      command: [`${attempt.args} in.gif -o /out/out.gif`],
    });
    const out = files[0];
    if (!out) continue;
    if (!best || out.size < best.blob.size) {
      best = { blob: out, attempt };
    }
    if (out.size <= limit) break;
  }
  if (!best) {
    return { blob, bytes: blob.size, applied: null, fits: false };
  }
  return {
    blob: best.blob,
    bytes: best.blob.size,
    applied: best.attempt,
    fits: best.blob.size <= limit,
  };
}
