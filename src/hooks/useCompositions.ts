"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderComposition, type RenderBase, type RenderProgress } from "@/lib/compose/render";
import { EMPTY_COMPOSITION, type Composition } from "@/lib/compose/types";
import type { Failure } from "@/lib/errors";
import { historyInit, historyPush, historyRedo, historyUndo, type History } from "@/lib/history";
import { loadSource, releaseSource } from "@/lib/image/decode";
import type { SourceImage } from "@/lib/types";

/** The rendered result of a panel's composition. */
export interface AppliedComposition {
  composition: Composition;
  image: SourceImage;
  /** `renderKey` of the inputs it was rendered from; a different key = stale. */
  key: string;
}

export interface PanelEdit {
  history: History<Composition>;
  applied: AppliedComposition | null;
}

export interface ApplyInput {
  strip: { w: number; h: number };
  density: number;
  base: RenderBase;
  media: ReadonlyMap<string, SourceImage>;
}

/** Identity of everything a render depends on besides the composition itself. */
export function renderKey(input: ApplyInput): string {
  const r = input.base.rect;
  return `${input.base.image.previewUrl}|${r.x},${r.y},${r.w},${r.h}|${input.strip.w}x${input.strip.h}@${input.density}`;
}

const EMPTY_EDIT: PanelEdit = { history: historyInit(EMPTY_COMPOSITION), applied: null };

/**
 * Per-panel compositions (keyed by `panelKey`): edit history (undo/redo,
 * 50 steps) and the rendered file that replaces the panel's picture.
 * History is about editing only — optimizing the cut files isn't in it.
 */
export function useCompositions() {
  const [edits, setEdits] = useState<Record<string, PanelEdit>>({});
  const [rendering, setRendering] = useState<Record<string, RenderProgress>>({});
  const [error, setError] = useState<Failure | null>(null);
  const held = useRef<Record<string, PanelEdit>>({});
  const aborts = useRef<Record<string, AbortController>>({});

  const update = useCallback((panel: string, fn: (e: PanelEdit) => PanelEdit) => {
    setEdits((prev) => {
      const next = { ...prev, [panel]: fn(prev[panel] ?? EMPTY_EDIT) };
      held.current = next;
      return next;
    });
  }, []);

  const get = useCallback((panel: string): PanelEdit => edits[panel] ?? EMPTY_EDIT, [edits]);

  /** Change a panel's composition. Same `mergeKey` within a second = one undo step. */
  const change = useCallback(
    (panel: string, fn: (c: Composition) => Composition, mergeKey?: string) =>
      update(panel, (e) => ({ ...e, history: historyPush(e.history, fn(e.history.present), { mergeKey }) })),
    [update],
  );
  const undo = useCallback((panel: string) => update(panel, (e) => ({ ...e, history: historyUndo(e.history) })), [update]);
  const redo = useCallback((panel: string) => update(panel, (e) => ({ ...e, history: historyRedo(e.history) })), [update]);

  /** Render the panel's current composition and make it the panel's picture. */
  const apply = useCallback(
    async (panel: string, input: ApplyInput) => {
      const edit = held.current[panel] ?? EMPTY_EDIT;
      const composition = edit.history.present;
      const key = renderKey(input);
      if (edit.applied && edit.applied.composition === composition && edit.applied.key === key) return;

      aborts.current[panel]?.abort();
      if (composition.layers.length === 0) {
        if (edit.applied) releaseSource(edit.applied.image);
        update(panel, (e) => ({ ...e, applied: null }));
        return;
      }

      const abort = new AbortController();
      aborts.current[panel] = abort;
      setError(null);
      setRendering((r) => ({ ...r, [panel]: { stage: "decode", done: 0, total: 1 } }));
      try {
        const file = await renderComposition({
          ...input,
          composition,
          signal: abort.signal,
          onProgress: (p) => {
            if (!abort.signal.aborted) setRendering((r) => ({ ...r, [panel]: p }));
          },
        });
        if (abort.signal.aborted) return;
        const image = await loadSource(file);
        const old = held.current[panel]?.applied;
        if (old) releaseSource(old.image);
        update(panel, (e) => ({ ...e, applied: { composition, image, key } }));
      } catch (e) {
        if (!abort.signal.aborted) setError({ kind: "slice", cause: e });
      } finally {
        if (aborts.current[panel] === abort) {
          delete aborts.current[panel];
          setRendering((r) => {
            const next = { ...r };
            delete next[panel];
            return next;
          });
        }
      }
    },
    [update],
  );

  useEffect(
    () => () => {
      for (const a of Object.values(aborts.current)) a.abort();
      for (const e of Object.values(held.current)) if (e.applied) releaseSource(e.applied.image);
    },
    [],
  );

  return { edits, get, change, undo, redo, apply, rendering, error };
}
