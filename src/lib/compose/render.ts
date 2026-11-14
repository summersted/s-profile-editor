import { AppError } from "../errors";
import { decodeGif } from "../gif/decode";
import { createGifEncoder } from "../gif/encoder-client";
import { GIF_INPUT, runGifsicle } from "../gif/gifsicle";
import type { Rect, SourceImage } from "../types";
import { buildTimeline, frameAt, frameStarts } from "./timeline";
import { TEXT_LINE_HEIGHT, textFont, type Composition, type TextLayer } from "./types";

/** What the panel shows under the layers: an image and the region of it covering the strip. */
export interface RenderBase {
  image: SourceImage;
  /** Image px; may run past the image edges (that part stays transparent). */
  rect: Rect;
}

export type RenderStage = "decode" | "draw" | "optimize";

export interface RenderProgress {
  stage: RenderStage;
  done: number;
  total: number;
}

export interface RenderInput {
  /** Strip size, page px. */
  strip: { w: number; h: number };
  /** Export px per page px. */
  density: number;
  base: RenderBase;
  composition: Composition;
  media: ReadonlyMap<string, SourceImage>;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}

/** Decoded image ready for drawing: one bitmap per frame (one for stills). */
interface Drawable {
  frames: ImageBitmap[];
  delaysCs: number[];
  /** Image px of the frames' top-left corner (non-zero when decoded with a crop). */
  origin: { x: number; y: number };
}

/**
 * Render a panel composition to a file the size of the strip × density:
 * a PNG if nothing moves, otherwise a GIF timed after the animated source
 * with the most frames. Canvas drawing happens here; GIF encoding runs in a
 * worker, then gifsicle -O2 turns full frames into compact diffs.
 */
export async function renderComposition(input: RenderInput): Promise<File> {
  const { strip, density, base, composition, media, onProgress, signal } = input;
  const W = Math.max(1, Math.round(strip.w * density));
  const H = Math.max(1, Math.round(strip.h * density));

  const mediaIds = [...new Set(composition.layers.flatMap((l) => (l.kind === "media" && media.has(l.mediaId) ? [l.mediaId] : [])))];
  const drawables: Drawable[] = [];
  const layerDrawable = new Map<string, Drawable>();
  const report = (stage: RenderStage, done: number, total: number) => onProgress?.({ stage, done, total });

  try {
    report("decode", 0, mediaIds.length + 1);
    const baseDrawable = await loadDrawable(base.image, base.rect);
    drawables.push(baseDrawable);
    for (const [i, id] of mediaIds.entries()) {
      throwIfAborted(signal);
      report("decode", i + 1, mediaIds.length + 1);
      const d = await loadDrawable(media.get(id)!);
      drawables.push(d);
      layerDrawable.set(id, d);
    }

    const timeline = buildTimeline(drawables);
    const starts = frameStarts(timeline.delaysCs);
    const animated = timeline.delaysCs.length > 1;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: animated });
    if (!ctx) throw new AppError("canvasUnavailable");
    ctx.imageSmoothingQuality = "high";

    const total = timeline.delaysCs.length;
    const encoder = animated ? createGifEncoder(W, H) : null;
    try {
      for (let i = 0; i < total; i++) {
        throwIfAborted(signal);
        report("draw", i, total);
        const t = starts[i];
        ctx.clearRect(0, 0, W, H);

        const bf = baseDrawable.frames[frameAt(baseDrawable.delaysCs, t)];
        ctx.drawImage(
          bf,
          base.rect.x - baseDrawable.origin.x,
          base.rect.y - baseDrawable.origin.y,
          base.rect.w,
          base.rect.h,
          0,
          0,
          W,
          H,
        );

        for (const layer of composition.layers) {
          ctx.save();
          ctx.translate(layer.x * density, layer.y * density);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          if (layer.kind === "media") {
            const d = layerDrawable.get(layer.mediaId);
            if (d) {
              const w = layer.w * density;
              const h = layer.h * density;
              ctx.drawImage(d.frames[frameAt(d.delaysCs, t)], -w / 2, -h / 2, w, h);
            }
          } else {
            drawTextLayer(ctx, layer, density);
          }
          ctx.restore();
        }

        if (encoder) await encoder.addFrame(ctx.getImageData(0, 0, W, H).data, timeline.delaysCs[i]);
      }
      report("draw", total, total);

      if (!encoder) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError("encodeFailed"))), "image/png"),
        );
        return new File([blob], "panel.png", { type: "image/png" });
      }

      const raw = await encoder.finish();
      throwIfAborted(signal);
      report("optimize", 0, 1);
      const rawBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
      const optimized = await runGifsicle(rawBuffer, `-O2 ${GIF_INPUT}`);
      const out = optimized && optimized.size < raw.byteLength ? optimized : new Blob([rawBuffer], { type: "image/gif" });
      report("optimize", 1, 1);
      return new File([out], "panel.gif", { type: "image/gif" });
    } finally {
      encoder?.dispose();
    }
  } finally {
    for (const d of drawables) for (const f of d.frames) f.close();
  }
}

/** Draw a text layer centred on the current origin. Shared idea with the editor's CSS. */
export function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, scale: number): void {
  ctx.font = textFont(layer, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const lines = layer.text.split("\n");
  const lh = layer.fontSize * TEXT_LINE_HEIGHT * scale;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    if (layer.strokeWidth > 0) {
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineWidth = layer.strokeWidth * 2 * scale;
      ctx.strokeText(line, 0, y);
    }
    ctx.fillStyle = layer.color;
    ctx.fillText(line, 0, y);
  });
}

async function loadDrawable(image: SourceImage, crop?: Rect): Promise<Drawable> {
  if (image.kind === "static") {
    return { frames: [await createImageBitmap(image.file)], delaysCs: [0], origin: { x: 0, y: 0 } };
  }
  const bytes = new Uint8Array(await image.file.arrayBuffer());
  // Only keep the region we draw from: a whole 1920×1080 GIF background × N frames would not fit in memory.
  const box = crop
    ? {
        x: Math.floor(crop.x),
        y: Math.floor(crop.y),
        w: Math.max(1, Math.ceil(crop.x + crop.w) - Math.floor(crop.x)),
        h: Math.max(1, Math.ceil(crop.y + crop.h) - Math.floor(crop.y)),
      }
    : undefined;
  const gif = decodeGif(bytes, { crop: box });
  const frames: ImageBitmap[] = [];
  for (const f of gif.frames) {
    frames.push(await createImageBitmap(new ImageData(new Uint8ClampedArray(f.data), gif.width, gif.height)));
  }
  return {
    frames,
    delaysCs: gif.frames.map((f) => f.delayCs),
    origin: box ? { x: box.x, y: box.y } : { x: 0, y: 0 },
  };
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
}
