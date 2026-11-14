import type { PanelBox, PlannedSlice, Rect, Size, SlicePlan } from "../types";
import { PROFILE, SHOWCASE_BOX, type ProfileLayout } from "./profile";
import { MAX_PANELS, ROW_HEIGHT, SHOWCASES, stripWidth, type ShowcaseId, type ShowcaseSpec } from "./showcases";

/**
 * Lay `sections` showcases out on the profile page and work out, for every
 * slot, which piece of the background sits right under it.
 *
 * Cutting exactly that piece is the whole trick: the uploaded artwork then
 * continues the background seamlessly, so the showcases look like windows
 * into it. All rects are in page px (see lib/steam/profile.ts for the origin).
 */
export function buildPlan(opts: {
  /** Showcase type of every panel without its own type. */
  spec: ShowcaseSpec;
  /** Panel index → its own showcase type (e.g. one panel split into 506 + 100). */
  panelTypes?: Readonly<Record<number, ShowcaseId>>;
  layout: ProfileLayout;
  sections: number;
  /** Artwork height of every panel without its own height. */
  rowHeight: number;
  /** Panel index → its own artwork height (e.g. stretched to a custom file). */
  panelHeights?: Readonly<Record<number, number>>;
  /** Intrinsic size of the background image. */
  source: Size;
}): SlicePlan {
  const { spec, layout, source, panelHeights = {}, panelTypes = {} } = opts;
  const sections = clampInt(opts.sections, 1, MAX_PANELS);
  const clampHeight = (h: number) => clampInt(h, ROW_HEIGHT.min, ROW_HEIGHT.max);
  const rowHeight = clampHeight(opts.rowHeight);

  // The background is shown 1920px wide whatever its real size: k = source px per page px.
  const k = source.width / PROFILE.bgWidth;
  const bg: Rect = {
    x: (PROFILE.contentWidth - PROFILE.bgWidth) / 2,
    y: 0,
    w: PROFILE.bgWidth,
    h: source.height / k,
  };
  // A 4K background has detail to spare: export at 2x so HiDPI screens get it.
  const density = k >= 2 ? 2 : 1;

  // Images start after the block padding and their own 1px border.
  const inset = SHOWCASE_BOX.padTop + SHOWCASE_BOX.border;
  const slotsX = layout.leftColX + SHOWCASE_BOX.padX + SHOWCASE_BOX.border;

  const panels: PanelBox[] = [];
  const slices: PlannedSlice[] = [];
  let top = layout.headerHeight;
  for (let i = 0; i < sections; i++) {
    const own = panelHeights[i];
    const height = own === undefined ? rowHeight : clampHeight(own);
    const panelSpec = panelTypes[i] ? SHOWCASES[panelTypes[i]] : spec;
    /** Block height below the images: bottom border, title line, padding. */
    const below = SHOWCASE_BOX.border + panelSpec.captionHeight + SHOWCASE_BOX.padBottom;
    const imagesY = top + layout.panelHeader + inset;
    panels.push({
      index: i,
      strip: { x: slotsX, y: imagesY, w: stripWidth(panelSpec), h: height },
      showcaseId: panelSpec.id,
      customType: panelSpec.id !== spec.id,
      height,
      customHeight: own !== undefined,
      box: {
        x: layout.leftColX,
        y: top,
        w: PROFILE.leftColWidth,
        h: layout.panelHeader + inset + height + below,
      },
    });

    let x = slotsX;
    for (const [slotIndex, slot] of panelSpec.slots.entries()) {
      const page: Rect = { x, y: imagesY, w: slot.width, h: height };
      slices.push({
        index: slices.length,
        panel: i,
        slot: slotIndex,
        page,
        source: {
          x: (page.x - bg.x) * k,
          y: (page.y - bg.y) * k,
          w: page.w * k,
          h: page.h * k,
        },
        output: { w: slot.width * density, h: height * density },
        coverage: coverage(page, bg),
      });
      x += slot.width + panelSpec.slotGap;
    }
    top += layout.panelHeader + inset + height + below + layout.panelGap;
  }

  return {
    showcaseId: spec.id,
    sections,
    page: { w: PROFILE.contentWidth, h: Math.max(bg.h, top + 32) },
    bg,
    density,
    panels,
    slices,
  };
}

