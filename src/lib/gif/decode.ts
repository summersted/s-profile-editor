import { AppError } from "../errors";
import { effectiveDelayCs } from "./info";

/**
 * Full GIF decoder: turns every frame into a complete RGBA image of the
 * logical screen, applying transparency, interlacing, local palettes and the
 * disposal methods, exactly as a browser would show it.
 */

export interface DecodedFrame {
  /** RGBA, `width * height * 4` bytes (or the crop size, see `crop`). */
  data: Uint8ClampedArray;
  /** Delay as played by browsers, centiseconds (0–1 → 10). */
  delayCs: number;
}

export interface DecodedGif {
  width: number;
  height: number;
  frames: DecodedFrame[];
}

export interface DecodeOptions {
  /**
   * Keep only this region of each frame (logical-screen px). Lets a huge
   * background GIF be decoded while only the panel-sized piece is kept in
   * memory. Parts of the region outside the screen stay transparent.
   */
  crop?: { x: number; y: number; w: number; h: number };
  /** Called after each decoded frame. */
  onFrame?: (index: number) => void;
}

export function decodeGif(bytes: Uint8Array, { crop, onFrame }: DecodeOptions = {}): DecodedGif {
  if (bytes.length < 13 || bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) {
    throw new AppError("notGif");
  }
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  let pos = 13;
  let globalPalette: Uint8Array | null = null;
  if (packed & 0x80) {
    const size = 3 * (1 << ((packed & 7) + 1));
    globalPalette = bytes.subarray(pos, pos + size);
    pos += size;
  }

  const screen = new Uint8ClampedArray(width * height * 4);
  const out = crop ?? { x: 0, y: 0, w: width, h: height };
  const frames: DecodedFrame[] = [];

  let gce = { disposal: 0, delayCs: 0, transparent: -1 };
  // Disposal 3 ("restore to previous") needs the screen as it was before the frame.
  let saved: Uint8ClampedArray | null = null;

  while (pos < bytes.length) {
    const block = bytes[pos++];
    if (block === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9 && bytes[pos] === 4) {
        const flags = bytes[pos + 1];
        gce = {
          disposal: (flags >> 2) & 7,
          delayCs: bytes[pos + 2] | (bytes[pos + 3] << 8),
          transparent: flags & 1 ? bytes[pos + 4] : -1,
        };
      }
      pos = skipSubBlocks(bytes, pos);
    } else if (block === 0x2c) {
      if (pos + 9 > bytes.length) break;
      const fx = bytes[pos] | (bytes[pos + 1] << 8);
      const fy = bytes[pos + 2] | (bytes[pos + 3] << 8);
      const fw = bytes[pos + 4] | (bytes[pos + 5] << 8);
      const fh = bytes[pos + 6] | (bytes[pos + 7] << 8);
      const fpacked = bytes[pos + 8];
      pos += 9;
      let palette = globalPalette;
      if (fpacked & 0x80) {
        const size = 3 * (1 << ((fpacked & 7) + 1));
        palette = bytes.subarray(pos, pos + size);
        pos += size;
      }
      const interlaced = (fpacked & 0x40) !== 0;
      const minCodeSize = bytes[pos++];
      const { data: lzw, end } = readSubBlocks(bytes, pos);
      pos = end;
      const indices = lzwDecode(lzw, minCodeSize, fw * fh);

      if (gce.disposal === 3) saved = screen.slice();
      if (palette) drawFrame(screen, width, height, indices, palette, fx, fy, fw, fh, interlaced, gce.transparent);

      frames.push({ data: extract(screen, width, height, out), delayCs: effectiveDelayCs(gce.delayCs) });
      onFrame?.(frames.length - 1);

      // Dispose before the next frame.
      if (gce.disposal === 2) clearRect(screen, width, height, fx, fy, fw, fh);
      else if (gce.disposal === 3 && saved) screen.set(saved);
      gce = { disposal: 0, delayCs: 0, transparent: -1 };
    } else {
      break; // trailer or garbage
    }
  }

  if (frames.length === 0) throw new AppError("noFrames");
  return { width: out.w, height: out.h, frames };
}

