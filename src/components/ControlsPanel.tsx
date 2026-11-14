"use client";

import type { Framing } from "@/lib/types";
import { ROW_HEIGHT, SHOWCASE_LIST, SHOWCASES, type ShowcaseId } from "@/lib/steam/showcases";
import { NumberField, RangeField, SectionTitle, SelectField } from "./ui";

export type ExportScale = 1 | 2;

/** Everything the user can tweak about how the source is cut. */
export interface SliceSettings {
  showcaseId: ShowcaseId;
  sections: number;
  rowHeight: number;
  framing: Framing;
  scale: ExportScale;
}

interface ControlsPanelProps {
  settings: SliceSettings;
  onChange: (patch: Partial<SliceSettings>) => void;
  disabled?: boolean;
}

const SHOWCASE_OPTIONS = SHOWCASE_LIST.map((s) => ({ value: s.id, label: s.name }));

const SCALE_OPTIONS: ReadonlyArray<{ value: ExportScale; label: string }> = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x (HiDPI)" },
];

const PAN_AXES = [
  { key: "panX", label: "Зсув по X" },
  { key: "panY", label: "Зсув по Y" },
] as const;

export default function ControlsPanel({ settings, onChange, disabled }: ControlsPanelProps) {
  const { framing } = settings;
  const spec = SHOWCASES[settings.showcaseId];
  const setFraming = (patch: Partial<Framing>) => onChange({ framing: { ...framing, ...patch } });

  return (
    <div
      className={`flex flex-col gap-4 rounded-md border border-line bg-panel p-4 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <SectionTitle>Налаштування</SectionTitle>

      <SelectField
        label="Тип showcase"
        disabled={disabled}
        value={settings.showcaseId}
        options={SHOWCASE_OPTIONS}
        onChange={(showcaseId) =>
          onChange({
            showcaseId,
            sections: Math.min(settings.sections, SHOWCASES[showcaseId].maxSections),
          })
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Секцій"
          disabled={disabled}
          min={1}
          max={spec.maxSections}
          value={settings.sections}
          onChange={(sections) => onChange({ sections })}
        />
        <NumberField
          label="Висота секції, px"
          disabled={disabled}
          min={ROW_HEIGHT.min}
          max={ROW_HEIGHT.max}
          value={settings.rowHeight}
          onChange={(rowHeight) => onChange({ rowHeight })}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <RangeField
          label="Зум"
          disabled={disabled}
          min={1}
          max={3}
          step={0.01}
          value={framing.zoom}
          format={(v) => `${v.toFixed(2)}x`}
          onChange={(zoom) => setFraming({ zoom })}
        />
        {PAN_AXES.map(({ key, label }) => (
          <RangeField
            key={key}
            label={label}
            disabled={disabled}
            min={0}
            max={1}
            step={0.01}
            value={framing[key]}
            format={(v) => v.toFixed(2)}
            onChange={(v) => setFraming({ [key]: v })}
          />
        ))}
        <p className="text-xs text-muted">
          Зсув має сенс лише коли зум більше 1x або коли пропорції зображення не збігаються зі
          смугою showcase.
        </p>
      </div>

      <div className="border-t border-line pt-3">
        <SelectField
          label="Масштаб експорту"
          disabled={disabled}
          value={settings.scale}
          options={SCALE_OPTIONS}
          onChange={(scale) => onChange({ scale })}
        />
      </div>
    </div>
  );
}
