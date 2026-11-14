"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Failure } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import type { OptimizeProgress, OptimizeSettings } from "@/lib/optimize/settings";
import { FILE_LIMIT_BYTES, type ShowcaseId } from "@/lib/steam/showcases";
import type { SliceFile, SourceImage } from "@/lib/types";
import OptimizerPanel from "./OptimizerPanel";
import { ACCEPT_IMAGES } from "./UploadZone";
import { primaryButtonClass, secondaryButtonClass } from "./ui";

interface PanelDialogProps {
  index: number;
  /** 0-based panel the slot belongs to. */
  panel: number;
  /** Showcase type of that panel. */
  panelType: ShowcaseId;
  onPanelTypeChange: (type: ShowcaseId) => void;
  /** The slot's current file; null while it's being cut or if there's nothing to cut. */
  file: SliceFile | null;
  /** User's own file covering this slot's panel, if any. */
  override: SourceImage | undefined;
  /** The panel's picture is the own file or an edited composition, not the background. */
  customSource: boolean;
  /** The panel editor is open instead of the slot view. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** The editor UI, shown while `editing`. */
  editor: ReactNode;
  /** A composition is still rendering; "Done" waits for it. */
  rendering: boolean;
  /** The slot lies completely outside the background. */
  outsideBackground: boolean;
  slicing: boolean;
  /** Width of the panel's row of slots (gaps included), CSS px. */
  stripWidth: number;
  uploadError: Failure | null;
  onUpload: (file: File) => void;
  onResetToBackground: () => void;
  /** Files of the same kind, for "apply to all". */
  sameKindCount: number;
  optimizeSettings: OptimizeSettings;
  onOptimizeSettingsChange: (settings: OptimizeSettings) => void;
  /** Optimizer progress for this file; undefined = idle. */
  optimizing: OptimizeProgress | "queued" | undefined;
  onOptimize: () => void;
  onOptimizeAll: () => void;
  onRevert: () => void;
  onClose: () => void;
}

/** One slot: what's in it, your own file instead, download, squeeze. Mounted = open. */
export default function PanelDialog(props: PanelDialogProps) {
  const { index, file, customSource, outsideBackground, slicing, editing, onClose } = props;
  const { m } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // The file shown may still be the previous content while the slot is re-cut.
  const pending = slicing && (!file || file.custom !== customSource);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click that lands on the dialog element itself (not its content) is a backdrop click.
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className={`m-auto rounded-md border border-line bg-panel p-0 text-foreground backdrop:bg-black/70 ${
        editing ? "w-[min(1320px,calc(100vw-2rem))]" : "w-[min(960px,calc(100vw-2rem))]"
      }`}
    >
      <div className="flex max-h-[calc(100vh-4rem)] flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {editing ? (
              m.editor.editing(props.panel + 1)
            ) : (
              <>
                {m.slot.name(index + 1)}
                {file && (
                  <span className="font-normal text-muted">
                    {" "}
                    · {file.filename} · {file.width}×{file.height}
                  </span>
                )}
              </>
            )}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {editing ? (
              <button
                type="button"
                disabled={props.rendering}
                onClick={() => props.onEditingChange(false)}
                className={`${primaryButtonClass} px-4 py-1.5 text-sm`}
              >
                {m.editor.done}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => props.onEditingChange(true)}
                className={`${secondaryButtonClass} px-3 py-1.5 text-sm`}
              >
                ✎ {m.editor.edit}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={m.dialog.close}
            className="rounded px-2 text-xl leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        {editing ? (
          props.editor
        ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) props.onUpload(dropped);
            }}
            className={`relative flex min-h-40 items-center justify-center rounded bg-ink p-2 [background-image:repeating-conic-gradient(#ffffff0d_0_25%,transparent_0_50%)] [background-size:16px_16px] ${
              dragOver ? "ring-2 ring-accent" : ""
            }`}
          >
            {file ? (
              /* Blob URLs: next/image can't optimize them anyway. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={file.url}
                alt={m.slot.name(index + 1)}
                className={`max-h-[60vh] max-w-full object-contain ${pending ? "opacity-40" : ""}`}
              />
            ) : (
              <p className="px-6 text-center text-sm text-muted">
                {pending ? m.dialog.slicing : outsideBackground ? m.dialog.outsideEmpty : m.dialog.noFile}
              </p>
            )}
            {file && pending && (
              <span className="absolute rounded bg-black/70 px-3 py-1.5 text-sm">
                {m.dialog.slicing}
              </span>
            )}
          </div>

          {/* Everything but the image preview is covered while the file is being optimized. */}
          <div className="relative flex flex-col gap-4">
            <PanelLayout {...props} />
            <ContentSource {...props} />
            {file && !pending && <FileDetails {...props} file={file} />}
            {props.optimizing !== undefined && <ProgressOverlay progress={props.optimizing} />}
          </div>
        </div>
        )}
      </div>
    </dialog>
  );
}

const LAYOUTS: ReadonlyArray<{ id: ShowcaseId; key: "layoutSingle" | "layoutSplit" }> = [
  { id: "featured", key: "layoutSingle" },
  { id: "artwork", key: "layoutSplit" },
];

