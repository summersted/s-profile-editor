import { parseGIF, decompressFrames } from "gifuct-js";
import type { SourceImage } from "@/lib/types";

/** Read the dropped file and extract the metadata the planner needs. */
export async function loadSource(file: File): Promise<SourceImage> {
  const isGif =
    file.type === "image/gif" || /\.gif$/i.test(file.name);
  return isGif ? loadGif(file) : loadStatic(file);
}

async function loadGif(file: File): Promise<SourceImage> {
  const buf = await file.arrayBuffer();
  const gif = parseGIF(buf);
  // buildPatch=false: we only need per-frame delay + logical screen size here.
  const frames = decompressFrames(gif, false);
  if (frames.length === 0) {
    throw new Error("GIF не містить жодного кадру");
  }
  const durationMs = frames.reduce(
    // Browsers clamp tiny delays to 100ms; mirror that so the preview math matches.
    (sum, f) => sum + (f.delay && f.delay >= 20 ? f.delay : 100),
    0,
  );
  return {
    file,
    kind: "gif",
    width: gif.lsd.width,
    height: gif.lsd.height,
    frameCount: frames.length,
    durationMs,
    previewUrl: URL.createObjectURL(file),
  };
}

async function loadStatic(file: File): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file);
  const source: SourceImage = {
    file,
    kind: "static",
    width: bitmap.width,
    height: bitmap.height,
    frameCount: 1,
    durationMs: 0,
    previewUrl: URL.createObjectURL(file),
  };
  bitmap.close();
  return source;
}

export function releaseSource(source: SourceImage): void {
  URL.revokeObjectURL(source.previewUrl);
}
