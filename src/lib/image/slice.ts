import { mapPool } from "../async";
import { AppError } from "../errors";
import { GIF_INPUT, gifConcurrency, runGifsicle, type GifsicleRunner } from "../gif/gifsicle";
import { cropBox, ownFileCrop, panelKey } from "../steam/plan";
import type { Rect, Size, SlicePlan, SourceImage, SourceKind } from "../types";

/** One cut slot file, before it gets a blob URL in the UI layer. */
export interface SliceCut {
  index: number;
  blob: Blob;
  kind: SourceKind;
  width: number;
  height: number;
  /** True if the slot was filled from the user's own file, not the background. */
  custom: boolean;
}

export interface SliceOptions {
  onProgress?: (done: number, total: number) => void;
  /** Stops starting new slots. Whatever was cut before the abort is returned. */
  signal?: AbortSignal;
  /** `panelKey` → user's own file covering that whole panel instead of the background. */
  overrides?: Readonly<Record<string, SourceImage>>;
  /** Slot indexes not to cut (the caller already has them). */
  skip?: ReadonlySet<number>;
}

/** One file to produce: which image, which region of it, at what size. */
interface CutJob {
  index: number;
  image: SourceImage;
  rect: Rect;
  output: { w: number; h: number };
  custom: boolean;
}

/**
 * Cut the plan's slots into files. A slot gets the piece of background under
 * it, or — if its panel has an own file — its piece of that file (fitted to the
 * whole panel, see `ownFileRect`). Slots entirely outside the background with
 * no own file are skipped.
 *
 * Stills go through canvas (PNG out); GIFs through gifsicle-wasm workers, so
 * animation, timing and transparency survive.
 */
export async function slice(
  source: SourceImage,
  plan: SlicePlan,
  { onProgress, signal, overrides = {}, skip }: SliceOptions = {},
): Promise<SliceCut[]> {
  const jobs: CutJob[] = [];
  for (const s of plan.slices) {
    if (skip?.has(s.index)) continue;
    const own = overrides[panelKey(s.panel)];
    if (own) {
      const rect = ownFileCrop(own, plan.panels[s.panel].strip, s.page);
      jobs.push({ index: s.index, image: own, rect, output: s.output, custom: true });
    } else if (s.coverage > 0) {
      jobs.push({ index: s.index, image: source, rect: s.source, output: s.output, custom: false });
    }
  }

  let done = 0;
  const tick = () => onProgress?.(++done, jobs.length);
  const [gifs, stills] = await Promise.all([
    cutGifs(jobs.filter((j) => j.image.kind === "gif"), tick, signal),
    cutStills(jobs.filter((j) => j.image.kind === "static"), tick, signal),
  ]);
  return [...gifs, ...stills].sort((a, b) => a.index - b.index);
}

async function cutStills(jobs: CutJob[], tick: () => void, signal?: AbortSignal): Promise<SliceCut[]> {
  if (jobs.length === 0) return [];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AppError("canvasUnavailable");

  // Decode each distinct image once, however many slots it feeds.
  const bitmaps = new Map<SourceImage, ImageBitmap>();
  try {
    const cuts: SliceCut[] = [];
    for (const job of jobs) {
      if (signal?.aborted) break;
      let bitmap = bitmaps.get(job.image);
      if (!bitmap) {
        bitmap = await createImageBitmap(job.image.file);
        bitmaps.set(job.image, bitmap);
      }
      const { crop, visible } = cropBox(job.rect, job.image);
      // Resizing the canvas also clears it, so one canvas serves every slice.
      canvas.width = job.output.w;
      canvas.height = job.output.h;
      ctx.imageSmoothingQuality = "high";
      // Only the part that exists in the image is drawn; past the edge stays transparent.
      ctx.drawImage(
        bitmap,
        visible.x, visible.y, visible.w, visible.h,
        0, 0,
        Math.round((job.output.w * visible.w) / crop.w),
        Math.round((job.output.h * visible.h) / crop.h),
      );
      cuts.push(toCut(job, await canvasToPng(canvas), "static"));
      tick();
    }
    return cuts;
  } finally {
    for (const b of bitmaps.values()) b.close();
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new AppError("encodeFailed"))),
      "image/png",
    ),
  );
}

async function cutGifs(
  jobs: CutJob[],
  tick: () => void,
  signal?: AbortSignal,
  run: GifsicleRunner = runGifsicle,
): Promise<SliceCut[]> {
  if (jobs.length === 0) return [];
  // Read each file once; every worker gets its own clone of the buffer.
  const buffers = new Map<File, Promise<ArrayBuffer>>();
  const bytesOf = (file: File) => {
    let buf = buffers.get(file);
    if (!buf) {
      buf = file.arrayBuffer();
      buffers.set(file, buf);
    }
    return buf;
  };

  const cuts = await mapPool(
    jobs,
    gifConcurrency(),
    async (job) => {
      const blob = await run(await bytesOf(job.image.file), gifSliceArgs(job.rect, job.output, job.image));
      if (!blob) throw new AppError("gifsicleNoOutput", { slot: job.index + 1 });
      tick();
      return toCut(job, blob, "gif");
    },
    signal,
  );
  return cuts.filter(Boolean);
}

/**
 * gifsicle args for one cut: crop, resize only if the crop isn't already the
 * right size, and a lossless -O2 pass — cropped/resized frames come out
 * unoptimized otherwise, several times bigger than they need to be.
 */
export function gifSliceArgs(rect: Rect, output: { w: number; h: number }, bounds: Size): string {
  const { crop } = cropBox(rect, bounds);
  const args = ["-O2", `--crop ${crop.x},${crop.y}+${crop.w}x${crop.h}`];
  if (crop.w !== output.w || crop.h !== output.h) {
    args.push(`--resize ${output.w}x${output.h}`);
  }
  args.push(GIF_INPUT);
  return args.join(" ");
}

function toCut(job: CutJob, blob: Blob, kind: SourceKind): SliceCut {
  return {
    index: job.index,
    blob,
    kind,
    width: job.output.w,
    height: job.output.h,
    custom: job.custom,
  };
}
