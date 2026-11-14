"use client";

import { useEffect, useMemo, useState } from "react";
import { useOverrides } from "@/hooks/useOverrides";
import { useSlices } from "@/hooks/useSlices";
import { downloadAll } from "@/lib/download";
import { LOCALES, setLocale, useI18n, type I18n } from "@/lib/i18n";
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from "@/lib/optimize/settings";
import { buildPlan, fittedHeight, panelKey, showcaseUsage, slotId } from "@/lib/steam/plan";
import { DEFAULT_LAYOUT, PROFILE } from "@/lib/steam/profile";
import { FILE_LIMIT_BYTES, ROW_HEIGHT, SHOWCASES, stripWidth, type ShowcaseId } from "@/lib/steam/showcases";
import type { PlannedSlice, SourceImage } from "@/lib/types";
import { useSource } from "@/hooks/useSource";
import ControlsPanel, { type SliceSettings } from "./ControlsPanel";
import HelpBlurb from "./HelpBlurb";
import PanelDialog from "./PanelDialog";
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

  // Panels are cut automatically whenever the background, the layout or a slot's own file changes.
  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(
      () => runSlicing(source, plan, overrides),
      RESLICE_DELAY_MS[source.kind],
    );
    return () => clearTimeout(timer);
  }, [source, plan, overrides, runSlicing]);

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
  const partlyOutside = plan.slices.some((s) => s.coverage < 1 && !overrides[panelKey(s.panel)]);
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
            overrides={overrides}
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
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
