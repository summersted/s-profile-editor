import type { Framing, PlannedSlice, Rect, Size, SlicePlan } from "../types";
import { type ShowcaseSpec, stripWidth } from "./showcases";

/**
 * Build the slice plan: map the source image onto a strip of
 * `sections` stacked showcase rows and compute per-slot crop rects.
 *
 * The strip is a virtual canvas in showcase px:
 *   width  = slots + gaps (e.g. 506 + 8 + 100 = 614)
 *   height = sections * rowHeight (+ rowGap between rows)
 * The source is mapped onto it in "cover" mode, then zoom/pan shift the window.
 * Gap pixels exist on the strip but no slice covers them — that's what makes
 * the result look continuous on the profile.
 */
export function buildPlan(opts: {
  spec: ShowcaseSpec;
  sections: number;
  rowHeight: number;
  source: Size;
  framing: Framing;
  /** Export scale: 1 = profile px, 2 = HiDPI uploads. */
  scale?: number;
}): SlicePlan {
  const { spec, source, framing } = opts;
  const sections = clampInt(opts.sections, 1, spec.maxSections);
  const rowHeight = Math.max(1, Math.round(opts.rowHeight));
  const scale = opts.scale ?? 1;

  const stripW = stripWidth(spec);
  const stripH = sections * rowHeight + spec.rowGap * (sections - 1);

  const sourceWindow = coverWindow(source, stripW / stripH, framing);
  // Source px per strip px.
  const k = sourceWindow.w / stripW;

  const slices: PlannedSlice[] = [];
  let index = 0;
  for (let row = 0; row < sections; row++) {
    const y = row * (rowHeight + spec.rowGap);
    let x = 0;
    for (const slot of spec.slots) {
      const strip: Rect = { x, y, w: slot.width, h: rowHeight };
      slices.push({
        index,
        strip,
        source: {
          x: sourceWindow.x + strip.x * k,
          y: sourceWindow.y + strip.y * k,
          w: strip.w * k,
          h: strip.h * k,
        },
        output: {
          w: Math.round(slot.width * scale),
          h: Math.round(rowHeight * scale),
        },
      });
      index++;
      x += slot.width + spec.slotGap;
    }
  }

  return {
    showcaseId: spec.id,
    sections,
    strip: { w: stripW, h: stripH },
    sourceWindow,
    slices,
  };
}

/**
 * Largest window with the given aspect that fits the source ("cover"),
 * shrunk by zoom and positioned by pan.
 */
function coverWindow(
  source: Size,
  aspect: number,
  framing: Framing,
): Rect {
  const zoom = Math.max(1, framing.zoom);
  let w: number;
  let h: number;
  if (source.width / source.height > aspect) {
    h = source.height;
    w = h * aspect;
  } else {
    w = source.width;
    h = w / aspect;
  }
  w /= zoom;
  h /= zoom;
  const x = (source.width - w) * clamp01(framing.panX);
  const y = (source.height - h) * clamp01(framing.panY);
  return { x, y, w, h };
}

/**
 * Snap a fractional crop rect to whole source pixels, clamped to the image.
 * Edges (not sizes) are rounded, so two rects that touch in the plan still
 * touch after snapping — no 1px overlap or hole between neighbouring slices.
 */
export function pixelRect(r: Rect, bounds: Size): Rect {
  const x0 = clamp(Math.round(r.x), 0, bounds.width - 1);
  const y0 = clamp(Math.round(r.y), 0, bounds.height - 1);
  const x1 = clamp(Math.round(r.x + r.w), x0 + 1, bounds.width);
  const y1 = clamp(Math.round(r.y + r.h), y0 + 1, bounds.height);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * How much the most-stretched slice is enlarged relative to its source crop.
 * >1 means the export is upscaled and will look soft.
 */
export function planUpscale(plan: SlicePlan): number {
  return Math.max(...plan.slices.map((s) => s.output.w / s.source.w));
}

/** Stable identity of a plan: equal keys produce byte-identical cuts. */
export function planKey(plan: SlicePlan): string {
  return JSON.stringify(plan.slices.map((s) => [s.source, s.output]));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

function clampInt(v: number, min: number, max: number): number {
  return clamp(Math.round(v), min, max);
}
