"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { newLayerId } from "@/lib/compose/types";
import type { Failure } from "@/lib/errors";
import { loadSource, releaseSource } from "@/lib/image/decode";
import type { SourceImage } from "@/lib/types";

export interface MediaItem {
  id: string;
  image: SourceImage;
}

/** Images and GIFs uploaded for the panel editor. Owns their preview URLs. */
export function useMediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<Failure | null>(null);
  const held = useRef<MediaItem[]>([]);

  const commit = useCallback((next: MediaItem[]) => {
    held.current = next;
    setItems(next);
  }, []);

  /** Load files into the library; resolves to the items that loaded. */
  const add = useCallback(
    async (files: readonly File[]): Promise<MediaItem[]> => {
      const added: MediaItem[] = [];
      for (const file of files) {
        try {
          added.push({ id: newLayerId(), image: await loadSource(file) });
        } catch (e) {
          setError({ kind: "read", cause: e, filename: file.name });
        }
      }
      if (added.length) {
        commit([...held.current, ...added]);
        if (added.length === files.length) setError(null);
      }
      return added;
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      const item = held.current.find((m) => m.id === id);
      if (!item) return;
      releaseSource(item.image);
      commit(held.current.filter((m) => m.id !== id));
    },
    [commit],
  );

  useEffect(
    () => () => {
      for (const m of held.current) releaseSource(m.image);
      held.current = [];
    },
    [],
  );

  return { items, error, add, remove };
}
