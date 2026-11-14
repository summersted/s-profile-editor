/**
 * Minimal animated GIF encoder for full RGBA frames. Pure TypeScript, no DOM,
 * so it runs in a Web Worker (see encode.worker.ts) and in tests.
 *
 * Every frame gets its own 256-colour palette: exact if the frame has ≤ 256
 * colours, otherwise median cut over a 5-bit-per-channel histogram. Frames
 * are written whole; run gifsicle -O2 afterwards to turn them into diffs.
 */

export interface Quantized {
  /** 256 × RGB. */
  palette: Uint8Array;
  indices: Uint8Array;
  /** Palette index used for transparent pixels, or -1 if the frame is opaque. */
  transparent: number;
}

/** Pixels with alpha below this are written as transparent. */
const ALPHA_CUTOFF = 128;

export function quantize(rgba: Uint8ClampedArray | Uint8Array): Quantized {
  const n = rgba.length >> 2;
  let hasTransparent = false;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < ALPHA_CUTOFF) {
      hasTransparent = true;
      break;
    }
  }
  const maxColors = hasTransparent ? 255 : 256;
  const transparent = hasTransparent ? 255 : -1;

  return (
    exactPalette(rgba, n, maxColors, transparent) ?? medianCutPalette(rgba, n, maxColors, transparent)
  );
}

/** Frames with few colours (flat art, text) keep them exactly. */
function exactPalette(
  rgba: Uint8ClampedArray | Uint8Array,
  n: number,
  maxColors: number,
  transparent: number,
): Quantized | null {
  const map = new Map<number, number>();
  const palette = new Uint8Array(768);
  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o + 3] < ALPHA_CUTOFF) {
      indices[i] = transparent;
      continue;
    }
    const key = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
    let idx = map.get(key);
    if (idx === undefined) {
      if (map.size >= maxColors) return null;
      idx = map.size;
      map.set(key, idx);
      palette[idx * 3] = rgba[o];
      palette[idx * 3 + 1] = rgba[o + 1];
      palette[idx * 3 + 2] = rgba[o + 2];
    }
    indices[i] = idx;
  }
  return { palette, indices, transparent };
}

interface Box {
  r0: number; r1: number;
  g0: number; g1: number;
  b0: number; b1: number;
  count: number;
}

const BINS = 32; // 5 bits per channel
const bin = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

