"use client";

import { formatBytes } from "@/lib/format";
import { FILE_LIMIT_BYTES } from "@/lib/steam/showcases";
import type { SliceFile } from "@/lib/types";
import { SectionTitle, primaryButtonClass, secondaryButtonClass } from "./ui";

interface SliceResultsProps {
  files: SliceFile[];
  /** Settings changed since these files were cut. */
  stale: boolean;
  /** index → current optimizer step, for files being optimized right now. */
  optimizing: Record<number, string>;
  onOptimize: (index: number) => void;
  onRevert: (index: number) => void;
}

/** Trigger a browser download for each file. Staggered: browsers drop simultaneous ones. */
function downloadAll(files: SliceFile[]) {
  files.forEach((file, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = file.url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 150);
  });
}

export default function SliceResults({
  files,
  stale,
  optimizing,
  onOptimize,
  onRevert,
}: SliceResultsProps) {
  if (files.length === 0) return null;
  const totalBytes = files.reduce((sum, f) => sum + f.blob.size, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <SectionTitle>Результат</SectionTitle>
          <span className="text-xs text-muted">
            {files.length} файл(ів) · {formatBytes(totalBytes)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => downloadAll(files)}
          className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
        >
          Скачати все
        </button>
      </div>

      {stale && (
        <p className="rounded bg-warn-bg px-3 py-2 text-xs text-warn">
          Налаштування змінились після нарізки — ці файли відповідають попереднім. Натисни
          «Нарізати», щоб оновити.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {files.map((file) => (
          <SliceCard
            key={file.index}
            file={file}
            optimizingStep={optimizing[file.index]}
            onOptimize={() => onOptimize(file.index)}
            onRevert={() => onRevert(file.index)}
          />
        ))}
      </div>
    </div>
  );
}

function SliceCard({
  file,
  optimizingStep,
  onOptimize,
  onRevert,
}: {
  file: SliceFile;
  optimizingStep: string | undefined;
  onOptimize: () => void;
  onRevert: () => void;
}) {
  const bytes = file.blob.size;
  const oversize = bytes > FILE_LIMIT_BYTES;
  const busy = optimizingStep !== undefined;
  const changed = file.blob !== file.original;
  const saved = changed ? Math.round((1 - bytes / file.original.size) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-panel p-2">
      <div
        className="w-full rounded-sm bg-ink"
        style={{
          backgroundImage: `url(${file.url})`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          aspectRatio: `${file.width} / ${file.height}`,
        }}
      />
      <p className="truncate text-xs text-foreground">
        {file.filename}{" "}
        <span className="text-muted">
          {file.width}×{file.height}
        </span>
      </p>
      <p className="text-xs text-muted">
        {changed && (
          <>
            <span className="line-through">{formatBytes(file.original.size)}</span>
            {" → "}
          </>
        )}
        <span className={oversize ? "text-warn" : changed ? "text-ok" : ""}>
          {formatBytes(bytes)}
        </span>
        {changed && ` (−${saved}%)`}
      </p>

      {oversize && (
        <p className="rounded bg-warn-bg px-2 py-1 text-[11px] text-warn">
          Перевищує ліміт Steam {formatBytes(FILE_LIMIT_BYTES)}
          {file.kind === "static" && " — зменш висоту секції або масштаб експорту"}
        </p>
      )}

      {busy ? (
        <p className="text-[11px] text-muted">Пробуємо: {optimizingStep}…</p>
      ) : (
        file.optimized && (
          <p className="text-[11px] text-muted">
            {file.optimized.label
              ? `Застосовано: ${file.optimized.label}`
              : "Меншим зробити не вийшло"}
            {" · "}
            {file.optimized.fits
              ? `вкладається в ${formatBytes(file.optimized.targetBytes)}`
              : `не вкладається в ${formatBytes(file.optimized.targetBytes)}`}
          </p>
        )
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <a
          href={file.url}
          download={file.filename}
          className={`${secondaryButtonClass} flex-1 px-2 py-1 text-center text-xs`}
        >
          Скачати
        </a>
        {file.kind === "gif" && (
          <button
            type="button"
            disabled={busy}
            onClick={onOptimize}
            className={`${primaryButtonClass} flex-1 px-2 py-1 text-xs`}
          >
            {busy ? "Оптимізація…" : "Оптимізувати"}
          </button>
        )}
        {changed && !busy && (
          <button
            type="button"
            onClick={onRevert}
            title="Повернути файл як після нарізки"
            className={`${secondaryButtonClass} px-2 py-1 text-xs`}
          >
            Скинути
          </button>
        )}
      </div>
    </div>
  );
}
