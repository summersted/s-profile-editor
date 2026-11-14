"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mapPool } from "@/lib/async";
import type { Failure } from "@/lib/errors";
import { sliceFileName } from "@/lib/download";
import { gifConcurrency } from "@/lib/gif/gifsicle";
import { slice, type SliceCut } from "@/lib/image/slice";
import { optimizeImage } from "@/lib/optimize/image";
import { optimizeGif } from "@/lib/optimize/optimize";
import type { OptimizeProgress, OptimizeSettings } from "@/lib/optimize/settings";
import { ownFileCrop, panelKey } from "@/lib/steam/plan";
import type { PlannedSlice, SliceFile, SlicePlan, SourceImage } from "@/lib/types";
import type { Overrides } from "./useOverrides";

export interface SliceProgress {
  done: number;
  total: number;
}

interface ActiveRun {
  id: number;
  key: string;
  abort: AbortController;
}

/** What a slot's file is made of. Equal keys = byte-identical file. */
function slotKey(plan: SlicePlan, source: SourceImage, s: PlannedSlice, overrides: Overrides): string | null {
  const size = `${s.output.w}x${s.output.h}`;
  const own = overrides[panelKey(s.panel)];
  if (own) {
    const r = ownFileCrop(own, plan.panels[s.panel].strip, s.page);
    return `own|${own.previewUrl}|${r.x},${r.y},${r.w},${r.h}|${size}`;
  }
  if (s.coverage === 0) return null;
  const r = s.source;
  return `bg|${source.previewUrl}|${r.x},${r.y},${r.w},${r.h}|${size}`;
}

function toFile(cut: SliceCut, cutKey: string): SliceFile {
  return {
    index: cut.index,
    filename: sliceFileName(cut.index, cut.blob.type),
    kind: cut.kind,
    cutKey,
    custom: cut.custom,
    width: cut.width,
    height: cut.height,
    original: cut.blob,
    blob: cut.blob,
    url: URL.createObjectURL(cut.blob),
    optimized: null,
  };
}

/**
 * Owns the cut slot files: slicing, per-file optimization and the blob URLs
 * that go with them. Every file's URL is created and revoked here and nowhere else.
 *
 * `run` is safe to call on every settings change: only slots whose content
 * actually changed are re-cut (the rest keep their file and any optimization),
 * and a newer run aborts the one in flight.
 */
