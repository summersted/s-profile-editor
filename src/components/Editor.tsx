"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { renderKey, useCompositions, type ApplyInput } from "@/hooks/useCompositions";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { useOverrides } from "@/hooks/useOverrides";
import { useSlices } from "@/hooks/useSlices";
import { downloadAll } from "@/lib/download";
import { LOCALES, setLocale, useI18n, type I18n } from "@/lib/i18n";
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from "@/lib/optimize/settings";
import {
  buildPlan,
  fittedHeight,
  ownFileCrop,
  ownFileRect,
  panelKey,
  showcaseUsage,
  slotId,
  stripBackgroundRect,
} from "@/lib/steam/plan";
import { DEFAULT_LAYOUT, PROFILE } from "@/lib/steam/profile";
import { FILE_LIMIT_BYTES, ROW_HEIGHT, SHOWCASES, stripWidth, type ShowcaseId } from "@/lib/steam/showcases";
import type { PlannedSlice, SourceImage } from "@/lib/types";
import { useSource } from "@/hooks/useSource";
import ControlsPanel, { type SliceSettings } from "./ControlsPanel";
import HelpBlurb from "./HelpBlurb";
import PanelDialog from "./PanelDialog";
import PanelEditor from "./editor/PanelEditor";
import ProfilePreview from "./ProfilePreview";
import UploadZone from "./UploadZone";
import { SectionTitle, inputClass, secondaryButtonClass } from "./ui";

const DEFAULT_SETTINGS: SliceSettings = {
  showcaseId: "artwork",
  sections: 2,
  rowHeight: ROW_HEIGHT.default,
  panelHeights: {},
  panelTypes: {},
  layout: DEFAULT_LAYOUT,
};

/** Lays the preview out before anything is uploaded. */
const PLACEHOLDER_BG = { width: PROFILE.bgWidth, height: PROFILE.bgHeight };

/** GIF cuts run gifsicle per slot, so wait a bit longer for the user to stop typing. */
const RESLICE_DELAY_MS = { gif: 700, static: 250 } as const;

function describeSource(source: SourceImage, { m, bytes, seconds }: I18n): string {
  const parts = [`${source.width}×${source.height}`, bytes(source.file.size)];
  if (source.frameCount > 1) {
    parts.push(m.upload.frames(source.frameCount), seconds(source.durationMs));
  }
  return parts.join(" · ");
}

