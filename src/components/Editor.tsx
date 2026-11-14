"use client";

import { useMemo, useState } from "react";
import { useSlices } from "@/hooks/useSlices";
import { useSource } from "@/hooks/useSource";
import { formatBytes, formatSeconds } from "@/lib/format";
import { DEFAULT_OPTIMIZE_SETTINGS, type OptimizeSettings } from "@/lib/optimize/settings";
import { buildPlan, planKey, planUpscale } from "@/lib/steam/plan";
import { ROW_HEIGHT, SHOWCASES } from "@/lib/steam/showcases";
import { DEFAULT_FRAMING, type SourceImage } from "@/lib/types";
import ControlsPanel, { type SliceSettings } from "./ControlsPanel";
import HelpBlurb from "./HelpBlurb";
import OptimizerPanel from "./OptimizerPanel";
import ShowcasePreview from "./ShowcasePreview";
import SliceResults from "./SliceResults";
import UploadZone from "./UploadZone";
import { SectionTitle, primaryButtonClass } from "./ui";

const DEFAULT_SETTINGS: SliceSettings = {
  showcaseId: "featured",
  sections: 1,
  rowHeight: ROW_HEIGHT.default,
  framing: DEFAULT_FRAMING,
  scale: 1,
};

/** Above this the export is visibly stretched; below it's just rounding. */
const UPSCALE_WARN = 1.05;

function describeSource(source: SourceImage): string {
  const parts = [`${source.width}×${source.height}`, formatBytes(source.file.size)];
  if (source.frameCount > 1) {
    parts.push(`${source.frameCount} кадрів`, formatSeconds(source.durationMs));
  }
  return parts.join(" · ");
}

export default function Editor() {
  const { source, error: sourceError, loading, load } = useSource();
  const slices = useSlices();
  const [settings, setSettings] = useState<SliceSettings>(DEFAULT_SETTINGS);
  const [optimizeSettings, setOptimizeSettings] =
    useState<OptimizeSettings>(DEFAULT_OPTIMIZE_SETTINGS);

  const plan = useMemo(
    () =>
      source &&
      buildPlan({
        spec: SHOWCASES[settings.showcaseId],
        sections: settings.sections,
        rowHeight: settings.rowHeight,
        source,
        framing: settings.framing,
        scale: settings.scale,
      }),
    [source, settings],
  );

  const stale = useMemo(
    () => plan !== null && slices.slicedKey !== null && planKey(plan) !== slices.slicedKey,
    [plan, slices.slicedKey],
  );

  async function handleFile(file: File) {
    // Files cut from the previous source are meaningless for the new one.
    if (await load(file)) slices.clear();
  }

  const gifIndexes = slices.files.filter((f) => f.kind === "gif").map((f) => f.index);
  const optimizerBusy = Object.keys(slices.optimizing).length > 0;
  const upscale = plan ? planUpscale(plan) : 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">SProfile Editor</h1>
        <p className="text-sm text-muted">
          Нарізає GIF, PNG або JPG на слоти Steam showcase — з превʼю того, як це виглядатиме на
          профілі.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4">
          <UploadZone
            onFile={handleFile}
            error={sourceError}
            loading={loading}
            fileName={source?.file.name}
            fileInfo={source ? describeSource(source) : undefined}
          />
          <ControlsPanel
            settings={settings}
            onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
            disabled={!source}
          />
          <HelpBlurb />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-md border border-line bg-surface p-4">
            <div className="mb-3">
              <SectionTitle>Превʼю вітрини</SectionTitle>
            </div>
            {source && plan ? (
              <ShowcasePreview source={source} plan={plan} />
            ) : (
              <p className="py-12 text-center text-sm text-muted">
                Завантаж зображення щоб побачити превʼю
              </p>
            )}
          </div>

          {source && plan && (
            <>
              {upscale > UPSCALE_WARN && (
                <p className="rounded bg-warn-bg px-3 py-2 text-xs text-warn">
                  Джерело замале для цих налаштувань: його розтягне в {upscale.toFixed(2)}x, буде
                  мильно. Зменш зум, масштаб експорту або візьми більшу картинку.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => slices.run(source, plan)}
                  disabled={slices.slicing}
                  className={`${primaryButtonClass} px-4 py-2 text-sm`}
                >
                  {slices.slicing ? "Нарізаємо…" : "Нарізати"}
                </button>
                {slices.progress && (
                  <span className="text-xs text-muted">
                    {slices.progress.done}/{slices.progress.total}
                  </span>
                )}
                {slices.error && <span className="text-xs text-danger">{slices.error}</span>}
              </div>

              {gifIndexes.length > 0 && (
                <OptimizerPanel
                  settings={optimizeSettings}
                  onChange={setOptimizeSettings}
                  fileCount={gifIndexes.length}
                  busy={optimizerBusy}
                  onOptimizeAll={() => slices.optimize(gifIndexes, optimizeSettings)}
                />
              )}

              <SliceResults
                files={slices.files}
                stale={stale}
                optimizing={slices.optimizing}
                onOptimize={(index) => slices.optimize([index], optimizeSettings)}
                onRevert={slices.revert}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
