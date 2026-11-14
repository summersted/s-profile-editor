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
  /** Crop rect in source pixels. */
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

export interface SliceOutput {
  index: number;
  blob: Blob;
  url: string;
  bytes: number;
  filename: string;
}
