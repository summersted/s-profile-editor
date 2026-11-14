"use client";

import type { Framing } from "@/lib/types";
import { SHOWCASES, type ShowcaseSpec } from "@/lib/steam/showcases";

type ShowcaseId = ShowcaseSpec["id"];

interface ControlsPanelProps {
  spec: ShowcaseSpec;
  showcaseId: ShowcaseId;
  onShowcaseChange: (id: ShowcaseId) => void;
  sections: number;
  onSectionsChange: (n: number) => void;
  rowHeight: number;
  onRowHeightChange: (n: number) => void;
  framing: Framing;
  onFramingChange: (framing: Framing) => void;
  scale: 1 | 2;
  onScaleChange: (scale: 1 | 2) => void;
  disabled?: boolean;
}

export default function ControlsPanel({
  spec,
  showcaseId,
  onShowcaseChange,
  sections,
  onSectionsChange,
  rowHeight,
  onRowHeightChange,
  framing,
  onFramingChange,
  scale,
  onScaleChange,
  disabled,
}: ControlsPanelProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-md border border-[#2a3f5a] bg-[#16202d] p-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#66c0f4]">
        Налаштування
      </h2>

      <label className="flex flex-col gap-1 text-sm text-[#c7d5e0]">
        Тип showcase
        <select
          disabled={disabled}
          value={showcaseId}
          onChange={(e) => onShowcaseChange(e.target.value as ShowcaseId)}
          className="rounded border border-[#2a3f5a] bg-[#1b2838] px-2 py-1.5 text-[#c7d5e0] outline-none focus:border-[#66c0f4]"
        >
          {Object.values(SHOWCASES).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-[#c7d5e0]">
          Секцій
          <input
            disabled={disabled}
            type="number"
            min={1}
            max={spec.maxSections}
            value={sections}
            onChange={(e) => onSectionsChange(Number(e.target.value))}
            className="rounded border border-[#2a3f5a] bg-[#1b2838] px-2 py-1.5 text-[#c7d5e0] outline-none focus:border-[#66c0f4]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[#c7d5e0]">
          Висота секції, px
          <input
            disabled={disabled}
            type="number"
            min={50}
            max={700}
            value={rowHeight}
            onChange={(e) => onRowHeightChange(Number(e.target.value))}
            className="rounded border border-[#2a3f5a] bg-[#1b2838] px-2 py-1.5 text-[#c7d5e0] outline-none focus:border-[#66c0f4]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#2a3f5a] pt-3">
        <RangeField
          label="Зум"
          disabled={disabled}
          min={1}
          max={3}
          step={0.01}
          value={framing.zoom}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(zoom) => onFramingChange({ ...framing, zoom })}
        />
        <RangeField
          label="Зсув по X"
          disabled={disabled}
          min={0}
          max={1}
          step={0.01}
          value={framing.panX}
          format={(v) => v.toFixed(2)}
          onChange={(panX) => onFramingChange({ ...framing, panX })}
        />
        <RangeField
          label="Зсув по Y"
          disabled={disabled}
          min={0}
          max={1}
          step={0.01}
          value={framing.panY}
          format={(v) => v.toFixed(2)}
          onChange={(panY) => onFramingChange({ ...framing, panY })}
        />
        <p className="text-xs text-[#8f98a0]">
          Зсув має сенс лише коли зум більше 1x або коли пропорції зображення не збігаються зі
          смугою showcase.
        </p>
      </div>

      <label className="flex flex-col gap-1 border-t border-[#2a3f5a] pt-3 text-sm text-[#c7d5e0]">
        Масштаб експорту
        <select
          disabled={disabled}
          value={scale}
          onChange={(e) => onScaleChange(Number(e.target.value) === 2 ? 2 : 1)}
          className="rounded border border-[#2a3f5a] bg-[#1b2838] px-2 py-1.5 text-[#c7d5e0] outline-none focus:border-[#66c0f4]"
        >
          <option value={1}>1x</option>
          <option value={2}>2x (HiDPI)</option>
        </select>
      </label>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-[#c7d5e0]">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[#8f98a0]">{format(value)}</span>
      </span>
      <input
        disabled={disabled}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="steam-range"
      />
    </label>
  );
}
