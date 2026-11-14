import type { OptimizeLabel } from "./optimize/settings";
import type { ShowcaseId } from "./steam/showcases";

/** Source media the user dropped in: either a still background or an animated GIF. */
export type SourceKind = "gif" | "static";

export interface SourceImage {
  file: File;
  kind: SourceKind;
  /** Intrinsic pixel size of the source. */
  width: number;
  height: number;
  /** 1 for stills. */
  frameCount: number;
  /** Total loop length in ms; 0 for stills. */
  durationMs: number;
  /** Blob URL for on-screen preview. Revoke when the source is replaced. */
  previewUrl: string;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One showcase block on the profile page. */
export interface PanelBox {
  index: number;
  /** Showcase type of this panel. */
  showcaseId: ShowcaseId;
  /** True if the type comes from a per-panel setting, not the shared default. */
  customType: boolean;
  /** Height of the artwork area, page px. */
  height: number;
  /** True if the height comes from a per-panel setting, not the shared default. */
  customHeight: boolean;
  /** Whole block in page px: title bar on top, artwork below it. */
  box: Rect;
  /** The row of slot images, gaps included, page px. A panel's own file is fitted to this. */
  strip: Rect;
}

/** One uploadable file: a slot of a showcase. */
export interface PlannedSlice {
  index: number;
  /** Which showcase (PanelBox.index) the slot belongs to. */
  panel: number;
  /** Position of the slot inside its showcase, left to right. */
  slot: number;
  /** Where the slot sits on the page, page px. */
  page: Rect;
  /** Matching region of the background, source px (fractional; snap with `cropBox`). */
  source: Rect;
  /** Pixel size of the exported file. */
  output: { w: number; h: number };
  /** Share of the slot covered by the background, 0..1. 0 = nothing to cut. */
  coverage: number;
}

export interface SlicePlan {
  showcaseId: string;
  sections: number;
  /** Size of the content column area to draw, page px. */
  page: { w: number; h: number };
  /** Where the background is drawn, page px. */
  bg: Rect;
  /** Export px per page px (1, or 2 for 4K backgrounds). */
  density: number;
  panels: PanelBox[];
  slices: PlannedSlice[];
}

/** What the optimizer did to a file, for display next to it. */
export interface OptimizeSummary {
  /** The applied step; null = file left as is. */
  label: OptimizeLabel | null;
  /** Whether the result is within the target size. */
  fits: boolean;
  targetBytes: number;
}

/** One exported slot file. */
export interface SliceFile {
  index: number;
  filename: string;
  kind: SourceKind;
  /** Identity of what was cut: same key = same bytes, so the file (and its optimization) can be kept. */
  cutKey: string;
  /** True if the slot holds the user's own file instead of a piece of the background. */
  custom: boolean;
  /** Pixel size of the file as cut (before any optimizer downscale). */
  width: number;
  height: number;
  /** The file exactly as cut — the optimizer always starts from this, never from its own output. */
  original: Blob;
  /** Current downloadable version: `original` or its optimized replacement. */
  blob: Blob;
  /** Blob URL of `blob`. */
  url: string;
  optimized: OptimizeSummary | null;
}