function medianCutPalette(
  rgba: Uint8ClampedArray | Uint8Array,
  n: number,
  maxColors: number,
  transparent: number,
): Quantized {
  const count = new Uint32Array(BINS * BINS * BINS);
  const sumR = new Float64Array(count.length);
  const sumG = new Float64Array(count.length);
  const sumB = new Float64Array(count.length);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o + 3] < ALPHA_CUTOFF) continue;
    const k = bin(rgba[o], rgba[o + 1], rgba[o + 2]);
    count[k]++;
    sumR[k] += rgba[o];
    sumG[k] += rgba[o + 1];
    sumB[k] += rgba[o + 2];
  }

  const boxCount = (b: Box) => {
    let c = 0;
    for (let r = b.r0; r <= b.r1; r++)
      for (let g = b.g0; g <= b.g1; g++)
        for (let bb = b.b0; bb <= b.b1; bb++) c += count[(r << 10) | (g << 5) | bb];
    return c;
  };
  /** Shrink a box to the bins that are actually used. */
  const shrink = (b: Box): Box => {
    let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0;
    for (let r = b.r0; r <= b.r1; r++)
      for (let g = b.g0; g <= b.g1; g++)
        for (let bb = b.b0; bb <= b.b1; bb++) {
          if (!count[(r << 10) | (g << 5) | bb]) continue;
          if (r < r0) r0 = r; if (r > r1) r1 = r;
          if (g < g0) g0 = g; if (g > g1) g1 = g;
          if (bb < b0) b0 = bb; if (bb > b1) b1 = bb;
        }
    const out = { r0, r1, g0, g1, b0, b1, count: 0 };
    out.count = boxCount(out);
    return out;
  };

  let boxes: Box[] = [shrink({ r0: 0, r1: 31, g0: 0, g1: 31, b0: 0, b1: 31, count: 0 })];
  if (boxes[0].count === 0) boxes = [];

  while (boxes.length < maxColors) {
    // Split the box with the biggest (pixels × extent): big, varied regions first.
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const extent = Math.max(b.r1 - b.r0, b.g1 - b.g0, b.b1 - b.b0);
      const score = extent > 0 ? b.count * extent : 0;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    const b = boxes[best];
    const er = b.r1 - b.r0, eg = b.g1 - b.g0, eb = b.b1 - b.b0;
    const axis = er >= eg && er >= eb ? 0 : eg >= eb ? 1 : 2;
    const lo = [b.r0, b.g0, b.b0][axis];
    const hi = [b.r1, b.g1, b.b1][axis];
    // Weighted median along the axis.
    let acc = 0;
    let cut = lo;
    for (let v = lo; v < hi; v++) {
      const slice = { ...b, ...(axis === 0 ? { r0: v, r1: v } : axis === 1 ? { g0: v, g1: v } : { b0: v, b1: v }) };
      acc += boxCount(slice);
      cut = v;
      if (acc * 2 >= b.count) break;
    }
    const left = shrink({ ...b, ...(axis === 0 ? { r1: cut } : axis === 1 ? { g1: cut } : { b1: cut }) });
    const right = shrink({ ...b, ...(axis === 0 ? { r0: cut + 1 } : axis === 1 ? { g0: cut + 1 } : { b0: cut + 1 }) });
    boxes.splice(best, 1, ...[left, right].filter((x) => x.count > 0));
  }

  const palette = new Uint8Array(768);
  const lookup = new Int16Array(count.length).fill(-1);
  boxes.forEach((b, idx) => {
    let r = 0, g = 0, bl = 0, c = 0;
    for (let rr = b.r0; rr <= b.r1; rr++)
      for (let gg = b.g0; gg <= b.g1; gg++)
        for (let bb = b.b0; bb <= b.b1; bb++) {
          const k = (rr << 10) | (gg << 5) | bb;
          if (!count[k]) continue;
          r += sumR[k]; g += sumG[k]; bl += sumB[k]; c += count[k];
          lookup[k] = idx;
        }
    palette[idx * 3] = Math.round(r / c);
    palette[idx * 3 + 1] = Math.round(g / c);
    palette[idx * 3 + 2] = Math.round(bl / c);
  });

  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o + 3] < ALPHA_CUTOFF) {
      indices[i] = transparent;
      continue;
    }
    indices[i] = Math.max(0, lookup[bin(rgba[o], rgba[o + 1], rgba[o + 2])]);
  }
  return { palette, indices, transparent };
}

