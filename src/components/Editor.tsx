"use client";

import { useMemo, useState } from "react";
import { DEFAULT_FRAMING, type Framing, type SliceOutput, type SourceImage } from "@/lib/types";
import { SHOWCASES, type ShowcaseSpec } from "@/lib/steam/showcases";
import { buildPlan } from "@/lib/steam/plan";
import { loadSource, releaseSource } from "@/lib/image/decode";
import { slice as sliceSource, releaseOutputs } from "@/lib/image/slice";
import { optimizeGif } from "@/lib/image/optimize";
import UploadZone from "./UploadZone";
import ControlsPanel from "./ControlsPanel";
import ShowcasePreview from "./ShowcasePreview";
import SliceResults, { type OptimizeMeta } from "./SliceResults";
import HelpBlurb from "./HelpBlurb";

type ShowcaseId = ShowcaseSpec["id"];

export default function Editor() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [showcaseId, setShowcaseId] = useState<ShowcaseId>("featured");
  const [sections, setSections] = useState(1);
  const [rowHeight, setRowHeight] = useState(200);
  const [framing, setFraming] = useState<Framing>(DEFAULT_FRAMING);
  const [scale, setScale] = useState<1 | 2>(1);

  const [outputs, setOutputs] = useState<SliceOutput[]>([]);
  const [slicing, setSlicing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [sliceError, setSliceError] = useState<string | null>(null);

  const [optimizing, setOptimizing] = useState<Record<number, boolean>>({});
  const [optimizeMeta, setOptimizeMeta] = useState<Record<number, OptimizeMeta>>({});

  const spec = SHOWCASES[showcaseId];

  const plan = useMemo(() => {
    if (!source) return null;
    return buildPlan({
      spec,
      sections,
      rowHeight,
      source: { width: source.width, height: source.height },
      framing,
      scale,
    });
  }, [spec, sections, rowHeight, source, framing, scale]);

  async function handleFile(file: File) {
    try {
      const next = await loadSource(file);
      if (source) releaseSource(source);
      if (outputs.length) releaseOutputs(outputs);
      setOutputs([]);
      setOptimizing({});
      setOptimizeMeta({});
      setSliceError(null);
      setSource(next);
      setSourceError(null);
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : "Не вдалося прочитати файл");
    }
  }

  function handleShowcaseChange(id: ShowcaseId) {
    setShowcaseId(id);
    setSections((s) => Math.min(s, SHOWCASES[id].maxSections));
  }

  async function handleSlice() {
    if (!source || !plan) return;
    setSlicing(true);
    setSliceError(null);
    setProgress({ done: 0, total: plan.slices.length });
    try {
      const next = await sliceSource(source, plan, (done, total) => setProgress({ done, total }));
      if (outputs.length) releaseOutputs(outputs);
      setOutputs(next);
      setOptimizing({});
      setOptimizeMeta({});
    } catch (e) {
      setSliceError(e instanceof Error ? e.message : "Не вдалося нарізати зображення");
    } finally {
      setSlicing(false);
    }
  }

  async function handleOptimize(index: number) {
    const target = outputs.find((o) => o.index === index);
    if (!target) return;
    setOptimizing((prev) => ({ ...prev, [index]: true }));
    try {
      const result = await optimizeGif(target.blob);
      const nextUrl = URL.createObjectURL(result.blob);
      URL.revokeObjectURL(target.url);
      setOutputs((prev) =>
        prev.map((o) =>
          o.index === index ? { ...o, blob: result.blob, bytes: result.bytes, url: nextUrl } : o,
        ),
      );
      setOptimizeMeta((prev) => ({
        ...prev,
        [index]: { label: result.applied?.label ?? null, fits: result.fits },
      }));
    } finally {
      setOptimizing((prev) => ({ ...prev, [index]: false }));
    }
  }

  function handleDownloadAll() {
    outputs.forEach((output, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = output.url;
        a.download = output.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 150);
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#c7d5e0]">SProfile Editor</h1>
        <p className="text-sm text-[#8f98a0]">
          Нарізає GIF, PNG або JPG на слоти Steam showcase — з превʼю того, як це виглядатиме на
          профілі.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4">
          <UploadZone onFile={handleFile} error={sourceError} fileName={source?.file.name} />
          <ControlsPanel
            spec={spec}
            showcaseId={showcaseId}
            onShowcaseChange={handleShowcaseChange}
            sections={sections}
            onSectionsChange={(n) => setSections(Number.isFinite(n) ? n : 1)}
            rowHeight={rowHeight}
            onRowHeightChange={(n) => setRowHeight(Number.isFinite(n) ? n : 1)}
            framing={framing}
            onFramingChange={setFraming}
            scale={scale}
            onScaleChange={setScale}
            disabled={!source}
          />
          <HelpBlurb />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-[#2a3f5a] bg-[#171a21] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#66c0f4]">
              Превʼю вітрини
            </h2>
            {source && plan ? (
              <ShowcasePreview source={source} plan={plan} />
            ) : (
              <p className="py-12 text-center text-sm text-[#8f98a0]">
                Завантаж зображення щоб побачити превʼю
              </p>
            )}
          </div>

          {plan && source && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSlice}
                  disabled={slicing}
                  className="rounded bg-[#66c0f4] px-4 py-2 text-sm font-semibold text-[#0e141b] hover:bg-[#8ad4ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {slicing ? "Нарізаємо…" : "Нарізати"}
                </button>
                {slicing && progress && (
                  <span className="text-xs text-[#8f98a0]">
                    {progress.done}/{progress.total}
                  </span>
                )}
                {sliceError && <span className="text-xs text-[#f4a0a0]">{sliceError}</span>}
              </div>

              <SliceResults
                outputs={outputs}
                plan={plan}
                sourceKind={source.kind}
                optimizing={optimizing}
                optimizeMeta={optimizeMeta}
                onOptimize={handleOptimize}
                onDownloadAll={handleDownloadAll}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
