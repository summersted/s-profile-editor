/**
 * Undo/redo history, pure and immutable. A new change after some undos
 * drops the redo branch; at most `limit` past states are kept.
 *
 * Changes that carry the same `mergeKey` within `mergeMs` of each other are
 * folded into one step — a whole drag, or a burst of typing, undoes at once.
 */

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Merge key and time of the latest change, for folding. */
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 50;
const MERGE_MS = 1000;

export function historyInit<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function historyPush<T>(
  h: History<T>,
  next: T,
  { mergeKey = null, now = Date.now(), limit = HISTORY_LIMIT }: { mergeKey?: string | null; now?: number; limit?: number } = {},
): History<T> {
  if (next === h.present) return h;
  const fold = mergeKey !== null && mergeKey === h.lastKey && now - h.lastAt <= MERGE_MS && h.future.length === 0;
  if (fold) return { ...h, present: next, lastAt: now };
  const past = [...h.past, h.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, present: next, future: [], lastKey: mergeKey, lastAt: now };
}

export function historyUndo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function historyRedo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}
