"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/async";
import { loadSource, releaseSource } from "@/lib/image/decode";
import type { SourceImage } from "@/lib/types";

/**
 * Owns the currently loaded source image and its preview blob URL.
 * If the user drops a second file while the first is still decoding,
 * only the latest one wins.
 */
export function useSource() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const latestLoad = useRef(0);
  const held = useRef<SourceImage | null>(null);

  /** Resolves to true if this file became the current source. */
  const load = useCallback(async (file: File): Promise<boolean> => {
    const id = ++latestLoad.current;
    setLoading(true);
    try {
      const next = await loadSource(file);
      if (id !== latestLoad.current) {
        releaseSource(next);
        return false;
      }
      if (held.current) releaseSource(held.current);
      held.current = next;
      setSource(next);
      setError(null);
      return true;
    } catch (e) {
      if (id === latestLoad.current) setError(errorMessage(e, "Не вдалося прочитати файл"));
      return false;
    } finally {
      if (id === latestLoad.current) setLoading(false);
    }
  }, []);

  useEffect(
    () => () => {
      latestLoad.current++;
      if (held.current) releaseSource(held.current);
      held.current = null;
    },
    [],
  );

  return { source, error, loading, load };
}
