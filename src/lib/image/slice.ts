import { mapPool } from "../async";
import { GIF_INPUT, gifConcurrency, runGifsicle, type GifsicleRunner } from "../gif/gifsicle";
import { pixelRect } from "../steam/plan";
import type { PlannedSlice, Size, SlicePlan, SourceImage, SourceKind } from "../types";

/** One cut slot file, before it gets a blob URL in the UI layer. */
export interface SliceCut {
  index: number;
  blob: Blob;
  filename: string;
  kind: SourceKind;
  width: number;
  height: number;
}

type Progress = (done: number, total: number) => void;

/**
 * Cut the source into per-slot files according to the plan.
 * Static images go through canvas (PNG out); GIFs go through gifsicle-wasm
 * so animation, timing and transparency survive untouched.
 */
export function slice(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: Progress,
): Promise<SliceCut[]> {
  return source.kind === "gif"
    ? sliceGif(source, plan, onProgress)
    : sliceStatic(source, plan, onProgress);
}

async function sliceStatic(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: Progress,
): Promise<SliceCut[]> {
  const bitmap = await createImageBitmap(source.file);
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context недоступний");

    const cuts: SliceCut[] = [];
    for (const s of plan.slices) {
      const crop = pixelRect(s.source, source);
      // Resizing the canvas also clears it, so one canvas serves every slice.
      canvas.width = s.output.w;
      canvas.height = s.output.h;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, s.output.w, s.output.h);
      cuts.push(toCut(s, await canvasToPng(canvas), "static"));
      onProgress?.(cuts.length, plan.slices.length);
    }
    return cuts;
  } finally {
    bitmap.close();
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Не вдалося закодувати PNG"))),
      "image/png",
    ),
  );
}

async function sliceGif(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: Progress,
  run: GifsicleRunner = runGifsicle,
): Promise<SliceCut[]> {
  // Read the file once; every worker gets its own clone of this buffer.
  const input = await source.file.arrayBuffer();
  let done = 0;
  return mapPool(plan.slices, gifConcurrency(), async (s) => {
    const blob = await run(input, gifSliceArgs(s, source));
    if (!blob) throw new Error(`gifsicle не повернув слот ${s.index + 1}`);
    onProgress?.(++done, plan.slices.length);
    return toCut(s, blob, "gif");
  });
}

/**
 * gifsicle args for one slice: crop, resize only if the crop isn't already
 * the right size, and a lossless -O2 pass — cropped/resized frames come out
 * unoptimized otherwise, several times bigger than they need to be.
 */
export function gifSliceArgs(s: PlannedSlice, bounds: Size): string {
  const crop = pixelRect(s.source, bounds);
  const args = ["-O2", `--crop ${crop.x},${crop.y}+${crop.w}x${crop.h}`];
  if (crop.w !== s.output.w || crop.h !== s.output.h) {
    args.push(`--resize ${s.output.w}x${s.output.h}`);
  }
  args.push(GIF_INPUT);
  return args.join(" ");
}

function toCut(s: PlannedSlice, blob: Blob, kind: SourceKind): SliceCut {
  return {
    index: s.index,
    blob,
    filename: `slice-${s.index + 1}.${kind === "gif" ? "gif" : "png"}`,
    kind,
    width: s.output.w,
    height: s.output.h,
  };
}
