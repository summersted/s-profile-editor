"use client";

import type { SliceOutput, SlicePlan, SourceKind } from "@/lib/types";
import { FILE_LIMIT_BYTES } from "@/lib/steam/showcases";

export interface OptimizeMeta {
  label: string | null;
  fits: boolean;
}

interface SliceResultsProps {
  outputs: SliceOutput[];
  plan: SlicePlan;
  sourceKind: SourceKind;
  optimizing: Record<number, boolean>;
  optimizeMeta: Record<number, OptimizeMeta>;
  onOptimize: (index: number) => void;
  onDownloadAll: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

export default function SliceResults({
  outputs,
  plan,
  sourceKind,
  optimizing,
  optimizeMeta,
  onOptimize,
  onDownloadAll,
}: SliceResultsProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#66c0f4]">
          Результат
        </h2>
        <button
          type="button"
          onClick={onDownloadAll}
          className="rounded bg-[#2a3f5a] px-3 py-1.5 text-xs font-medium text-[#c7d5e0] hover:bg-[#35506f]"
        >
          Скачати все
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {outputs.map((output) => {
          const planned = plan.slices.find((s) => s.index === output.index);
          const meta = optimizeMeta[output.index];
          const isOversize = output.bytes > FILE_LIMIT_BYTES;
          const canOptimize = sourceKind === "gif" && isOversize;
          return (
            <div
              key={output.index}
              className="flex flex-col gap-2 rounded-md border border-[#2a3f5a] bg-[#16202d] p-2"
            >
              <div
                className="w-full rounded-sm bg-[#0e141b]"
                style={{
                  backgroundImage: `url(${output.url})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  aspectRatio: planned ? `${planned.output.w} / ${planned.output.h}` : "1 / 1",
                }}
              />
              <p className="truncate text-xs text-[#c7d5e0]">{output.filename}</p>
              <p className="text-xs text-[#8f98a0]">{formatBytes(output.bytes)}</p>

              {isOversize && (
                <p className="rounded bg-[#3a2f1f] px-2 py-1 text-[11px] text-[#f0c060]">
                  Перевищує ліміт 5 МБ
                </p>
              )}

              {meta && (
                <p className="text-[11px] text-[#8f98a0]">
                  {meta.label ? `Застосовано: ${meta.label}` : "Вже вкладається у ліміт"}
                  {" · "}
                  {meta.fits ? "вкладається" : "ще перевищує ліміт"}
                </p>
              )}

              <div className="mt-auto flex gap-2">
                <a
                  href={output.url}
                  download={output.filename}
                  className="flex-1 rounded bg-[#2a3f5a] px-2 py-1 text-center text-xs font-medium text-[#c7d5e0] hover:bg-[#35506f]"
                >
                  Скачати
                </a>
                {canOptimize && (
                  <button
                    type="button"
                    disabled={optimizing[output.index]}
                    onClick={() => onOptimize(output.index)}
                    className="flex-1 rounded bg-[#66c0f4] px-2 py-1 text-xs font-medium text-[#0e141b] hover:bg-[#8ad4ff] disabled:opacity-50"
                  >
                    {optimizing[output.index] ? "Оптимізація…" : "Оптимізувати"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