export default function Editor() {
  const i18n = useI18n();
  const { m, locale, bytes, failure } = i18n;
  const { source, error: sourceError, loading, load } = useSource();
  const slices = useSlices();
  const own = useOverrides();
  const { overrides } = own;
  const { run: runSlicing, clear: clearSlices } = slices;
  const [settings, setSettings] = useState<SliceSettings>(DEFAULT_SETTINGS);
  const [optimizeSettings, setOptimizeSettings] =
    useState<OptimizeSettings>(DEFAULT_OPTIMIZE_SETTINGS);
  /** Open dialog's slot, by `slotId`: survives re-numbering when a panel is split or merged. */
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const comps = useCompositions();
  const { edits, rendering: composing, apply: applyComposition } = comps;
  const library = useMediaLibrary();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const spec = SHOWCASES[settings.showcaseId];
  const plan = useMemo(
    () =>
      buildPlan({
        spec,
        layout: settings.layout,
        sections: settings.sections,
        rowHeight: settings.rowHeight,
        panelHeights: settings.panelHeights,
        panelTypes: settings.panelTypes,
        source: source ?? PLACEHOLDER_BG,
      }),
    [spec, settings, source],
  );

  const mediaMap = useMemo(
    () => new Map(library.items.map((item) => [item.id, item.image])),
    [library.items],
  );

  /** What each panel's composition is rendered from: its strip, and the own file or background under it. */
  const applyInputs = useMemo(() => {
    const out: Record<string, ApplyInput> = {};
    if (!source) return out;
    for (const p of plan.panels) {
      const key = panelKey(p.index);
      const ownImage = overrides[key];
      out[key] = {
        strip: { w: p.strip.w, h: p.strip.h },
        density: plan.density,
        base: ownImage
          ? { image: ownImage, rect: ownFileCrop(ownImage, p.strip, p.strip) }
          : { image: source, rect: stripBackgroundRect(plan, p.strip, source) },
        media: mediaMap,
      };
    }
    return out;
  }, [source, plan, overrides, mediaMap]);

  /** Edited panels replace their picture with the rendered composition. */
  const composedImages = useMemo(() => {
    const out: Record<string, SourceImage> = {};
    for (const [key, edit] of Object.entries(edits)) {
      if (edit.applied && applyInputs[key]) out[key] = edit.applied.image;
    }
    return out;
  }, [edits, applyInputs]);
  /** What each panel shows instead of the background: edited render > own file. */
  const panelSources = useMemo(() => ({ ...overrides, ...composedImages }), [overrides, composedImages]);
  const editedPanels = useMemo(
    () => new Set(Object.keys(composedImages).map(Number)),
    [composedImages],
  );
  const usedMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const edit of Object.values(edits)) {
      for (const l of edit.history.present.layers) if (l.kind === "media") ids.add(l.mediaId);
    }
    return ids;
  }, [edits]);

  // A rendered panel goes stale when its base or size changes: re-render it in the background.
  useEffect(() => {
    const stale = Object.entries(edits).filter(
      ([key, e]) => e.applied && applyInputs[key] && e.applied.key !== renderKey(applyInputs[key]) && !composing[key],
    );
    if (stale.length === 0) return;
    const timer = setTimeout(() => {
      for (const [key] of stale) applyComposition(key, applyInputs[key]);
    }, 600);
    return () => clearTimeout(timer);
  }, [edits, applyInputs, composing, applyComposition]);

  // Panels are cut automatically whenever the background, the layout or a panel's picture changes.
  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(
      () => runSlicing(source, plan, panelSources),
      RESLICE_DELAY_MS[source.kind],
    );
    return () => clearTimeout(timer);
  }, [source, plan, panelSources, runSlicing]);

  async function handleFile(file: File) {
    // Files cut from the previous background are meaningless for the new one.
    if (await load(file)) {
      clearSlices();
      setOpenSlot(null);
    }
  }

  /** Put the user's file onto a whole panel and stretch the panel to the file's height. */
  async function uploadOwn(s: PlannedSlice, file: File) {
    const image = await own.set(panelKey(s.panel), file);
    if (!image) return;
    const height = fittedHeight(image, plan.panels[s.panel].strip.w);
    setSettings((prev) => ({
      ...prev,
      panelHeights: { ...prev.panelHeights, [s.panel]: height },
    }));
  }

  /**
   * Give one panel its own showcase type; the common type means "no override".
   * A panel carrying an own file is re-fitted to it, so after a split the
   * whole file is shown across 506 + 100 instead of being cropped.
   */
  function setPanelType(panel: number, type: ShowcaseId) {
    const image = overrides[panelKey(panel)];
    setSettings((prev) => {
      const panelTypes = { ...prev.panelTypes };
      if (type === prev.showcaseId) delete panelTypes[panel];
      else panelTypes[panel] = type;
      const panelHeights = image
        ? { ...prev.panelHeights, [panel]: fittedHeight(image, stripWidth(SHOWCASES[type])) }
        : prev.panelHeights;
      return { ...prev, panelTypes, panelHeights };
    });
  }

  /** Render the edited panel, then leave the editor. */
  async function finishEditing(panel: number) {
    const key = panelKey(panel);
    if (applyInputs[key]) await applyComposition(key, applyInputs[key]);
    setEditing(false);
  }

  function renderEditor(panel: number) {
    const p = plan.panels[panel];
    const key = panelKey(panel);
    const edit = comps.get(key);
    const ownImage = overrides[key];
    let baseStyle: CSSProperties;
    if (ownImage) {
      const drawn = ownFileRect(ownImage, p.strip);
      baseStyle = {
        backgroundImage: `url(${ownImage.previewUrl})`,
        backgroundSize: `${drawn.w}px ${drawn.h}px`,
        backgroundPosition: `${drawn.x - p.strip.x}px ${drawn.y - p.strip.y}px`,
        backgroundRepeat: "no-repeat",
      };
    } else {
      baseStyle = {
        backgroundImage: source ? `url(${source.previewUrl})` : undefined,
        backgroundSize: `${plan.bg.w}px ${plan.bg.h}px`,
        backgroundPosition: `${plan.bg.x - p.strip.x}px ${plan.bg.y - p.strip.y}px`,
        backgroundRepeat: "no-repeat",
      };
    }
    return (
      <PanelEditor
        strip={{ w: p.strip.w, h: p.strip.h }}
        slots={plan.slices
          .filter((s) => s.panel === panel)
          .map((s) => ({ x: s.page.x - p.strip.x, y: 0, w: s.page.w, h: s.page.h }))}
        baseStyle={baseStyle}
        baseFrameCount={(ownImage ?? source)?.frameCount ?? 1}
        composition={edit.history.present}
        canUndo={edit.history.past.length > 0}
        canRedo={edit.history.future.length > 0}
        onChange={(fn, mergeKey) => comps.change(key, fn, mergeKey)}
        onUndo={() => comps.undo(key)}
        onRedo={() => comps.redo(key)}
        media={library.items}
        usedMediaIds={usedMediaIds}
        mediaError={library.error}
        onAddMedia={library.add}
        onRemoveMedia={library.remove}
        rendering={composing[key]}
      />
    );
  }

  /** Back to the background; the panel returns to the common height. */
  function resetOwn(s: PlannedSlice) {
    own.reset(panelKey(s.panel));
    setSettings((prev) => {
      const panelHeights = { ...prev.panelHeights };
      delete panelHeights[s.panel];
      return { ...prev, panelHeights };
    });
  }

  const { files } = slices;
  // The dialog follows the slot, not the file: the file is replaced on every re-cut.
  const openPlanned = plan.slices.find((s) => slotId(s) === openSlot) ?? null;
  const openFile = openPlanned ? (files.find((f) => f.index === openPlanned.index) ?? null) : null;
  const openPanel = openPlanned ? plan.panels[openPlanned.panel] : null;
  const sameKind = files.filter((f) => f.kind === openFile?.kind).map((f) => f.index);
  const totalBytes = files.reduce((sum, f) => sum + f.blob.size, 0);
  const oversizeCount = files.filter((f) => f.blob.size > FILE_LIMIT_BYTES).length;
  const partlyOutside = plan.slices.some((s) => s.coverage < 1 && !panelSources[panelKey(s.panel)]);
  const lowRes = source !== null && source.width < PROFILE.bgWidth * 0.95;

  let status = "";
  if (slices.progress) status = m.preview.slicing(slices.progress.done, slices.progress.total);
  else if (files.length > 0) status = m.preview.files(files.length, bytes(totalBytes));
  else if (!source) status = m.preview.uploadPrompt;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">SProfile Editor</h1>
          <p className="text-sm text-muted">{m.app.subtitle}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          {m.app.language}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number]["id"])}
            className={inputClass}
          >
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <UploadZone
            onFile={handleFile}
            error={sourceError ? failure(sourceError) : null}
            loading={loading}
            fileName={source?.file.name}
            fileInfo={source ? describeSource(source, i18n) : undefined}
          />
          <ControlsPanel
            settings={settings}
            usage={showcaseUsage(plan)}
            onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
          />
          <HelpBlurb />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <SectionTitle>{m.preview.title}</SectionTitle>
              <span className="text-xs text-muted">
                {status}
                {oversizeCount > 0 && (
                  <span className="text-warn"> · {m.preview.oversize(oversizeCount)}</span>
                )}
              </span>
            </div>
            <button
              type="button"
              disabled={files.length === 0 || slices.slicing}
              onClick={() => downloadAll(files)}
              className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
            >
              {m.preview.downloadAll(files.length)}
            </button>
          </div>

          {comps.error && (
            <p className="rounded border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger">
              {failure(comps.error)}
            </p>
          )}
          {slices.error && (
            <p className="rounded border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger">
              {failure(slices.error)}
            </p>
          )}
          {lowRes && (
            <p className="rounded bg-warn-bg px-3 py-2 text-xs text-warn">
              {m.preview.lowRes(source.width)}
            </p>
          )}
          {source && partlyOutside && (
            <p className="rounded bg-warn-bg px-3 py-2 text-xs text-warn">
              {m.preview.partlyOutside}
            </p>
          )}

          <ProfilePreview
            plan={plan}
            layout={settings.layout}
            imageUrl={source?.previewUrl ?? null}
            overrides={panelSources}
            editedPanels={editedPanels}
            files={files}
            slicing={slices.slicing}
            optimizing={slices.optimizing}
            onSlotClick={(index) => {
              const s = plan.slices[index];
              if (s) setOpenSlot(slotId(s));
            }}
          />

          {source?.kind === "gif" && <p className="text-xs text-muted">{m.preview.gifNote}</p>}
        </div>
      </div>

      {openPlanned && openPanel && (
        <PanelDialog
          key={slotId(openPlanned)}
          index={openPlanned.index}
          panel={openPanel.index}
          panelType={openPanel.showcaseId}
          onPanelTypeChange={(type) => setPanelType(openPanel.index, type)}
          file={openFile}
          override={overrides[panelKey(openPlanned.panel)]}
          customSource={!!panelSources[panelKey(openPlanned.panel)]}
          editing={editing}
          rendering={!!composing[panelKey(openPanel.index)]}
          onEditingChange={(on) => {
            if (on) setEditing(true);
            else finishEditing(openPanel.index);
          }}
          editor={editing && source ? renderEditor(openPanel.index) : null}
          outsideBackground={openPlanned.coverage === 0}
          slicing={slices.slicing}
          stripWidth={openPanel.strip.w}
          uploadError={own.error}
          onUpload={(file) => uploadOwn(openPlanned, file)}
          onResetToBackground={() => resetOwn(openPlanned)}
          sameKindCount={sameKind.length}
          optimizeSettings={optimizeSettings}
          onOptimizeSettingsChange={setOptimizeSettings}
          optimizing={slices.optimizing[openPlanned.index]}
          onOptimize={() => slices.optimize([openPlanned.index], optimizeSettings)}
          onOptimizeAll={() => slices.optimize(sameKind, optimizeSettings)}
          onRevert={() => slices.revert(openPlanned.index)}
          onClose={() => {
            // Closing mid-edit keeps the edits: render them in the background.
            if (editing) {
              const key = panelKey(openPanel.index);
              if (applyInputs[key]) applyComposition(key, applyInputs[key]);
            }
            setEditing(false);
            setOpenSlot(null);
          }}
        />
      )}
    </div>
  );
}
