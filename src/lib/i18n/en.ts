import type { Messages } from "./types";

const s = (n: number, one: string, other: string) => (n === 1 ? one : other);

const en: Messages = {
  app: {
    subtitle:
      "Upload a profile background — it lands on the preview right away, and the showcase panels are cut from it automatically. Click a panel to download it, swap in your own file or compress it.",
    language: "Language",
  },
  upload: {
    prompt: "Drop a GIF, PNG or JPG here, or click to choose a file",
    reading: "Reading file…",
    frames: (n) => `${n} ${s(n, "frame", "frames")}`,
  },
  controls: {
    title: "Panels",
    showcaseType: "Showcase type",
    count: "Count",
    height: "Height, px",
    customHeights: (n) =>
      `${n} ${s(n, "panel has", "panels have")} its own height (from your files).`,
    resetHeights: "Use common height",
    usage: (name, used, max) => `${name}: ${used}/${max}`,
    overLimit: (name, max) =>
      `Steam allows at most ${max} “${name}” showcases per profile. Split a panel into 506 + 100 (or merge one) to switch its type, or use fewer panels.`,
    extraNeeded: (pts) =>
      `A second showcase of the same type is an “Extra showcase” from the Points Shop (${pts.toLocaleString("en")} points). Every showcase also needs a free slot — those come with your Steam level.`,
    customLayouts: (n) => `${n} ${s(n, "panel has", "panels have")} its own layout.`,
    resetLayouts: "Use common type",
    calibration: "Calibrate to a real profile",
    calibrationHint:
      "Offsets are measured on a real Steam profile (desktop). Profile themes may differ: if the panels don't line up with the background on your profile, adjust by however many px they're off.",
    headerHeight: "First panel top",
    leftColX: "Column left offset",
    panelHeader: "Panel title height",
    panelGap: "Gap between panels",
    resetDefaults: "Reset to defaults",
  },
  showcases: {
    featured: { option: "Featured Artwork (1 slot, 630px)", title: "Featured Artwork Showcase", short: "Featured Artwork" },
    artwork: { option: "Artwork Showcase (506px + 100px)", title: "Artwork Showcase", short: "Artwork" },
  },
  preview: {
    title: "Profile preview",
    uploadPrompt: "Upload a background to see your profile",
    slicing: (done, total) => `Cutting ${done}/${total}…`,
    files: (n, size) => `${n} ${s(n, "file", "files")} · ${size}`,
    oversize: (n) => `${n} over the limit`,
    downloadAll: (n) => `Download all (${n})`,
    lowRes: (w) =>
      `The background is ${w}px wide, but Steam shows backgrounds at 1920px — it's stretched here, so the panels will look blurry.`,
    partlyOutside:
      "Some panels go past the bottom of the background — those parts will be empty. Use fewer or shorter panels.",
    gifNote:
      "Animation in the preview: frames in different panels may drift slightly out of sync. That's a preview quirk only; the files are fine.",
  },
  profile: {
    artworkTitle: "Artwork title",
    nickname: "Your nickname",
    country: "Country",
    level: "Level",
    editProfile: "Edit Profile",
    online: "Currently Online",
    badges: "Badges",
    games: "Games",
    groups: "Groups",
    friends: "Friends",
  },
  slot: {
    name: (n) => `Slot ${n}`,
    outside: "outside background",
    compressing: "compressing…",
    slicing: "cutting…",
    ownFile: "your file",
    clickHint: (n) => `${n} · click`,
  },
  dialog: {
    close: "Close",
    slicing: "Cutting…",
    outsideEmpty:
      "This slot is entirely outside the background — it'll be empty on the profile. You can put your own file here.",
    noFile: "No file yet.",
    contentTitle: "Slot content",
    panelLayout: "Panel layout",
    layoutSingle: "One slot · 630px",
    layoutSplit: "Two slots · 506 + 100px",
    layoutHint: (p) => `Only panel ${p} changes; the others keep the type chosen under Panels. An own file on this panel is re-cut across the new slots; the panel height adjusts so the whole file stays visible.`,
    ownFile: "Your file (whole panel):",
    backgroundPiece: "The piece of background under this panel",
    upload: "Put your own file on the panel…",
    replace: "Replace file…",
    resetToBackground: "Back to background",
    uploadHint: (w) =>
      `GIF, PNG or JPG; you can also drop it on the image on the left. The file covers the whole panel (${w}px wide) and the panel stretches to its height. In a 506 + 100 panel it's cut into both slots like the background; if the panel's size changes later, it's cropped from the centre.`,
    oversize: (limit) =>
      `Over Steam's ${limit} limit — it'll show as a still frame on the profile or fail to upload.`,
    applied: (step) => `Applied: ${step}`,
    alreadyFits: "Already fits, left as is",
    couldNotShrink: "Couldn't make it smaller",
    fits: (limit) => `fits in ${limit}`,
    doesNotFit: (limit) => `doesn't fit in ${limit}`,
    download: "Download",
    undoCompression: "Undo compression",
    undoCompressionTitle: "Restore the file as it was cut",
    gifOptimizer: "GIF optimizer",
    imageOptimizer: "Image optimizer",
  },
  optimizer: {
    auto: "Auto — fit the limit",
    manual: "Manual",
    limitMb: "File limit, MB",
    queued: "queued",
    optimize: "Optimize",
    optimizing: "Optimizing…",
    applyAll: (n) => `Apply to all (${n})`,
    restartNote:
      "Every run starts from the original cut, so you can tweak settings and rerun without losses piling up.",
    gifAutoHint:
      "Tries lossless compression first. If the file is still over the limit, it gradually adds the losses allowed below and stops at the lightest option that fits.",
    lossy: "Lossy compression",
    lossyHint: "Slight noise in fine detail; barely visible at low values.",
    palette: "Palette reduction",
    paletteHint: "Fewer colours — gradients may show banding.",
    dropFrames: "Drop frames",
    dropFramesHint: "Drops every 2nd/3rd frame; same duration, less smooth motion.",
    nothingAllowed:
      "Nothing is allowed — only lossless compression will run, it may not fit the limit.",
    lossyLabel: "Lossy",
    off: "off",
    colors: "Colours",
    untouched: "keep",
    frames: "Frames",
    allFrames: "all",
    everyNth: (n) => `every ${n}${ordinalSuffix(n)}`,
    resolution: "Resolution",
    manualExact: (step) =>
      `Exactly this is applied: ${step}. The limit here only marks “fits / doesn't fit”.`,
    lowResNote: " Reduced resolution: Steam stretches the file to the slot width, so it'll look softer.",
    imageAutoHint:
      "A lossless PNG is kept as is if it fits the limit. Otherwise the highest JPEG quality that fits is used.",
    allowJpeg: "Allow JPEG",
    allowJpegHint: "Steam accepts both PNG and JPG. JPEG is several times lighter but has no transparency.",
    format: "Format",
    pngUnchanged: "PNG (unchanged)",
    jpegQuality: "JPEG quality",
    moreInfo: "More info",
    tips: {
      mode: "Auto searches for the gentlest settings that bring the file under the limit, trying as few passes as possible. Manual applies exactly the values you set, once.",
      limit: "Target file size. Steam rejects showcase files over 5 MB (or shows a still frame instead of the animation), so 5 is the sensible maximum; go lower to leave a margin.",
      lossy: "Lets gifsicle approximate pixels so the GIF compresses better. Low levels are almost invisible; high levels add grain and smearing in fine detail.",
      palette: "Reduces the number of colours per frame (down to 128 → 64 → 32 → 16). Big savings on busy images, but smooth gradients start to show bands.",
      dropFrames: "Keeps every 2nd or 3rd frame and gives each kept frame the duration of the dropped ones, so the loop stays the same length but motion gets choppier. Used last.",
      lossyLevel: "gifsicle --lossy strength, 0–200. 0 = lossless; 20–60 is usually invisible; 100+ is noticeable; 200 is the maximum.",
      colors: "Maximum colours per frame. “Keep” leaves the palette untouched (up to 256). Fewer colours = smaller file, more banding.",
      frames: "Keep all frames or only every Nth one. Total duration is preserved; motion becomes less smooth.",
      resolution: "Shrinks the GIF. Steam still displays it at the full slot width, so it gets upscaled and looks softer — use only as a last resort.",
      allowJpeg: "Lets the optimizer turn the PNG into a JPEG when the PNG is over the limit. JPEG is far smaller but has no transparency (transparent areas become black).",
      format: "PNG keeps the file exactly as cut. JPEG re-encodes it at the chosen quality.",
      jpegQuality: "Higher = sharper and bigger. 85–95% is usually indistinguishable from the original; below 70% artefacts appear around edges.",
    },
    progress: {
      title: "Optimizing",
      queued: "Waiting for a free worker…",
      reading: "Reading the file",
      decoding: "Decoding the image",
      encodingJpeg: "Encoding JPEG",
      lossless: "Lossless compression",
      dropFrames: "Dropping frames",
      scale: "Scaling",
      palette: "Reducing palette",
      lossy: "Lossy compression",
      pass: (n, max) => `Pass ${n} of up to ${max}`,
    },
  },
  steps: {
    lossless: "lossless",
    lossy: (n) => `lossy ${n}`,
    colors: (n) => `${n} colours`,
    everyNthFrame: (n) => `every ${n}${ordinalSuffix(n)} frame`,
    scale: (p) => `scale ${p}%`,
    jpeg: (p) => `JPEG ${p}%`,
  },
  errors: {
    read: "Couldn't read the file",
    slice: "Couldn't cut the image",
    optimize: "Couldn't optimize",
    codes: {
      notGif: () => "This isn't a GIF file",
      noFrames: () => "The GIF has no frames",
      zeroSize: () => "The image has zero size",
      unreadableImage: () => "Couldn't read the file as an image (GIF, PNG and JPG are supported)",
      canvasUnavailable: () => "Canvas 2D isn't available in this browser",
      encodeFailed: () => "Couldn't encode the image",
      gifsicleNoOutput: (p) => `gifsicle returned nothing for slot ${p.slot ?? "?"}`,
      gifsicleCrashed: (p) => `gifsicle crashed${p.detail ? `: ${p.detail}` : ""}`,
    },
  },
  help: {
    summary: "Help: how to put it on Steam",
    steps: [
      "Set the same background on your Steam profile. The panels are cut from the parts of the background they sit over, so together they look like one picture.",
      "Upload the files to the showcases in order: slice-1, slice-2… For the Artwork Showcase, the main slot (506px) goes first, then the side one (100px) — order matters.",
      "Steam accepts at most 5 MB per slot. If a file doesn't fit, click the panel in the preview and compress it: auto mode applies the lightest option that fits the limit.",
      "If the panels are off relative to the background on your real profile, adjust the offsets under “Calibrate to a real profile” — everything is re-cut.",
      "For panels taller than a normal showcase there's a devtools trick: open Steam's image upload form, open the developer console and run:",
    ],
    trickNote:
      "This removes the client-side size check in the upload form so Steam accepts a narrow image.",
  },
};

function ordinalSuffix(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  if (teen) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}

export default en;
