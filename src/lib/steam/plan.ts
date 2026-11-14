import type { Framing, PlannedSlice, Rect, SlicePlan } from "@/lib/types";
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
  source: { width: number; height: number };
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
  source: { width: number; height: number },
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

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampInt(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}
