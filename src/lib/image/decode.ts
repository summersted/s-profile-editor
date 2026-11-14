import { gifDurationMs, parseGifInfo } from "../gif/info";
import type { SourceImage } from "../types";

/** Read the dropped file and extract the metadata the planner needs. */
export async function loadSource(file: File): Promise<SourceImage> {
  const isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
  const meta = isGif ? await readGif(file) : await readStatic(file);
  if (meta.width < 1 || meta.height < 1) {
    throw new Error("Зображення має нульовий розмір");
  }
  return { file, ...meta, previewUrl: URL.createObjectURL(file) };
}

type SourceMeta = Omit<SourceImage, "file" | "previewUrl">;

async function readGif(file: File): Promise<SourceMeta> {
  const info = parseGifInfo(new Uint8Array(await file.arrayBuffer()));
  if (info.frameCount === 0) {
    throw new Error("GIF не містить жодного кадру");
  }
  return {
    kind: "gif",
    width: info.width,
    height: info.height,
    frameCount: info.frameCount,
    durationMs: info.frameCount > 1 ? gifDurationMs(info) : 0,
  };
}

async function readStatic(file: File): Promise<SourceMeta> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не вдалося прочитати файл як зображення (підтримуються GIF, PNG, JPG)");
  }
  const meta: SourceMeta = {
    kind: "static",
    width: bitmap.width,
    height: bitmap.height,
    frameCount: 1,
    durationMs: 0,
  };
  bitmap.close();
  return meta;
}

export function releaseSource(source: SourceImage): void {
  URL.revokeObjectURL(source.previewUrl);
}