/** GIF LZW compression of 8-bit indices into length-prefixed sub-blocks. */
export function lzwEncode(indices: Uint8Array, minCodeSize = 8): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  // Worst case is ~1.5 bytes per pixel; grow on demand.
  let out = new Uint8Array(Math.max(1024, indices.length + (indices.length >> 1)));
  let len = 0;
  const block = new Uint8Array(255);
  let blockLen = 0;
  let cur = 0;
  let curBits = 0;

  const writeBlock = () => {
    if (len + blockLen + 1 > out.length) {
      const bigger = new Uint8Array(out.length * 2 + blockLen + 1);
      bigger.set(out.subarray(0, len));
      out = bigger;
    }
    out[len++] = blockLen;
    out.set(block.subarray(0, blockLen), len);
    len += blockLen;
    blockLen = 0;
  };
  const flushByte = (byte: number) => {
    block[blockLen++] = byte;
    if (blockLen === 255) writeBlock();
  };
  let codeSize = minCodeSize + 1;
  const emit = (code: number) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      flushByte(cur & 0xff);
      cur >>>= 8;
      curBits -= 8;
    }
  };

  // Dictionary: (prefix code << 8 | next byte) → code, open addressing.
  const HSIZE = 5003;
  const keys = new Int32Array(HSIZE);
  const codes = new Int32Array(HSIZE);
  const reset = () => {
    keys.fill(-1);
    codeSize = minCodeSize + 1;
    next = eoi + 1;
  };
  let next = eoi + 1;
  reset();
  emit(clear);

  if (indices.length > 0) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const c = indices[i];
      const key = (prefix << 8) | c;
      let h = (c << 4) ^ prefix;
      if (h >= HSIZE) h %= HSIZE;
      let found = -1;
      while (keys[h] !== -1) {
        if (keys[h] === key) {
          found = codes[h];
          break;
        }
        h = h === 0 ? HSIZE - 1 : h - 1;
      }
      if (found >= 0) {
        prefix = found;
        continue;
      }
      emit(prefix);
      if (next < 4096) {
        keys[h] = key;
        codes[h] = next++;
        if (next > 1 << codeSize && codeSize < 12) codeSize++;
      } else {
        emit(clear);
        reset();
      }
      prefix = c;
    }
    emit(prefix);
  }
  emit(eoi);
  if (curBits > 0) flushByte(cur & 0xff);
  if (blockLen) writeBlock();
  if (len + 1 > out.length) {
    const bigger = new Uint8Array(len + 1);
    bigger.set(out.subarray(0, len));
    out = bigger;
  }
  out[len++] = 0; // block terminator
  return out.slice(0, len);
}

/** Streaming writer: add frames one by one, then `finish()` for the file bytes. */
export class GifWriter {
  private chunks: Uint8Array[] = [];
  private frames = 0;
  /**
   * The last frame is held back: its disposal depends on the next frame. If
   * the next one has transparent holes, this one must be cleared (disposal 2)
   * or it would show through them; otherwise it's kept (1), which lets
   * gifsicle diff the frames later.
   */
  private pending: { gce: Uint8Array; rest: Uint8Array[] } | null = null;

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {
    const head = new Uint8Array(13 + 19);
    head.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    head.set(u16(width), 6);
    head.set(u16(height), 8);
    head[10] = 0; // no global colour table
    // NETSCAPE2.0: loop forever.
    head.set([0x21, 0xff, 0x0b, ...ascii("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00], 13);
    this.chunks.push(head);
  }

  addFrame(rgba: Uint8ClampedArray | Uint8Array, delayCs: number): void {
    if (rgba.length !== this.width * this.height * 4) throw new Error("frame size mismatch");
    const q = quantize(rgba);
    const hasT = q.transparent >= 0;
    this.flushPending(hasT);
    const delay = Math.max(2, Math.min(65535, Math.round(delayCs)));
    const gce = new Uint8Array([0x21, 0xf9, 0x04, hasT ? 1 : 0, ...u16(delay), hasT ? q.transparent : 0, 0x00]);
    const desc = new Uint8Array([0x2c, 0, 0, 0, 0, ...u16(this.width), ...u16(this.height), 0x80 | 0x07]);
    this.pending = { gce, rest: [desc, q.palette, new Uint8Array([8]), lzwEncode(q.indices, 8)] };
    this.frames++;
  }

  private flushPending(nextHasHoles: boolean): void {
    if (!this.pending) return;
    const { gce, rest } = this.pending;
    gce[3] |= (nextHasHoles ? 2 : 1) << 2;
    this.chunks.push(gce, ...rest);
    this.pending = null;
  }

  get frameCount(): number {
    return this.frames;
  }

  finish(): Uint8Array {
    this.flushPending(false);
    const total = this.chunks.reduce((s, c) => s + c.length, 0) + 1;
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    out[o] = 0x3b; // trailer
    this.chunks = [];
    return out;
  }
}

function u16(v: number): [number, number] {
  return [v & 0xff, (v >> 8) & 0xff];
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}