export function useSlices() {
  const [files, setFiles] = useState<SliceFile[]>([]);
  const [progress, setProgress] = useState<SliceProgress | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  /** index → optimizer progress for that file ("queued" = waiting for a worker). */
  const [optimizing, setOptimizing] = useState<Record<number, OptimizeProgress | "queued">>({});

  // Source of truth for async code; `files` state mirrors it for rendering.
  const held = useRef<SliceFile[]>([]);
  /** Run key the current `held` set corresponds to. */
  const heldKey = useRef<string | null>(null);
  const active = useRef<ActiveRun | null>(null);
  const runCounter = useRef(0);

  /** Install a new file set; revokes URLs of files that didn't make it into it. */
  const replaceAll = useCallback((next: SliceFile[], key: string | null) => {
    const kept = new Set(next);
    for (const f of held.current) if (!kept.has(f)) URL.revokeObjectURL(f.url);
    held.current = next;
    heldKey.current = key;
    setFiles(next);
    // Optimizations of files that were kept keep running; the rest are orphaned.
    setOptimizing((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([i]) => next.some((f) => f.index === +i))),
    );
  }, []);

  const cancelRun = useCallback(() => {
    active.current?.abort.abort();
    active.current = null;
    setProgress(null);
  }, []);

  const clear = useCallback(() => {
    cancelRun();
    replaceAll([], null);
    setError(null);
  }, [cancelRun, replaceAll]);

  const run = useCallback(
    async (source: SourceImage, plan: SlicePlan, overrides: Overrides = {}) => {
      const keys = new Map<number, string>();
      for (const s of plan.slices) {
        const k = slotKey(plan, source, s, overrides);
        if (k) keys.set(s.index, k);
      }
      const key = [...keys].map(([i, k]) => `${i}=${k}`).join(";");
      if (active.current?.key === key) return;
      if (heldKey.current === key) {
        // Settings went back to what we already have: drop whatever is in flight.
        cancelRun();
        return;
      }

      active.current?.abort.abort();
      const me: ActiveRun = { id: ++runCounter.current, key, abort: new AbortController() };
      active.current = me;
      const isCurrent = () => active.current?.id === me.id;

      // Slots whose content didn't change keep their file, optimization included.
      const reused = held.current.filter((f) => keys.get(f.index) === f.cutKey);
      const skip = new Set(reused.map((f) => f.index));

      setError(null);
      setProgress({ done: 0, total: keys.size - skip.size });
      try {
        const cuts = await slice(source, plan, {
          signal: me.abort.signal,
          overrides,
          skip,
          onProgress: (done, total) => {
            if (isCurrent()) setProgress({ done, total });
          },
        });
        if (!isCurrent()) return;
        // Files reused at the start may have been optimized since: take their latest state.
        const latest = new Map(held.current.map((f) => [f.index, f]));
        const next = [
          ...reused.map((f) => {
            const now = latest.get(f.index);
            return now && now.cutKey === f.cutKey ? now : f;
          }),
          ...cuts.map((cut) => toFile(cut, keys.get(cut.index) ?? "")),
        ].sort((a, b) => a.index - b.index);
        replaceAll(next, key);
      } catch (e) {
        if (isCurrent()) setError({ kind: "slice", cause: e });
      } finally {
        if (isCurrent()) {
          active.current = null;
          setProgress(null);
        }
      }
    },
    [cancelRun, replaceAll],
  );

  /** Swap a file's current blob, keeping `original` so it can be redone or reverted. */
  const setBlob = useCallback(
    (index: number, blob: Blob, optimized: SliceFile["optimized"]) => {
      held.current = held.current.map((f) => {
        if (f.index !== index) return f;
        if (f.blob === blob) return { ...f, optimized };
        URL.revokeObjectURL(f.url);
        return {
          ...f,
          blob,
          url: URL.createObjectURL(blob),
          filename: sliceFileName(f.index, blob.type),
          optimized,
        };
      });
      setFiles(held.current);
    },
    [],
  );

  const optimize = useCallback(
    async (indexes: number[], settings: OptimizeSettings) => {
      const targets = held.current.filter((f) => indexes.includes(f.index));
      setError(null);
      setOptimizing((prev) => ({
        ...prev,
        ...Object.fromEntries(targets.map((f) => [f.index, "queued" as const])),
      }));

      await mapPool(targets, gifConcurrency(), async (file) => {
        // The slot may be re-cut or cleared while we work; then the result is stale.
        const stillThere = () =>
          held.current.some((f) => f.index === file.index && f.cutKey === file.cutKey);
        const onProgress = (progress: OptimizeProgress) => {
          if (stillThere()) setOptimizing((prev) => ({ ...prev, [file.index]: progress }));
        };
        try {
          // Always from the pristine cut: re-optimizing must not stack lossy passes.
          const result =
            file.kind === "gif"
              ? await optimizeGif(file.original, settings, { onProgress })
              : await optimizeImage(file.original, settings, { onProgress });
          if (!stillThere()) return;
          setBlob(file.index, result.blob, {
            label: result.label,
            fits: result.fits,
            targetBytes: settings.targetBytes,
          });
        } catch (e) {
          if (stillThere()) {
            setError({ kind: "optimize", cause: e, filename: file.filename });
          }
        } finally {
          setOptimizing((prev) => {
            const next = { ...prev };
            delete next[file.index];
            return next;
          });
        }
      });
    },
    [setBlob],
  );

  /** Throw away the optimized version and go back to the file as cut. */
  const revert = useCallback(
    (index: number) => {
      const file = held.current.find((f) => f.index === index);
      if (file) setBlob(index, file.original, null);
    },
    [setBlob],
  );

  useEffect(
    () => () => {
      active.current?.abort.abort();
      active.current = null;
      for (const f of held.current) URL.revokeObjectURL(f.url);
      held.current = [];
    },
    [],
  );

  return {
    files,
    slicing: progress !== null,
    progress,
    error,
    optimizing,
    run,
    optimize,
    revert,
    clear,
  };
}
