/**
 * Steam showcase layout constants.
 * Sources and caveats: docs/steam-specs.md. The artwork-showcase gap is the
 * number most likely to drift after Steam UI updates — keep it in one place.
 */

export interface SlotSpec {
  /** Display width of the slot on the profile page, in CSS px. */
  width: number;
}

export type ShowcaseId = "featured" | "artwork";

export interface ShowcaseSpec {
  id: ShowcaseId;
  /** Slots laid out left-to-right within one showcase. */
  slots: SlotSpec[];
  /** Horizontal gap between slot images, px (borders included). */
  slotGap: number;
  /** Space under the images for the artwork title line, px. */
  captionHeight: number;
  /**
   * How many showcases of this type one profile can show: 1 by default plus
   * 1 "Extra showcase" bought in the Points Shop (6 000 points). Source: the
   * item's own description in the Points Shop, checked 2026-11-14.
   */
  maxPerProfile: number;
}

/** Steam upload hard cap per file, bytes (same for every showcase type). */
export const FILE_LIMIT_BYTES = 5 * 1024 * 1024;

/** Bounds for the user-chosen panel (artwork) height, in profile px. */
export const ROW_HEIGHT = { min: 50, max: 2000, default: 300 } as const;

export const SHOWCASES: Record<ShowcaseId, ShowcaseSpec> = {
  featured: {
    id: "featured",
    slots: [{ width: 630 }],
    slotGap: 0,
    // UNCONFIRMED: not on the measured profile. 630 = column 652 − 2×10 padding − 2×1 border.
    captionHeight: 0,
    maxPerProfile: 2,
  },
  artwork: {
    id: "artwork",
    slots: [{ width: 506 }, { width: 100 }],
    // Measured: 1px border + 7px margin + 1px border between the two images.
    slotGap: 9,
    // Measured: 4px margin + 19px title line under the main image.
    captionHeight: 23,
    maxPerProfile: 2,
  },
};

export const SHOWCASE_LIST: ShowcaseSpec[] = Object.values(SHOWCASES);

/** Most artwork panels a profile can have: every type at its own limit (2 + 2). */
export const MAX_PANELS = SHOWCASE_LIST.reduce((sum, s) => sum + s.maxPerProfile, 0);

/** Price of the second showcase of a type in the Points Shop, points. */
export const EXTRA_SHOWCASE_POINTS = 6000;

/** Total width of one showcase's slot images plus the gaps between them. */
export function stripWidth(spec: ShowcaseSpec): number {
  const slots = spec.slots.reduce((sum, s) => sum + s.width, 0);
  return slots + spec.slotGap * (spec.slots.length - 1);
}
