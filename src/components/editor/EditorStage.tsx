"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { MediaItem } from "@/hooks/useMediaLibrary";
import type { RenderProgress } from "@/lib/compose/render";
import { TEXT_LINE_HEIGHT, type Composition, type Layer } from "@/lib/compose/types";
import { useI18n } from "@/lib/i18n";
import type { Rect } from "@/lib/types";

/** MIME type used when dragging an item out of the media library. */
export const MEDIA_DRAG_TYPE = "application/x-sprofile-media";

type Change = (fn: (c: Composition) => Composition, mergeKey?: string) => void;

interface EditorStageProps {
  strip: { w: number; h: number };
  /** Slot rects in strip coordinates; whatever lies between them is cut away. */
  slots: Rect[];
  /** CSS drawing the panel base (background piece or own file) in strip coordinates. */
  baseStyle: CSSProperties;
  composition: Composition;
  media: ReadonlyMap<string, MediaItem>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: Change;
  /** Something was dropped at strip point (x, y): library items and/or files. */
  onDrop: (at: { x: number; y: number }, mediaIds: string[], files: File[]) => void;
  rendering: RenderProgress | undefined;
}

type Gesture =
  | { kind: "move"; id: string; key: string; start: Pt; orig: Layer }
  | { kind: "resize"; id: string; key: string; startDist: number; orig: Layer }
  | { kind: "rotate"; id: string; key: string; startAngle: number; orig: Layer };

interface Pt {
  x: number;
  y: number;
}

const MIN_SIZE = 8;
let gestureCounter = 0;

/**
 * The editable panel: base picture, layers on top, selection frame with
 * resize/rotate handles. Everything is laid out in strip px × `scale`.
 */