function drawFrame(
  screen: Uint8ClampedArray,
  sw: number,
  sh: number,
  indices: Uint8Array,
  palette: Uint8Array,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
  interlaced: boolean,
  transparent: number,
): void {
  const rowOrder = interlaced ? interlaceRows(fh) : null;
  for (let r = 0; r < fh; r++) {
    const y = fy + (rowOrder ? rowOrder[r] : r);
    if (y >= sh) continue;
    for (let x = 0; x < fw; x++) {
      const sx = fx + x;
      if (sx >= sw) continue;
      const idx = indices[r * fw + x];
      if (idx === transparent || idx * 3 + 2 >= palette.length) continue;
      const o = (y * sw + sx) * 4;
      screen[o] = palette[idx * 3];
      screen[o + 1] = palette[idx * 3 + 1];
      screen[o + 2] = palette[idx * 3 + 2];
      screen[o + 3] = 255;
    }
  }
}

/** Row numbers in the order an interlaced image stores them. */
function interlaceRows(h: number): number[] {
  const rows: number[] = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start; y < h; y += step) rows.push(y);
  }
  return rows;
}

function clearRect(screen: Uint8ClampedArray, sw: number, sh: number, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < Math.min(sh, y0 + h); y++) {
    screen.fill(0, (y * sw + x0) * 4, (y * sw + Math.min(sw, x0 + w)) * 4);
  }
}

function extract(
  screen: Uint8ClampedArray,
  sw: number,
  sh: number,
  r: { x: number; y: number; w: number; h: number },
): Uint8ClampedArray {
  if (r.x === 0 && r.y === 0 && r.w === sw && r.h === sh) return screen.slice();
  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const sy = r.y + y;
    if (sy < 0 || sy >= sh) continue;
    const x0 = Math.max(0, r.x);
    const x1 = Math.min(sw, r.x + r.w);
    if (x1 <= x0) continue;
    out.set(screen.subarray((sy * sw + x0) * 4, (sy * sw + x1) * 4), (y * r.w + (x0 - r.x)) * 4);
  }
  return out;
}

function skipSubBlocks(bytes: Uint8Array, pos: number): number {
  while (pos < bytes.length) {
    const size = bytes[pos++];
    if (size === 0) break;
    pos += size;
  }
  return pos;
}

function readSubBlocks(bytes: Uint8Array, pos: number): { data: Uint8Array; end: number } {
  let total = 0;
  let p = pos;
  while (p < bytes.length && bytes[p] !== 0) {
    total += bytes[p];
    p += bytes[p] + 1;
  }
  const data = new Uint8Array(total);
  let o = 0;
  p = pos;
  while (p < bytes.length && bytes[p] !== 0) {
    const size = bytes[p];
    data.set(bytes.subarray(p + 1, Math.min(bytes.length, p + 1 + size)), o);
    o += size;
    p += size + 1;
  }
  return { data, end: p + 1 };
}

/** Standard GIF LZW decoder. Missing data leaves the rest of the frame at index 0. */
function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let next = clear + 2;
  let old = -1;
  let first = 0;
  let datum = 0;
  let bits = 0;
  let op = 0;

  for (let i = 0; i < clear; i++) {
    prefix[i] = -1;
    suffix[i] = i;
  }

  for (let ip = 0; ip < data.length && op < pixelCount; ) {
    datum |= data[ip++] << bits;
    bits += 8;
    while (bits >= codeSize && op < pixelCount) {
      const code = datum & codeMask;
      datum >>= codeSize;
      bits -= codeSize;

      if (code === clear) {
        codeSize = minCodeSize + 1;
        codeMask = (1 << codeSize) - 1;
        next = clear + 2;
        old = -1;
        continue;
      }
      if (code === eoi) return out;

      if (old === -1) {
        out[op++] = suffix[code];
        old = code;
        first = code;
        continue;
      }

      let sp = 0;
      let cur = code;
      if (code >= next) {
        stack[sp++] = first;
        cur = old;
      }
      while (cur >= clear) {
        stack[sp++] = suffix[cur];
        cur = prefix[cur];
      }
      first = suffix[cur];
      stack[sp++] = first;

      if (next < 4096) {
        prefix[next] = old;
        suffix[next] = first;
        next++;
        if ((next & codeMask) === 0 && next < 4096) {
          codeSize++;
          codeMask = (1 << codeSize) - 1;
        }
      }
      old = code;
      while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
    }
  }
  return out;
}
