/**
 * Timing of a composed panel. The output inherits the frame timing of the
 * animated source with the most frames; every other animation loops at its
 * own speed and is sampled at the start time of each output frame.
 */

export interface Timeline {
  /** Output frame delays, centiseconds. A single entry = still image. */
  delaysCs: number[];
  /** Index (into the sources passed in) of the source whose timing is used; -1 = still. */
  master: number;
}

export function buildTimeline(sources: ReadonlyArray<{ delaysCs: readonly number[] }>): Timeline {
  let master = -1;
  for (let i = 0; i < sources.length; i++) {
    const n = sources[i].delaysCs.length;
    if (n > 1 && (master < 0 || n > sources[master].delaysCs.length)) master = i;
  }
  return master < 0 ? { delaysCs: [0], master: -1 } : { delaysCs: [...sources[master].delaysCs], master };
}

/** Start time of every frame, centiseconds. */
export function frameStarts(delaysCs: readonly number[]): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const d of delaysCs) {
    starts.push(t);
    t += d;
  }
  return starts;
}

/** Which frame of a looping animation is on screen at `timeCs`. */
export function frameAt(delaysCs: readonly number[], timeCs: number): number {
  if (delaysCs.length <= 1) return 0;
  const total = delaysCs.reduce((s, d) => s + d, 0);
  if (total <= 0) return 0;
  let t = ((timeCs % total) + total) % total;
  for (let i = 0; i < delaysCs.length; i++) {
    if (t < delaysCs[i]) return i;
    t -= delaysCs[i];
  }
  return delaysCs.length - 1;
}
