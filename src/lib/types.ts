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

/** How the source is fitted into the showcase strip before cutting. */
export interface Framing {
  /** 1 = source exactly covers the strip. >1 zooms in. */
  zoom: number;
  /** 0..1 pan within the overflow. 0.5 = centred. */
  panX: number;
  panY: number;
}

export const DEFAULT_FRAMING: Framing = { zoom: 1, panX: 0.5, panY: 0.5 };

export interface PlannedSlice {
  index: number;
  /** Crop rect in source pixels (fractional; snap with `pixelRect` before cutting). */
  source: Rect;
  /** Position inside the assembled strip, in strip pixels. */
  strip: Rect;
  /** Pixel size each exported file should have. */
  output: { w: number; h: number };
}

export interface SlicePlan {
  showcaseId: string;
  sections: number;
  /** Size of the assembled strip in showcase pixels (slots + gaps). */
  strip: { w: number; h: number };
  /** Region of the source that the strip maps onto. */
  sourceWindow: Rect;
  slices: PlannedSlice[];
}

/** What the optimizer did to a file, for display next to it. */
export interface OptimizeSummary {
  /** Human-readable description of the applied step; null = nothing helped. */
  label: string | null;
  /** Whether the result is within the target size. */
  fits: boolean;
  targetBytes: number;
}

/** One exported slot file as shown in the results grid. */
export interface SliceFile {
  index: number;
  filename: string;
  kind: SourceKind;
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