/**
 * Snap a fractional crop rect to whole source pixels.
 *
 * `crop` keeps the planned size even where it runs past the right/bottom edge
 * of the image (gifsicle pads that with transparency, which keeps the
 * geometry right). `visible` is the part that actually exists in the image.
 * Edges, not sizes, are rounded, so neighbouring crops never overlap or gap.
 */
export function cropBox(r: Rect, bounds: Size): { crop: Rect; visible: Rect } {
  const x0 = clamp(Math.round(r.x), 0, bounds.width - 1);
  const y0 = clamp(Math.round(r.y), 0, bounds.height - 1);
  const x1 = Math.max(x0 + 1, Math.round(r.x + r.w));
  const y1 = Math.max(y0 + 1, Math.round(r.y + r.h));
  return {
    crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    visible: { x: x0, y: y0, w: Math.min(x1, bounds.width) - x0, h: Math.min(y1, bounds.height) - y0 },
  };
}

/**
 * Address of a slot that survives layout changes: panel number + position in
 * the panel. Flat slot indexes shift when the showcase type changes; this doesn't.
 */
export function slotId(s: { panel: number; slot: number }): string {
  return `${s.panel}:${s.slot}`;
}

/** How many panels of each showcase type the plan uses, to check against Steam's per-type limit. */
export function showcaseUsage(plan: SlicePlan): Record<ShowcaseId, number> {
  const usage = Object.fromEntries(Object.keys(SHOWCASES).map((id) => [id, 0])) as Record<ShowcaseId, number>;
  for (const p of plan.panels) usage[p.showcaseId]++;
  return usage;
}

/** Region of the background image (image px) under a panel strip. May run past the image edges. */
export function stripBackgroundRect(plan: SlicePlan, strip: Rect, background: Size): Rect {
  const k = background.width / plan.bg.w;
  return { x: (strip.x - plan.bg.x) * k, y: (strip.y - plan.bg.y) * k, w: strip.w * k, h: strip.h * k };
}

/** Key of a panel in the own-files map. Own files belong to a whole panel, not a slot. */
export function panelKey(panel: number): string {
  return String(panel);
}

/** Height a panel needs to show an image of `image` size across `stripWidth` without cropping it. */
export function fittedHeight(image: Size, stripWidth: number): number {
  return clampInt((stripWidth * image.height) / image.width, ROW_HEIGHT.min, ROW_HEIGHT.max);
}

/**
 * Where a panel's own file is drawn, page px: scaled to cover the panel's
 * strip, centred. Slots are windows onto it — for a 506 + 100 panel the file
 * is split in two exactly like the background, the 9px gap skipped.
 */
export function ownFileRect(image: Size, strip: Rect): Rect {
  const scale = Math.max(strip.w / image.width, strip.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  return { x: strip.x + (strip.w - w) / 2, y: strip.y + (strip.h - h) / 2, w, h };
}

/** Region of the own file (image px) that lands in the slot at `page`. */
export function ownFileCrop(image: Size, strip: Rect, page: Rect): Rect {
  const drawn = ownFileRect(image, strip);
  const k = image.width / drawn.w;
  return { x: (page.x - drawn.x) * k, y: (page.y - drawn.y) * k, w: page.w * k, h: page.h * k };
}

/** Stable identity of a plan's cuts: equal keys produce byte-identical files. */
export function planKey(plan: SlicePlan): string {
  return JSON.stringify(plan.slices.map((s) => [s.source, s.output]));
}

/** Share of `r`'s area that lies inside `bounds`, 0..1. */
function coverage(r: Rect, bounds: Rect): number {
  const w = Math.min(r.x + r.w, bounds.x + bounds.w) - Math.max(r.x, bounds.x);
  const h = Math.min(r.y + r.h, bounds.y + bounds.h) - Math.max(r.y, bounds.y);
  return w > 0 && h > 0 ? (w * h) / (r.w * r.h) : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clampInt(v: number, min: number, max: number): number {
  return clamp(Math.round(v), min, max);
}
