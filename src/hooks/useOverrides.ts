"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Failure } from "@/lib/errors";
import { loadSource, releaseSource } from "@/lib/image/decode";
import type { SourceImage } from "@/lib/types";

/** `panelKey` → user's own file covering that panel. */
export type Overrides = Readonly<Record<string, SourceImage>>;

/**
 * User's own files put onto whole panels instead of the background.
 * Owns their preview blob URLs.
 */
export function useOverrides() {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [error, setError] = useState<Failure | null>(null);
  const held = useRef<Overrides>({});
  /** Per panel: id of the latest upload, so a slow decode can't overwrite a newer file. */
  const latest = useRef<Record<string, number>>({});
  const counter = useRef(0);

  const commit = useCallback((next: Overrides) => {
    held.current = next;
    setOverrides(next);
  }, []);

  /** Resolves to the loaded image if it became the slot's file. */
  const set = useCallback(
    async (index: string, file: File): Promise<SourceImage | null> => {
      const id = ++counter.current;
      latest.current[index] = id;
      try {
        const image = await loadSource(file);
        if (latest.current[index] !== id) {
          releaseSource(image);
          return null;
        }
        const prev = held.current[index];
        if (prev) releaseSource(prev);
        commit({ ...held.current, [index]: image });
        setError(null);
        return image;
      } catch (e) {
        if (latest.current[index] === id) setError({ kind: "read", cause: e, filename: file.name });
        return null;
      }
    },
    [commit],
  );

  /** Put the background back into the panel. */
  const reset = useCallback(
    (index: string) => {
      latest.current[index] = ++counter.current;
      const prev = held.current[index];
      if (!prev) return;
      releaseSource(prev);
      const next = { ...held.current };
      delete next[index];
      commit(next);
      setError(null);
    },
    [commit],
  );

  useEffect(
    () => () => {
      for (const image of Object.values(held.current)) releaseSource(image);
      held.current = {};
    },
    [],
  );

  return { overrides, error, set, reset };
}
