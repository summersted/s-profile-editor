/**
 * Steam showcase layout constants.
 * Sources and caveats: docs/steam-specs.md. The artwork-showcase gap is the
 * number most likely to drift after Steam UI updates — keep it in one place.
 */

export interface SlotSpec {
  /** Display width of the slot on the profile page, in CSS px. */
  width: number;
}

export interface ShowcaseSpec {
  id: "featured" | "artwork";
  name: string;
  /** Slots laid out left-to-right within one section row. */
  slots: SlotSpec[];
  /** Horizontal gap between slots, px. */
  slotGap: number;
  /** Vertical gap between stacked section rows, px. */
  rowGap: number;
  /** Steam upload hard cap per file, bytes. */
  maxFileBytes: number;
  maxSections: number;
}

export const FILE_LIMIT_BYTES = 5 * 1024 * 1024;

/**
 * Vertical gap between stacked showcases on a profile.
 * UNCONFIRMED exact value; community guides slice contiguously and accept the
 * seam, so we default to 0 and let the user tweak it later if it matters.
 */
const ROW_GAP = 0;

export const SHOWCASES: Record<ShowcaseSpec["id"], ShowcaseSpec> = {
  featured: {
    id: "featured",
    name: "Featured Artwork (1 слот, 630px)",
    slots: [{ width: 630 }],
    slotGap: 0,
    rowGap: ROW_GAP,
    maxFileBytes: FILE_LIMIT_BYTES,
    maxSections: 6,
  },
  artwork: {
    id: "artwork",
    name: "Artwork Showcase (506px + 100px)",
    slots: [{ width: 506 }, { width: 100 }],
    // CONFLICTING 8 vs 9 — see docs/steam-specs.md. 8 is the most-cited value.
    slotGap: 8,
    rowGap: ROW_GAP,
    maxFileBytes: FILE_LIMIT_BYTES,
    maxSections: 6,
  },
};

/** Total strip width of one section row: slots plus internal gaps. */
export function stripWidth(spec: ShowcaseSpec): number {
  const slots = spec.slots.reduce((sum, s) => sum + s.width, 0);
  return slots + spec.slotGap * (spec.slots.length - 1);
}
