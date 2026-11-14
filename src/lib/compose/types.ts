/**
 * A panel composition: layers drawn over the panel's base (the background
 * piece under it, or the user's own file). Coordinates are in the panel
 * strip's own page px (0,0 = top-left of the strip), positions are the
 * layer's centre, rotation is clockwise degrees.
 */

interface LayerCommon {
  id: string;
  x: number;
  y: number;
  rotation: number;
}

/** An image or GIF from the media library. */
export interface MediaLayer extends LayerCommon {
  kind: "media";
  mediaId: string;
  /** Drawn size, page px (before rotation). */
  w: number;
  h: number;
}

export interface TextLayer extends LayerCommon {
  kind: "text";
  text: string;
  fontFamily: string;
  /** px */
  fontSize: number;
  bold: boolean;
  color: string;
  strokeColor: string;
  /** Outline thickness outside the glyphs, px. 0 = none. */
  strokeWidth: number;
}

export type Layer = MediaLayer | TextLayer;

export interface Composition {
  /** Bottom to top. */
  layers: Layer[];
}

export const EMPTY_COMPOSITION: Composition = { layers: [] };

/** Fonts every desktop browser has; the preview and the export must agree. */
export const FONT_FAMILIES = [
  "Arial",
  "Verdana",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Comic Sans MS",
] as const;

export const TEXT_LINE_HEIGHT = 1.2;

export function newLayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** CSS / canvas font string for a text layer at a given scale. */
export function textFont(layer: TextLayer, scale = 1): string {
  return `${layer.bold ? 700 : 400} ${layer.fontSize * scale}px "${layer.fontFamily}", sans-serif`;
}
