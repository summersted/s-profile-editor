"use client";

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { MediaItem } from "@/hooks/useMediaLibrary";
import type { RenderProgress } from "@/lib/compose/render";
import { buildTimeline } from "@/lib/compose/timeline";
import { FONT_FAMILIES, newLayerId, type Composition, type Layer, type TextLayer } from "@/lib/compose/types";
import type { Failure } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import type { Rect } from "@/lib/types";
import { ACCEPT_IMAGES } from "../UploadZone";
import { CheckField, Field, NumberField, SelectField, inputClass, secondaryButtonClass } from "../ui";
import EditorStage, { MEDIA_DRAG_TYPE } from "./EditorStage";

type Change = (fn: (c: Composition) => Composition, mergeKey?: string) => void;

export interface PanelEditorProps {
  strip: { w: number; h: number };
  slots: Rect[];
  baseStyle: CSSProperties;
  /** Frames in the panel base (1 = still), for the "becomes a GIF" note. */
  baseFrameCount: number;
  composition: Composition;
  canUndo: boolean;
  canRedo: boolean;
  onChange: Change;
  onUndo: () => void;
  onRedo: () => void;
  media: MediaItem[];
  usedMediaIds: ReadonlySet<string>;
  mediaError: Failure | null;
  onAddMedia: (files: File[]) => Promise<MediaItem[]>;
  onRemoveMedia: (id: string) => void;
  rendering: RenderProgress | undefined;
}

/**
 * Layer editor for one panel: tools on the left (media library, text, layers,
 * properties), the panel itself on the right with undo/redo above it.
 */
export default function PanelEditor(props: PanelEditorProps) {
  const { strip, composition, onChange, media } = props;
  const { m } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const selected = composition.layers.find((l) => l.id === selectedId) ?? null;

  const addMediaLayer = (item: MediaItem, at: { x: number; y: number }) => {
    const { width, height } = item.image;
    const fit = Math.min(1, (strip.w * 0.6) / width, (strip.h * 0.6) / height);
    const layer: Layer = {
      kind: "media",
      id: newLayerId(),
      mediaId: item.id,
      x: Math.round(at.x),
      y: Math.round(at.y),
      w: Math.round(width * fit),
      h: Math.round(height * fit),
      rotation: 0,
    };
    onChange((c) => ({ layers: [...c.layers, layer] }));
    setSelectedId(layer.id);
  };

  const addText = () => {
    const layer: TextLayer = {
      kind: "text",
      id: newLayerId(),
      text: m.editor.defaultText,
      fontFamily: "Arial",
      fontSize: Math.max(16, Math.min(120, Math.round(strip.h * 0.12))),
      bold: true,
      color: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 3,
      x: Math.round(strip.w / 2),
      y: Math.round(strip.h / 2),
      rotation: 0,
    };
    onChange((c) => ({ layers: [...c.layers, layer] }));
    setSelectedId(layer.id);
    requestAnimationFrame(() => textRef.current?.select());
  };

  const patch = (id: string, p: Partial<Layer>, key?: string) =>
    onChange((c) => ({ layers: c.layers.map((l) => (l.id === id ? ({ ...l, ...p } as Layer) : l)) }), key);
  const remove = (id: string) => {
    onChange((c) => ({ layers: c.layers.filter((l) => l.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };
  const move = (id: string, dir: 1 | -1) =>
    onChange((c) => {
      const i = c.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.layers.length) return c;
      const layers = [...c.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { layers };
    });

  const onKeyDown = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) props.onRedo();
      else props.onUndo();
      return;
    }
    if (mod && !typing && e.key.toLowerCase() === "y") {
      e.preventDefault();
      props.onRedo();
      return;
    }
    if (typing || !selected) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(selected.id);
    }
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) {
      e.preventDefault();
      patch(selected.id, { x: selected.x + d[0], y: selected.y + d[1] }, `nudge-${selected.id}`);
    }
  };

  // Which source drives the output timing — same rule as the renderer.
  const timingNote = useMemo(() => {
    // Only frame counts matter for picking the timing source.
    const frames = (n: number) => new Array<number>(n).fill(0);
    const sources: Array<{ name: string; delaysCs: readonly number[] }> = [
      { name: "", delaysCs: frames(props.baseFrameCount) },
    ];
    for (const l of composition.layers) {
      if (l.kind !== "media") continue;
      const item = mediaById.get(l.mediaId);
      if (item) sources.push({ name: item.image.file.name, delaysCs: frames(item.image.frameCount) });
    }
    const t = buildTimeline(sources);
    if (t.master < 0) return m.editor.still;
    const name = t.master === 0 ? m.dialog.backgroundPiece : sources[t.master].name;
    return m.editor.animated(name, t.delaysCs.length);
  }, [composition.layers, mediaById, props.baseFrameCount, m]);

  return (
    <div className="grid gap-5 outline-none md:grid-cols-[300px_minmax(0,1fr)]" tabIndex={-1} onKeyDown={onKeyDown}>
      <Tools
        {...props}
        selected={selected}
        selectedId={selectedId}
        onSelect={setSelectedId}
        textRef={textRef}
        addText={addText}
        addMediaAtCentre={(item) => addMediaLayer(item, { x: strip.w / 2, y: strip.h / 2 })}
        patch={patch}
        remove={remove}
        move={move}
        mediaById={mediaById}
      />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!props.canUndo}
            onClick={props.onUndo}
            title={m.editor.undoTitle}
            className={`${secondaryButtonClass} px-3 py-1.5 text-sm`}
          >
            ↶ {m.editor.undo}
          </button>
          <button
            type="button"
            disabled={!props.canRedo}
            onClick={props.onRedo}
            title={m.editor.redoTitle}
            className={`${secondaryButtonClass} px-3 py-1.5 text-sm`}
          >
            {m.editor.redo} ↷
          </button>
          <span className="text-xs text-muted">{timingNote}</span>
        </div>
        <EditorStage
          strip={strip}
          slots={props.slots}
          baseStyle={props.baseStyle}
          composition={composition}
          media={mediaById}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={onChange}
          rendering={props.rendering}
          onDrop={async (at, ids, files) => {
            for (const id of ids) {
              const item = mediaById.get(id);
              if (item) addMediaLayer(item, at);
            }
            if (files.length) {
              const added = await props.onAddMedia(files);
              added.forEach((item, i) => addMediaLayer(item, { x: at.x + i * 16, y: at.y + i * 16 }));
            }
          }}
        />
        <p className="text-xs text-muted">{m.editor.hint}</p>
      </div>
    </div>
  );
}