/** Switch this one panel between a single 630px slot and the 506 + 100 split. */
function PanelLayout({ panel, panelType, onPanelTypeChange }: PanelDialogProps) {
  const { m } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
        {m.dialog.panelLayout}
      </h3>
      <div className="flex overflow-hidden rounded border border-line text-sm" role="radiogroup">
        {LAYOUTS.map(({ id, key }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={panelType === id}
            onClick={() => onPanelTypeChange(id)}
            className={`flex-1 px-3 py-1.5 ${
              panelType === id
                ? "bg-accent font-semibold text-ink"
                : "bg-background text-foreground hover:bg-line"
            }`}
          >
            {m.dialog[key]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{m.dialog.layoutHint(panel + 1)}</p>
    </div>
  );
}

/** Where the slot's picture comes from: the background, or the user's own file. */
function ContentSource({
  override,
  stripWidth,
  uploadError,
  onUpload,
  onResetToBackground,
}: PanelDialogProps) {
  const { m, failure } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
        {m.dialog.contentTitle}
      </h3>
      <p className="text-sm">
        {override ? (
          <>
            {m.dialog.ownFile} <span className="text-muted">{override.file.name}</span>
          </>
        ) : (
          m.dialog.backgroundPiece
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`${primaryButtonClass} px-3 py-2 text-sm`}
        >
          {override ? m.dialog.replace : m.dialog.upload}
        </button>
        {override && (
          <button
            type="button"
            onClick={onResetToBackground}
            className={`${secondaryButtonClass} px-3 py-2 text-sm`}
          >
            {m.dialog.resetToBackground}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onUpload(picked);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted">{m.dialog.uploadHint(stripWidth)}</p>
      {uploadError && <p className="text-xs text-danger">{failure(uploadError)}</p>}
    </div>
  );
}

function FileDetails({
  file,
  sameKindCount,
  optimizeSettings,
  onOptimizeSettingsChange,
  optimizing,
  onOptimize,
  onOptimizeAll,
  onRevert,
}: PanelDialogProps & { file: SliceFile }) {
  const { m, bytes, step } = useI18n();
  const size = file.blob.size;
  const oversize = size > FILE_LIMIT_BYTES;
  const changed = file.blob !== file.original;
  const busy = optimizing !== undefined;
  const summary = file.optimized;

  return (
    <>
      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm">
        <p>
          {changed && (
            <>
              <span className="text-muted line-through">{bytes(file.original.size)}</span>
              {" → "}
            </>
          )}
          <span className={oversize ? "text-warn" : changed ? "text-ok" : ""}>{bytes(size)}</span>
          {changed && (
            <span className="text-muted">
              {" "}
              (−{Math.round((1 - size / file.original.size) * 100)}%)
            </span>
          )}
        </p>
        {oversize && <p className="text-xs text-warn">{m.dialog.oversize(bytes(FILE_LIMIT_BYTES))}</p>}
        {!busy &&
          summary && (
            <p className="text-xs text-muted">
              {summary.label
                ? m.dialog.applied(step(summary.label))
                : summary.fits
                  ? m.dialog.alreadyFits
                  : m.dialog.couldNotShrink}
              {" · "}
              {summary.fits
                ? m.dialog.fits(bytes(summary.targetBytes))
                : m.dialog.doesNotFit(bytes(summary.targetBytes))}
            </p>
          )}
        <div className="mt-2 flex gap-2">
          <a
            href={file.url}
            download={file.filename}
            className={`${secondaryButtonClass} flex-1 px-3 py-2 text-center text-sm`}
          >
            {m.dialog.download}
          </a>
          {changed && !busy && (
            <button
              type="button"
              onClick={onRevert}
              title={m.dialog.undoCompressionTitle}
              className={`${secondaryButtonClass} px-3 py-2 text-sm`}
            >
              {m.dialog.undoCompression}
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          {file.kind === "gif" ? m.dialog.gifOptimizer : m.dialog.imageOptimizer}
        </h3>
        <OptimizerPanel
          kind={file.kind}
          settings={optimizeSettings}
          onChange={onOptimizeSettingsChange}
          busy={busy}
          onOptimize={onOptimize}
          allCount={sameKindCount}
          onOptimizeAll={onOptimizeAll}
        />
      </div>
    </>
  );
}

/**
 * Dimmed cover with a progress bar. Percent counts finished encoding passes
 * against the most passes the search can still need, so it never goes back;
 * inside a single pass gifsicle reports nothing, hence the spinner.
 */
function ProgressOverlay({ progress }: { progress: OptimizeProgress | "queued" }) {
  const { m, progress: describe } = useI18n();
  const view = describe(progress);
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute -inset-2 z-10 flex justify-center rounded bg-black/80 px-6 backdrop-blur-[2px]"
    >
      <div className="sticky top-6 flex h-fit w-full max-w-72 flex-col items-center gap-3 pt-10 text-center">
        <span
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
        />
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {m.optimizer.progress.title} · {view.percent}%
        </p>
        <div
          className="h-2 w-full overflow-hidden rounded bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.percent}
        >
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${view.percent}%` }}
          />
        </div>
        <p className="text-sm text-foreground">{view.stage}</p>
        {view.detail && <p className="text-xs text-muted">{view.detail}</p>}
        {view.pass && <p className="text-xs text-muted">{view.pass}</p>}
      </div>
    </div>
  );
}
