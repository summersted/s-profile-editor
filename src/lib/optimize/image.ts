import type { OptimizeOptions, OptimizeResult } from "./optimize";
import { firstFitting } from "./search";
import { JPEG_AUTO_LADDER, type OptimizeSettings } from "./settings";

/**
 * Shrink a still (PNG) slot. Steam takes PNG and JPG, so the only real lever
 * is converting to JPEG and picking the quality.
 *
 * Auto: a PNG that already fits is left alone; otherwise the highest JPEG
 * quality that fits is used (or the smallest one tried, if none does).
 * Manual: PNG = leave as is, JPEG = encode at exactly the chosen quality.
 * Never returns something larger than the input.
 */
export async function optimizeImage(
  blob: Blob,
  settings: OptimizeSettings,
  { onProgress }: Pick<OptimizeOptions, "onProgress"> = {},
): Promise<OptimizeResult> {
  const target = settings.targetBytes;
  const untouched: OptimizeResult = { blob, label: null, fits: blob.size <= target, runs: 0 };

  const manual = settings.mode === "manual";
  if (manual && settings.image.format === "png") return untouched;
  if (!manual && (blob.size <= target || !settings.auto.jpeg)) return untouched;

  onProgress?.({ phase: { kind: "decode" }, done: 0, total: 1 });
  const bitmap = await createImageBitmap(blob);
  try {
    let runs = 0;
    let bounds = { done: 0, total: 1 };
    const attempt = (quality: number): Promise<Blob | null> => {
      onProgress?.({ phase: { kind: "attempt", label: { type: "jpeg", quality } }, ...bounds });
      runs++;
      return encodeJpeg(bitmap, quality);
    };
    const finish = (out: Blob | null, quality: number): OptimizeResult =>
      out && out.size < blob.size
        ? { blob: out, label: { type: "jpeg", quality }, fits: out.size <= target, runs }
        : { ...untouched, runs };

    if (manual) return finish(await attempt(settings.image.quality), settings.image.quality);
    const found = await firstFitting(JPEG_AUTO_LADDER, attempt, target, (done, total) => {
      bounds = { done, total };
    });
    return finish(found.blob, found.step);
  } finally {
    bitmap.close();
  }
}

function encodeJpeg(bitmap: ImageBitmap, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // JPEG has no alpha; transparent areas (slot past the background edge) would turn black anyway.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
