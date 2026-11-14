/**
 * Find the first ladder rung whose output fits the target, assuming output
 * size shrinks along the ladder. Gallops (0, 1, 2, 4, 8…) then bisects, so a
 * file that needs only a light touch costs 1–2 attempts and the worst case is
 * ~2·log2(n) instead of n. If nothing fits, returns the smallest output seen.
 *
 * `onProgress(done, total)` is called before every attempt and once at the
 * end: `total` is the worst-case number of attempts still possible given what
 * is known so far, so it only ever shrinks and `done/total` is a true lower
 * bound on progress (it reaches 1 exactly when the search ends).
 */
export async function firstFitting<S>(
  ladder: readonly S[],
  attempt: (step: S) => Promise<Blob | null>,
  target: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob | null; step: S }> {
  const outputs = new Map<number, Blob | null>();
  const known = new Map<number, boolean>();
  const fitsAt = async (i: number): Promise<boolean> => {
    if (!known.has(i)) {
      onProgress?.(known.size, worstCaseAttempts(ladder.length, known));
      const out = await attempt(ladder[i]);
      outputs.set(i, out);
      known.set(i, !!out && out.size <= target);
    }
    return known.get(i)!;
  };

  const hi = await searchFirstFit(ladder.length, fitsAt);
  onProgress?.(known.size, known.size);

  if (hi >= 0) return { blob: outputs.get(hi) ?? null, step: ladder[hi] };

  // Nothing fits: best effort is the smallest thing we produced.
  let best = ladder.length - 1;
  for (const [i, out] of outputs) {
    const bestOut = outputs.get(best);
    if (out && (!bestOut || out.size < bestOut.size)) best = i;
  }
  return { blob: outputs.get(best) ?? null, step: ladder[best] };
}

/**
 * The search itself, over indexes 0..n-1. Returns the first index that fits, or -1.
 * `simulate` below mirrors it synchronously for the progress estimate — keep the
 * two in step (a test checks they make the same number of attempts).
 */
async function searchFirstFit(n: number, fitsAt: (i: number) => Promise<boolean>): Promise<number> {
  const last = n - 1;
  // Gallop: `lo` is the last rung known not to fit, `hi` the first known to fit.
  let lo = -1;
  let hi = 0;
  while (!(await fitsAt(hi))) {
    lo = hi;
    if (hi === last) return -1;
    hi = Math.min(last, hi === 0 ? 1 : hi * 2);
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await fitsAt(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Most attempts the search can still make in total, given the outcomes already
 * `known`: replays it for every first-fit position consistent with them.
 */
export function worstCaseAttempts(n: number, known: ReadonlyMap<number, boolean> = new Map()): number {
  let worst = known.size;
  // fitPos = n means "nothing fits".
  for (let fitPos = 0; fitPos <= n; fitPos++) {
    let consistent = true;
    for (const [i, fits] of known) {
      if (fits !== i >= fitPos) {
        consistent = false;
        break;
      }
    }
    if (!consistent) continue;
    worst = Math.max(worst, simulate(n, fitPos));
  }
  return worst;
}

/** Number of distinct attempts the search makes when everything from `fitPos` on fits. */
function simulate(n: number, fitPos: number): number {
  const seen = new Set<number>();
  const fits = (i: number) => {
    seen.add(i);
    return i >= fitPos;
  };
  const last = n - 1;
  let lo = -1;
  let hi = 0;
  while (!fits(hi)) {
    lo = hi;
    if (hi === last) return seen.size;
    hi = Math.min(last, hi === 0 ? 1 : hi * 2);
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return seen.size;
}
