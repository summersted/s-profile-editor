import type { Rect, SliceOutput, SlicePlan, SourceImage } from "@/lib/types";

/**
 * Cut the source into per-slot files according to the plan.
 * Static images go through canvas (PNG out); GIFs go through gifsicle-wasm
 * so animation, timing and transparency survive untouched.
 */
export async function slice(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<SliceOutput[]> {
  const outputs =
    source.kind === "gif"
      ? await sliceGif(source, plan, onProgress)
      : await sliceStatic(source, plan, onProgress);
  return outputs;
}

async function sliceStatic(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<SliceOutput[]> {
  const bitmap = await createImageBitmap(source.file);
  try {
    const outputs: SliceOutput[] = [];
    for (const s of plan.slices) {
      const canvas = document.createElement("canvas");
      canvas.width = s.output.w;
      canvas.height = s.output.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context недоступний");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        bitmap,
        s.source.x, s.source.y, s.source.w, s.source.h,
        0, 0, s.output.w, s.output.h,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      outputs.push(toOutput(s.index, blob, "png"));
      onProgress?.(outputs.length, plan.slices.length);
    }
    return outputs;
  } finally {
    bitmap.close();
  }
}

async function sliceGif(
  source: SourceImage,
  plan: SlicePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<SliceOutput[]> {
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  const outputs: SliceOutput[] = [];
  // One gifsicle.run per slice: crop + resize in a single pass.
  for (const s of plan.slices) {
    const crop = cropArg(s.source, source);
    const resize = `--resize ${s.output.w}x${s.output.h}`;
    const files = await gifsicle.run({
      input: [{ file: source.file, name: "in.gif" }],
      command: [`--crop ${crop} ${resize} in.gif -o /out/slice.gif`],
    });
    if (!files[0]) throw new Error(`gifsicle не повернув slice ${s.index}`);
    outputs.push(toOutput(s.index, files[0], "gif"));
    onProgress?.(outputs.length, plan.slices.length);
  }
  return outputs;
}

/** gifsicle --crop X,Y+WxH with the rect clamped to the gif bounds. */
function cropArg(r: Rect, bounds: { width: number; height: number }): string {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  const w = Math.min(bounds.width - x, Math.max(1, Math.round(r.w)));
  const h = Math.min(bounds.height - y, Math.max(1, Math.round(r.h)));
  return `${x},${y}+${w}x${h}`;
}

function toOutput(index: number, blob: Blob, ext: string): SliceOutput {
  return {
    index,
    blob,
    url: URL.createObjectURL(blob),
    bytes: blob.size,
    filename: `slice-${index + 1}.${ext}`,
  };
}

export function releaseOutputs(outputs: SliceOutput[]): void {
  for (const o of outputs) URL.revokeObjectURL(o.url);
}
