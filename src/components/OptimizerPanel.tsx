"use client";

import { useI18n } from "@/lib/i18n";
import {
  COLOR_OPTIONS,
  FRAME_STEP_OPTIONS,
  JPEG_QUALITY_RANGE,
  LOSSY_RANGE,
  SCALE_OPTIONS,
  type OptimizeMode,
  type OptimizeSettings,
  type OptimizeStep,
} from "@/lib/optimize/settings";
import type { SourceKind } from "@/lib/types";
import {
  CheckField,
  InfoTip,
  NumberField,
  RangeField,
  SelectField,
  TipLabel,
  primaryButtonClass,
  secondaryButtonClass,
} from "./ui";

interface OptimizerPanelProps {
  /** Which file type the controls are for. Settings for both live in one object. */
  kind: SourceKind;
  settings: OptimizeSettings;
  onChange: (settings: OptimizeSettings) => void;
  busy: boolean;
  onOptimize: () => void;
  /** How many files "apply to all" would process; the button hides when ≤ 1. */
  allCount: number;
  onOptimizeAll: () => void;
}

const MB = 1024 * 1024;
const MODES: readonly OptimizeMode[] = ["auto", "manual"];

/** Configurator for the slot optimizer: what to aim for and what it may sacrifice. */
export default function OptimizerPanel({
  kind,
  settings,
  onChange,
  busy,
  onOptimize,
  allCount,
  onOptimizeAll,
}: OptimizerPanelProps) {
  const { m } = useI18n();
  const o = m.optimizer;
  const set = (patch: Partial<OptimizeSettings>) => onChange({ ...settings, ...patch });
  const setAuto = (patch: Partial<OptimizeSettings["auto"]>) =>
    set({ auto: { ...settings.auto, ...patch } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex overflow-hidden rounded border border-line text-sm" role="radiogroup">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={settings.mode === mode}
              onClick={() => set({ mode })}
              className={`px-3 py-1.5 ${
                settings.mode === mode
                  ? "bg-accent font-semibold text-ink"
                  : "bg-background text-foreground hover:bg-line"
              }`}
            >
              {m.optimizer[mode]}
            </button>
          ))}
        </div>
        <span className="self-center">
          <InfoTip text={o.tips.mode} label={o.moreInfo} />
        </span>
        <div className="w-36">
          <NumberField
            label={
              <TipLabel tip={o.tips.limit} tipLabel={o.moreInfo}>
                {o.limitMb}
              </TipLabel>
            }
            min={0.1}
            max={20}
            step={0.1}
            value={Number((settings.targetBytes / MB).toFixed(1))}
            onChange={(mb) => set({ targetBytes: Math.round(mb * MB) })}
          />
        </div>
      </div>

      {kind === "gif" ? (
        <GifControls settings={settings} set={set} setAuto={setAuto} />
      ) : (
        <ImageControls settings={settings} set={set} setAuto={setAuto} />
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onOptimize}
          className={`${primaryButtonClass} px-4 py-2 text-sm`}
        >
          {busy ? m.optimizer.optimizing : m.optimizer.optimize}
        </button>
        {allCount > 1 && (
          <button
            type="button"
            disabled={busy}
            onClick={onOptimizeAll}
            className={`${secondaryButtonClass} px-4 py-2 text-sm`}
          >
            {m.optimizer.applyAll(allCount)}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{m.optimizer.restartNote}</p>
    </div>
  );
}

type ControlsProps = {
  settings: OptimizeSettings;
  set: (patch: Partial<OptimizeSettings>) => void;
  setAuto: (patch: Partial<OptimizeSettings["auto"]>) => void;
};

function GifControls({ settings, set, setAuto }: ControlsProps) {
  const { m, step } = useI18n();
  const o = m.optimizer;
  const { auto, manual } = settings;
  const setManual = (patch: Partial<OptimizeStep>) => set({ manual: { ...manual, ...patch } });

  if (settings.mode === "auto") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">{o.gifAutoHint}</p>
        <CheckField
          label={<TipLabel tip={o.tips.lossy} tipLabel={o.moreInfo}>{o.lossy}</TipLabel>}
          hint={o.lossyHint}
          checked={auto.lossy}
          onChange={(lossy) => setAuto({ lossy })}
        />
        <CheckField
          label={<TipLabel tip={o.tips.palette} tipLabel={o.moreInfo}>{o.palette}</TipLabel>}
          hint={o.paletteHint}
          checked={auto.colors}
          onChange={(colors) => setAuto({ colors })}
        />
        <CheckField
          label={<TipLabel tip={o.tips.dropFrames} tipLabel={o.moreInfo}>{o.dropFrames}</TipLabel>}
          hint={o.dropFramesHint}
          checked={auto.fps}
          onChange={(fps) => setAuto({ fps })}
        />
        {!auto.lossy && !auto.colors && !auto.fps && (
          <p className="text-xs text-warn">{o.nothingAllowed}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <RangeField
        label={<TipLabel tip={o.tips.lossyLevel} tipLabel={o.moreInfo}>{o.lossyLabel}</TipLabel>}
        min={LOSSY_RANGE.min}
        max={LOSSY_RANGE.max}
        step={LOSSY_RANGE.step}
        value={manual.lossy}
        format={(v) => (v === 0 ? o.off : String(v))}
        onChange={(lossy) => setManual({ lossy })}
      />
      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label={<TipLabel tip={o.tips.colors} tipLabel={o.moreInfo}>{o.colors}</TipLabel>}
          value={manual.colors}
          options={COLOR_OPTIONS.map((c) => ({ value: c, label: c === 256 ? o.untouched : String(c) }))}
          onChange={(colors) => setManual({ colors })}
        />
        <SelectField
          label={<TipLabel tip={o.tips.frames} tipLabel={o.moreInfo}>{o.frames}</TipLabel>}
          value={manual.frameStep}
          options={FRAME_STEP_OPTIONS.map((n) => ({
            value: n,
            label: n === 1 ? o.allFrames : o.everyNth(n),
          }))}
          onChange={(frameStep) => setManual({ frameStep })}
        />
        <SelectField
          label={<TipLabel tip={o.tips.resolution} tipLabel={o.moreInfo}>{o.resolution}</TipLabel>}
          value={manual.scale}
          options={SCALE_OPTIONS.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }))}
          onChange={(scale) => setManual({ scale })}
        />
      </div>
      <p className="text-xs text-muted">
        {o.manualExact(step({ type: "gif", step: manual }))}
        {manual.scale < 1 && o.lowResNote}
      </p>
    </div>
  );
}

