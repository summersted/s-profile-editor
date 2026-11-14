"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, mapPool } from "@/lib/async";
import { gifConcurrency } from "@/lib/gif/gifsicle";
import { slice } from "@/lib/image/slice";
import { optimizeGif } from "@/lib/optimize/optimize";
import type { OptimizeSettings } from "@/lib/optimize/settings";
import { planKey } from "@/lib/steam/plan";
import type { SliceFile, SlicePlan, SourceImage } from "@/lib/types";

export interface SliceProgress {
  done: number;
  total: number;
}

/**
 * Owns the cut slot files: slicing, per-file optimization and the blob URLs
 * that go with them. Every file's URL is created and revoked here and nowhere else.
 */
export function useSlices() {
  const [files, setFiles] = useState<SliceFile[]>([]);
  /** `planKey` of the plan the current files were cut with. */
  const [slicedKey, setSlicedKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<SliceProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** index → what the optimizer is trying right now. */
  const [optimizing, setOptimizing] = useState<Record<number, string>>({});

  // Source of truth for async code; `files` state mirrors it for rendering.
  const held = useRef<SliceFile[]>([]);
  // Bumped whenever the file set is replaced, so late async results get dropped.
  const generation = useRef(0);
  // Identifies the latest slicing run; an older run that finishes late is ignored.
  const latestRun = useRef(0);

  const replaceAll = useCallback((next: SliceFile[], key: string | null) => {
    generation.current++;
    for (const f of held.current) URL.revokeObjectURL(f.url);
    held.current = next;
    setFiles(next);
    setSlicedKey(key);
    setOptimizing({});
  }, []);

  const patchFile = useCallback((index: number, patch: (f: SliceFile) => SliceFile) => {
    held.current = held.current.map((f) => (f.index === index ? patch(f) : f));
    setFiles(held.current);
  }, []);

  const clear = useCallback(() => {
    latestRun.current++;
    replaceAll([], null);
    setProgress(null);
    setError(null);
  }, [replaceAll]);

  const run = useCallback(
    async (source: SourceImage, plan: SlicePlan) => {
      const id = ++latestRun.current;
      setError(null);
      setProgress({ done: 0, total: plan.slices.length });
      try {
        const cuts = await slice(source, plan, (done, total) => {
          if (id === latestRun.current) setProgress({ done, total });
        });
        if (id !== latestRun.current) return;
        replaceAll(
          cuts.map((cut) => ({
            index: cut.index,
            filename: cut.filename,
            kind: cut.kind,
            width: cut.width,
            height: cut.height,
            original: cut.blob,
            blob: cut.blob,
            url: URL.createObjectURL(cut.blob),
            optimized: null,
          })),
          planKey(plan),
        );
      } catch (e) {
        if (id === latestRun.current) setError(errorMessage(e, "Не вдалося нарізати зображення"));
      } finally {
        if (id === latestRun.current) setProgress(null);
      }
    },
    [replaceAll],
  );

  /** Swap a file's current blob, keeping `original` so it can be redone or reverted. */
  const setBlob = useCallback(
    (index: number, blob: Blob, optimized: SliceFile["optimized"]) => {
      patchFile(index, (f) => {
        if (f.blob === blob) return { ...f, optimized };
        URL.revokeObjectURL(f.url);
        return { ...f, blob, url: URL.createObjectURL(blob), optimized };
      });
    },
    [patchFile],
  );

  const optimize = useCallback(
    async (indexes: number[], settings: OptimizeSettings) => {
      const gen = generation.current;
      const targets = held.current.filter((f) => f.kind === "gif" && indexes.includes(f.index));
      setError(null);
      setOptimizing((prev) => ({
        ...prev,
        ...Object.fromEntries(targets.map((f) => [f.index, "в черзі"])),
      }));

      await mapPool(targets, gifConcurrency(), async (file) => {
        try {
          // Always from the pristine cut: re-optimizing must not stack lossy passes.
          const result = await optimizeGif(file.original, settings, {
            onAttempt: (label) => {
              if (gen === generation.current) {
                setOptimizing((prev) => ({ ...prev, [file.index]: label }));
              }
            },
          });
          if (gen !== generation.current) return;
          setBlob(file.index, result.blob, {
            label: result.label,
            fits: result.fits,
            targetBytes: settings.targetBytes,
          });
        } catch (e) {
          if (gen === generation.current) {
            setError(`${file.filename}: ${errorMessage(e, "не вдалося оптимізувати")}`);
          }
        } finally {
          if (gen === generation.current) {
            setOptimizing((prev) => {
              const next = { ...prev };
              delete next[file.index];
              return next;
            });
          }
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
      generation.current++;
      latestRun.current++;
      for (const f of held.current) URL.revokeObjectURL(f.url);
      held.current = [];
    },
    [],
  );

  return {
    files,
    slicedKey,
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