export default function EditorStage({
  strip,
  slots,
  baseStyle,
  composition,
  media,
  selectedId,
  onSelect,
  onChange,
  onDrop,
  rendering,
}: EditorStageProps) {
  const { m } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([e]) => setHostWidth(e.contentRect.width));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const maxH = typeof window === "undefined" ? 700 : window.innerHeight * 0.62;
  const scale = hostWidth > 0 ? Math.min(1.25, hostWidth / strip.w, maxH / strip.h) : 0;

  /** Pointer position in strip px. */
  const toStrip = (clientX: number, clientY: number): Pt => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };

  const replaceLayer = (id: string, next: Layer, key: string) =>
    onChange((c) => ({ layers: c.layers.map((l) => (l.id === id ? next : l)) }), key);

  const begin = (e: ReactPointerEvent, layer: Layer, kind: Gesture["kind"]) => {
    e.stopPropagation();
    e.preventDefault();
    // preventDefault blocks focus; take it explicitly so Delete / arrows work right away.
    stageRef.current?.focus();
    onSelect(layer.id);
    stageRef.current?.setPointerCapture(e.pointerId);
    const p = toStrip(e.clientX, e.clientY);
    const key = `${kind}-${layer.id}-${++gestureCounter}`;
    if (kind === "move") gesture.current = { kind, id: layer.id, key, start: p, orig: layer };
    else if (kind === "resize")
      gesture.current = { kind, id: layer.id, key, startDist: Math.max(1, Math.hypot(p.x - layer.x, p.y - layer.y)), orig: layer };
    else gesture.current = { kind, id: layer.id, key, startAngle: angle(layer, p), orig: layer };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = toStrip(e.clientX, e.clientY);
    const o = g.orig;
    if (g.kind === "move") {
      replaceLayer(g.id, { ...o, x: round1(o.x + p.x - g.start.x), y: round1(o.y + p.y - g.start.y) }, g.key);
    } else if (g.kind === "resize") {
      const k = Math.hypot(p.x - o.x, p.y - o.y) / g.startDist;
      if (o.kind === "media") {
        const s = Math.max(k, MIN_SIZE / Math.min(o.w, o.h));
        replaceLayer(g.id, { ...o, w: round1(o.w * s), h: round1(o.h * s) }, g.key);
      } else {
        replaceLayer(g.id, { ...o, fontSize: Math.min(400, Math.max(6, Math.round(o.fontSize * k))) }, g.key);
      }
    } else {
      let r = o.rotation + angle(o, p) - g.startAngle;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      replaceLayer(g.id, { ...o, rotation: round1(normalizeDeg(r)) }, g.key);
    }
  };

  const end = () => {
    gesture.current = null;
  };

  const progressText = rendering
    ? rendering.stage === "decode"
      ? m.editor.renderDecode
      : rendering.stage === "draw"
        ? m.editor.renderDraw(Math.min(rendering.done + 1, rendering.total), rendering.total)
        : m.editor.renderOptimize
    : null;
  const percent = rendering && rendering.total > 0 ? Math.round((rendering.done / rendering.total) * 100) : 0;

  return (
    <div ref={hostRef} className="w-full">
      {scale > 0 && (
        <div
          ref={stageRef}
          tabIndex={0}
          className={`relative mx-auto touch-none select-none overflow-hidden bg-black outline outline-1 outline-black focus-visible:outline-accent ${
            dropping ? "ring-2 ring-accent" : ""
          }`}
          style={{ width: strip.w * scale, height: strip.h * scale }}
          onPointerDown={() => onSelect(null)}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(MEDIA_DRAG_TYPE) || e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDropping(true);
            }
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropping(false);
            const at = toStrip(e.clientX, e.clientY);
            const id = e.dataTransfer.getData(MEDIA_DRAG_TYPE);
            onDrop(at, id ? [id] : [], [...e.dataTransfer.files]);
          }}
        >
          {/* Base, scaled like everything else. */}
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{ width: strip.w, height: strip.h, transform: `scale(${scale})`, ...baseStyle }}
          />

          {composition.layers.map((layer) => (
            <LayerView
              key={layer.id}
              layer={layer}
              scale={scale}
              src={layer.kind === "media" ? media.get(layer.mediaId)?.image.previewUrl : undefined}
              selected={layer.id === selectedId}
              onBegin={(e, kind) => begin(e, layer, kind)}
            />
          ))}

          <GapOverlay strip={strip} slots={slots} scale={scale} hint={m.editor.gapHint} />

          {rendering && (
            <div
              role="status"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center"
            >
              <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
              <p className="text-sm font-semibold text-accent">{percent}%</p>
              <div className="h-2 w-full max-w-60 overflow-hidden rounded bg-line">
                <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-sm text-foreground">{progressText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LayerView({
  layer,
  scale,
  src,
  selected,
  onBegin,
}: {
  layer: Layer;
  scale: number;
  src: string | undefined;
  selected: boolean;
  onBegin: (e: ReactPointerEvent, kind: Gesture["kind"]) => void;
}) {
  const wrapper: CSSProperties = {
    left: layer.x * scale,
    top: layer.y * scale,
    transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
  };
  return (
    <div
      className={`absolute cursor-move ${selected ? "z-10 outline outline-1 outline-accent" : "hover:outline hover:outline-1 hover:outline-white/40"}`}
      style={wrapper}
      onPointerDown={(e) => onBegin(e, "move")}
    >
      {layer.kind === "media" ? (
        src ? (
          // Blob URL; GIFs animate natively in the editor.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="block max-w-none" style={{ width: layer.w * scale, height: layer.h * scale }} />
        ) : (
          <div className="border border-dashed border-warn" style={{ width: layer.w * scale, height: layer.h * scale }} />
        )
      ) : (
        <div
          className="whitespace-pre text-center"
          style={{
            fontFamily: `"${layer.fontFamily}", sans-serif`,
            fontSize: layer.fontSize * scale,
            fontWeight: layer.bold ? 700 : 400,
            lineHeight: TEXT_LINE_HEIGHT,
            color: layer.color,
            WebkitTextStroke: layer.strokeWidth > 0 ? `${layer.strokeWidth * 2 * scale}px ${layer.strokeColor}` : undefined,
            paintOrder: "stroke fill",
          }}
        >
          {layer.text || " "}
        </div>
      )}

      {selected && (
        <>
          {(["-left-1.5 -top-1.5 cursor-nwse-resize", "-right-1.5 -top-1.5 cursor-nesw-resize", "-left-1.5 -bottom-1.5 cursor-nesw-resize", "-right-1.5 -bottom-1.5 cursor-nwse-resize"] as const).map((pos) => (
            <span
              key={pos}
              className={`absolute h-3 w-3 rounded-sm border border-ink bg-accent ${pos}`}
              onPointerDown={(e) => onBegin(e, "resize")}
            />
          ))}
          <span className="pointer-events-none absolute -top-6 left-1/2 h-6 w-px bg-accent" />
          <span
            className="absolute -top-8 left-1/2 h-3.5 w-3.5 -translate-x-1/2 cursor-grab rounded-full border border-ink bg-accent"
            onPointerDown={(e) => onBegin(e, "rotate")}
          />
        </>
      )}
    </div>
  );
}

/** Hatch the parts of the strip that no slot covers (the gaps Steam doesn't show). */
function GapOverlay({ strip, slots, scale, hint }: { strip: { w: number; h: number }; slots: Rect[]; scale: number; hint: string }) {
  const xs = [...slots].sort((a, b) => a.x - b.x);
  const gaps: Array<[number, number]> = [];
  let x = 0;
  for (const s of xs) {
    if (s.x > x) gaps.push([x, s.x]);
    x = Math.max(x, s.x + s.w);
  }
  if (x < strip.w) gaps.push([x, strip.w]);
  return (
    <>
      {gaps.map(([a, b]) => (
        <div
          key={a}
          title={hint}
          className="pointer-events-none absolute top-0 z-10 h-full [background:repeating-linear-gradient(45deg,rgba(255,80,80,0.55)_0_3px,rgba(0,0,0,0.55)_3px_6px)]"
          style={{ left: a * scale, width: (b - a) * scale }}
        />
      ))}
    </>
  );
}

function angle(c: Pt, p: Pt): number {
  return (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
}

function normalizeDeg(d: number): number {
  let r = ((d + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return r;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