function ImageControls({ settings, set, setAuto }: ControlsProps) {
  const { m, step } = useI18n();
  const o = m.optimizer;
  const { image } = settings;

  if (settings.mode === "auto") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">{o.imageAutoHint}</p>
        <CheckField
          label={<TipLabel tip={o.tips.allowJpeg} tipLabel={o.moreInfo}>{o.allowJpeg}</TipLabel>}
          hint={o.allowJpegHint}
          checked={settings.auto.jpeg}
          onChange={(jpeg) => setAuto({ jpeg })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={<TipLabel tip={o.tips.format} tipLabel={o.moreInfo}>{o.format}</TipLabel>}
        value={image.format}
        options={[
          { value: "jpeg" as const, label: "JPEG" },
          { value: "png" as const, label: o.pngUnchanged },
        ]}
        onChange={(format) => set({ image: { ...image, format } })}
      />
      {image.format === "jpeg" && (
        <RangeField
          label={<TipLabel tip={o.tips.jpegQuality} tipLabel={o.moreInfo}>{o.jpegQuality}</TipLabel>}
          min={JPEG_QUALITY_RANGE.min}
          max={JPEG_QUALITY_RANGE.max}
          step={JPEG_QUALITY_RANGE.step}
          value={image.quality}
          format={(quality) => step({ type: "jpeg", quality })}
          onChange={(quality) => set({ image: { ...image, quality } })}
        />
      )}
    </div>
  );
}
