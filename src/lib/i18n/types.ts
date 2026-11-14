import type { ErrorCode, ErrorParams } from "../errors";
import type { ShowcaseId } from "../steam/showcases";

export type Locale = "en" | "uk" | "nl";

/**
 * Every user-facing string in the app. Each locale file must implement all
 * of it — TypeScript fails the build on a missing key. Strings that need
 * values are functions; sizes arrive already formatted for the locale.
 */
export interface Messages {
  app: {
    subtitle: string;
    language: string;
  };
  upload: {
    prompt: string;
    reading: string;
    frames: (n: number) => string;
  };
  controls: {
    title: string;
    showcaseType: string;
    count: string;
    height: string;
    customHeights: (n: number) => string;
    resetHeights: string;
    usage: (name: string, used: number, max: number) => string;
    overLimit: (name: string, max: number) => string;
    extraNeeded: (points: number) => string;
    customLayouts: (n: number) => string;
    resetLayouts: string;
    calibration: string;
    calibrationHint: string;
    headerHeight: string;
    leftColX: string;
    panelHeader: string;
    panelGap: string;
    resetDefaults: string;
  };
  /** `option` is the select label; `title` imitates the showcase header Steam shows. */
  showcases: Record<ShowcaseId, { option: string; title: string; short: string }>;
  preview: {
    title: string;
    uploadPrompt: string;
    slicing: (done: number, total: number) => string;
    files: (n: number, size: string) => string;
    oversize: (n: number) => string;
    downloadAll: (n: number) => string;
    lowRes: (width: number) => string;
    partlyOutside: string;
    gifNote: string;
  };
  /** Placeholder content of the mock profile. */
  profile: {
    /** Placeholder for the title line under an artwork. */
    artworkTitle: string;
    nickname: string;
    country: string;
    level: string;
    editProfile: string;
    online: string;
    badges: string;
    games: string;
    groups: string;
    friends: string;
  };
  slot: {
    name: (n: number) => string;
    outside: string;
    compressing: string;
    slicing: string;
    ownFile: string;
    clickHint: (n: number) => string;
  };
  dialog: {
    close: string;
    slicing: string;
    outsideEmpty: string;
    noFile: string;
    contentTitle: string;
    panelLayout: string;
    layoutSingle: string;
    layoutSplit: string;
    layoutHint: (panel: number) => string;
    ownFile: string;
    backgroundPiece: string;
    upload: string;
    replace: string;
    resetToBackground: string;
    uploadHint: (stripWidth: number) => string;
    oversize: (limit: string) => string;
    applied: (step: string) => string;
    alreadyFits: string;
    couldNotShrink: string;
    fits: (limit: string) => string;
    doesNotFit: (limit: string) => string;
    download: string;
    undoCompression: string;
    undoCompressionTitle: string;
    gifOptimizer: string;
    imageOptimizer: string;
  };
  optimizer: {
    auto: string;
    manual: string;
    limitMb: string;
    queued: string;
    optimize: string;
    optimizing: string;
    applyAll: (n: number) => string;
    restartNote: string;
    gifAutoHint: string;
    lossy: string;
    lossyHint: string;
    palette: string;
    paletteHint: string;
    dropFrames: string;
    dropFramesHint: string;
    nothingAllowed: string;
    lossyLabel: string;
    off: string;
    colors: string;
    untouched: string;
    frames: string;
    allFrames: string;
    everyNth: (n: number) => string;
    resolution: string;
    manualExact: (step: string) => string;
    lowResNote: string;
    imageAutoHint: string;
    allowJpeg: string;
    allowJpegHint: string;
    format: string;
    pngUnchanged: string;
    jpegQuality: string;
    /** Accessible name of the "i" button that opens a tooltip. */
    moreInfo: string;
    /** Tooltip texts, one per setting. */
    tips: {
      mode: string;
      limit: string;
      lossy: string;
      palette: string;
      dropFrames: string;
      lossyLevel: string;
      colors: string;
      frames: string;
      resolution: string;
      allowJpeg: string;
      format: string;
      jpegQuality: string;
    };
    /** Overlay shown while a file is being optimized. */
    progress: {
      title: string;
      queued: string;
      reading: string;
      decoding: string;
      encodingJpeg: string;
      lossless: string;
      dropFrames: string;
      scale: string;
      palette: string;
      lossy: string;
      pass: (current: number, max: number) => string;
    };
  };
  /** Status tray: background work that keeps running when the dialog is closed. */
  tasks: {
    title: (n: number) => string;
    collapse: string;
    expand: string;
    reading: string;
    slicing: string;
    optimizing: (slot: number) => string;
    rendering: (panel: number) => string;
    openHint: string;
  };
  /** Panel editor: layers, media library, text, undo/redo. */
  editor: {
    edit: string;
    editing: (panel: number) => string;
    done: string;
    undo: string;
    redo: string;
    undoTitle: string;
    redoTitle: string;
    media: string;
    uploadMedia: string;
    mediaHint: string;
    mediaEmpty: string;
    removeMedia: string;
    mediaInUse: string;
    addText: string;
    defaultText: string;
    layers: string;
    layersEmpty: string;
    textLayer: string;
    moveUp: string;
    moveDown: string;
    deleteLayer: string;
    properties: string;
    text: string;
    font: string;
    size: string;
    color: string;
    bold: string;
    outline: string;
    outlineWidth: string;
    rotation: string;
    resetRotation: string;
    animated: (name: string, frames: number) => string;
    still: string;
    gapHint: string;
    hint: string;
    renderDecode: string;
    renderDraw: (done: number, total: number) => string;
    renderOptimize: string;
    edited: string;
  };
  /** Pieces of an optimizer step description. */
  steps: {
    lossless: string;
    lossy: (n: number) => string;
    colors: (n: number) => string;
    everyNthFrame: (n: number) => string;
    scale: (percent: number) => string;
    jpeg: (percent: number) => string;
  };
  errors: {
    /** Fallback when the cause has no usable text. */
    read: string;
    slice: string;
    optimize: string;
    codes: Record<ErrorCode, (p: ErrorParams) => string>;
  };
  help: {
    summary: string;
    /** Numbered paragraphs, rendered in order before the devtools snippet. */
    steps: string[];
    trickNote: string;
  };
}
