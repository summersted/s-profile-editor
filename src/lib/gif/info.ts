/**
 * Minimal GIF block scanner: reads only the metadata we need (canvas size,
 * frame count, per-frame delays) by walking block headers. Pixel data is
 * skipped, never decompressed or copied, so this stays fast on huge files.
 */

export interface GifInfo {
  width: number;
  height: number;
  frameCount: number;
  /** Raw per-frame delays in centiseconds, exactly as stored in the file. */
  delaysCs: number[];
}

const EXTENSION = 0x21;
const IMAGE = 0x2c;
const GRAPHIC_CONTROL = 0xf9;

export function parseGifInfo(bytes: Uint8Array): GifInfo {
  if (bytes.length < 13 || ascii(bytes, 0, 3) !== "GIF") {
    throw new Error("Це не GIF-файл");
  }
  const width = u16(bytes, 6);
  const height = u16(bytes, 8);
  let pos = 13 + colorTableBytes(bytes[10]);

  const delaysCs: number[] = [];
  let pendingDelay = 0;

  // A truncated file simply ends the walk: we report the frames that are there.
  while (pos < bytes.length) {
    const block = bytes[pos++];
    if (block === EXTENSION) {
      const label = bytes[pos++];
      if (label === GRAPHIC_CONTROL && bytes[pos] === 4 && pos + 5 < bytes.length) {
        pendingDelay = u16(bytes, pos + 2);
      }
      pos = skipSubBlocks(bytes, pos);
    } else if (block === IMAGE) {
      if (pos + 9 > bytes.length) break;
      pos += 9 + colorTableBytes(bytes[pos + 8]);
      pos = skipSubBlocks(bytes, pos + 1); // +1: LZW minimum code size
      delaysCs.push(pendingDelay);
      pendingDelay = 0;
    } else {
      // Trailer, or garbage we can't interpret — either way the walk is over.
      break;
    }
  }

  return { width, height, frameCount: delaysCs.length, delaysCs };
}

/**
 * Browsers play delays of 0–1cs as 10cs (legacy "too fast to be intended").
 * Use this whenever timing must match what the user actually sees.
 */
export function effectiveDelayCs(delayCs: number): number {
  return delayCs <= 1 ? 10 : delayCs;
}

export function gifDurationMs(info: GifInfo): number {
  return info.delaysCs.reduce((sum, d) => sum + effectiveDelayCs(d), 0) * 10;
}

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function ascii(bytes: Uint8Array, from: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + len));
}

/** Size of the color table announced by a packed-fields byte, 0 if absent. */
function colorTableBytes(packed: number): number {
  return packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
}

/** Skip a chain of length-prefixed sub-blocks; returns the position after the terminator. */
function skipSubBlocks(bytes: Uint8Array, pos: number): number {
  while (pos < bytes.length) {
    const size = bytes[pos++];
    if (size === 0) break;
    pos += size;
  }
  return pos;
}