function Tools({
  media,
  usedMediaIds,
  mediaError,
  onAddMedia,
  onRemoveMedia,
  composition,
  selected,
  selectedId,
  onSelect,
  textRef,
  addText,
  addMediaAtCentre,
  patch,
  remove,
  move,
  mediaById,
}: PanelEditorProps & {
  selected: Layer | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  addText: () => void;
  addMediaAtCentre: (item: MediaItem) => void;
  patch: (id: string, p: Partial<Layer>, key?: string) => void;
  remove: (id: string) => void;
  move: (id: string, dir: 1 | -1) => void;
  mediaById: ReadonlyMap<string, MediaItem>;
}) {
  const { m, failure } = useI18n();
  const e = m.editor;
  const uploadRef = useRef<HTMLInputElement>(null);
  const heading = "text-sm font-semibold uppercase tracking-wide text-accent";

  return (
    <div className="flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-1">
      <section className="flex flex-col gap-2">
        <h3 className={heading}>{e.media}</h3>
        <button type="button" onClick={() => uploadRef.current?.click()} className={`${secondaryButtonClass} px-3 py-2 text-sm`}>
          {e.uploadMedia}
        </button>
        <input
          ref={uploadRef}
          type="file"
          multiple
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={(ev) => {
            const files = [...(ev.target.files ?? [])];
            ev.target.value = "";
            if (files.length) onAddMedia(files);
          }}
        />
        {mediaError && <p className="text-xs text-danger">{failure(mediaError)}</p>}
        {media.length === 0 ? (
          <p className="text-xs text-muted">{e.mediaEmpty}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {media.map((item) => {
                const used = usedMediaIds.has(item.id);
                return (
                  <div key={item.id} className="group relative">
                    <button
                      type="button"
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData(MEDIA_DRAG_TYPE, item.id);
                        ev.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addMediaAtCentre(item)}
                      title={item.image.file.name}
                      className="flex aspect-square w-full cursor-grab items-center justify-center overflow-hidden rounded border border-line bg-ink hover:border-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image.previewUrl} alt={item.image.file.name} draggable={false} className="max-h-full max-w-full object-contain" />
                    </button>
                    {item.image.kind === "gif" && (
                      <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-foreground">
                        GIF
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={used}
                      onClick={() => onRemoveMedia(item.id)}
                      title={used ? e.mediaInUse : e.removeMedia}
                      aria-label={e.removeMedia}
                      className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded bg-black/80 text-xs text-foreground group-hover:flex disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted">{e.mediaHint}</p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={heading}>{e.layers}</h3>
        <button type="button" onClick={addText} className={`${secondaryButtonClass} px-3 py-2 text-sm`}>
          + {e.addText}
        </button>
        {composition.layers.length === 0 ? (
          <p className="text-xs text-muted">{e.layersEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...composition.layers].reverse().map((l) => {
              const item = l.kind === "media" ? mediaById.get(l.mediaId) : undefined;
              return (
                <li
                  key={l.id}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-sm ${
                    l.id === selectedId ? "border-accent bg-line/40" : "border-line"
                  }`}
                >
                  <button type="button" onClick={() => onSelect(l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {item ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image.previewUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-line text-xs font-bold">T</span>
                    )}
                    <span className="truncate">{l.kind === "text" ? l.text.split("\n")[0] || e.textLayer : (item?.image.file.name ?? "?")}</span>
                  </button>
                  <button type="button" onClick={() => move(l.id, 1)} title={e.moveUp} aria-label={e.moveUp} className="px-1 text-muted hover:text-foreground">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(l.id, -1)} title={e.moveDown} aria-label={e.moveDown} className="px-1 text-muted hover:text-foreground">
                    ↓
                  </button>
                  <button type="button" onClick={() => remove(l.id)} title={e.deleteLayer} aria-label={e.deleteLayer} className="px-1 text-muted hover:text-danger">
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && (
        <section className="flex flex-col gap-3">
          <h3 className={heading}>{e.properties}</h3>
          {selected.kind === "text" && (
            <>
              <Field label={e.text}>
                <textarea
                  ref={textRef}
                  rows={3}
                  value={selected.text}
                  onChange={(ev) => patch(selected.id, { text: ev.target.value }, `text-${selected.id}`)}
                  className={`${inputClass} resize-y`}
                />
              </Field>
              <SelectField
                label={e.font}
                value={selected.fontFamily}
                options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
                onChange={(fontFamily) => patch(selected.id, { fontFamily })}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label={e.size} min={6} max={400} value={selected.fontSize} onChange={(fontSize) => patch(selected.id, { fontSize }, `size-${selected.id}`)} />
                <Field label={e.color}>
                  <input type="color" value={selected.color} onChange={(ev) => patch(selected.id, { color: ev.target.value }, `color-${selected.id}`)} className="h-[34px] w-full cursor-pointer rounded border border-line bg-background" />
                </Field>
                <Field label={e.outline}>
                  <input type="color" value={selected.strokeColor} onChange={(ev) => patch(selected.id, { strokeColor: ev.target.value }, `stroke-${selected.id}`)} className="h-[34px] w-full cursor-pointer rounded border border-line bg-background" />
                </Field>
                <NumberField label={e.outlineWidth} min={0} max={20} value={selected.strokeWidth} onChange={(strokeWidth) => patch(selected.id, { strokeWidth }, `strokew-${selected.id}`)} />
              </div>
              <CheckField label={e.bold} checked={selected.bold} onChange={(bold) => patch(selected.id, { bold })} />
            </>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <NumberField label={e.rotation} min={-180} max={180} value={selected.rotation} onChange={(rotation) => patch(selected.id, { rotation }, `rot-${selected.id}`)} />
            </div>
            <button type="button" onClick={() => patch(selected.id, { rotation: 0 })} className={`${secondaryButtonClass} px-3 py-1.5 text-sm`}>
              {e.resetRotation}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
