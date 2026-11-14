"use client";

import { useI18n } from "@/lib/i18n";
import { DEFAULT_LAYOUT, LAYOUT_LIMITS, type ProfileLayout } from "@/lib/steam/profile";
import {
  EXTRA_SHOWCASE_POINTS,
  MAX_PANELS,
  ROW_HEIGHT,
  SHOWCASE_LIST,
  type ShowcaseId,
} from "@/lib/steam/showcases";
import { NumberField, SectionTitle, SelectField, secondaryButtonClass } from "./ui";

/** Everything the user can tweak about the profile layout. */
export interface SliceSettings {
  showcaseId: ShowcaseId;
  sections: number;
  /** Artwork height of panels without their own height. */
  rowHeight: number;
  /**
   * Panel index → its own artwork height, set when a custom file is put in.
   * Kept across showcase type changes on purpose: the panel keeps its size.
   */
  panelHeights: Readonly<Record<number, number>>;
  /** Panel index → its own showcase type; panels not listed use `showcaseId`. */
  panelTypes: Readonly<Record<number, ShowcaseId>>;
  layout: ProfileLayout;
}

interface ControlsPanelProps {
  settings: SliceSettings;
  /** Panels per showcase type in the current plan. */
  usage: Record<ShowcaseId, number>;
  onChange: (patch: Partial<SliceSettings>) => void;
}

const LAYOUT_KEYS = ["headerHeight", "leftColX", "panelHeader", "panelGap"] as const satisfies ReadonlyArray<
  keyof ProfileLayout
>;

export default function ControlsPanel({ settings, usage, onChange }: ControlsPanelProps) {
  const { m } = useI18n();
  const over = SHOWCASE_LIST.filter((s) => usage[s.id] > s.maxPerProfile);
  const needsExtra = SHOWCASE_LIST.some((s) => usage[s.id] > 1);
  const { layout } = settings;
  const layoutChanged = LAYOUT_KEYS.some((key) => layout[key] !== DEFAULT_LAYOUT[key]);
  const customHeights = Object.keys(settings.panelHeights).filter(
    (i) => Number(i) < settings.sections,
  ).length;
  const customLayouts = Object.entries(settings.panelTypes).filter(
    ([i, type]) => Number(i) < settings.sections && type !== settings.showcaseId,
  ).length;

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4">
      <SectionTitle>{m.controls.title}</SectionTitle>

      <SelectField
        label={m.controls.showcaseType}
        value={settings.showcaseId}
        options={SHOWCASE_LIST.map((s) => ({ value: s.id, label: m.showcases[s.id].option }))}
        onChange={(showcaseId) =>
          onChange({
            showcaseId,
            // A panel whose own type now equals the common one is no longer special.
            panelTypes: Object.fromEntries(
              Object.entries(settings.panelTypes).filter(([, type]) => type !== showcaseId),
            ),
          })
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={m.controls.count}
          min={1}
          max={MAX_PANELS}
          value={settings.sections}
          onChange={(sections) => onChange({ sections })}
        />
        <NumberField
          label={m.controls.height}
          min={ROW_HEIGHT.min}
          max={ROW_HEIGHT.max}
          value={settings.rowHeight}
          onChange={(rowHeight) => onChange({ rowHeight })}
        />
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-muted">
          {SHOWCASE_LIST.map((s) => (
            <span key={s.id} className={usage[s.id] > s.maxPerProfile ? "text-warn" : ""}>
              {m.controls.usage(m.showcases[s.id].short, usage[s.id], s.maxPerProfile)}
              {s.id !== SHOWCASE_LIST.at(-1)?.id && " · "}
            </span>
          ))}
        </p>
        {over.map((s) => (
          <p key={s.id} className="rounded bg-warn-bg px-2 py-1 text-warn">
            {m.controls.overLimit(m.showcases[s.id].short, s.maxPerProfile)}
          </p>
        ))}
        {needsExtra && over.length === 0 && (
          <p className="text-muted">{m.controls.extraNeeded(EXTRA_SHOWCASE_POINTS)}</p>
        )}
      </div>

      {customHeights > 0 && (
        <div className="flex flex-col gap-2 text-xs text-muted">
          <p>{m.controls.customHeights(customHeights)}</p>
          <button
            type="button"
            onClick={() => onChange({ panelHeights: {} })}
            className={`${secondaryButtonClass} self-start px-3 py-1.5 text-xs`}
          >
            {m.controls.resetHeights}
          </button>
        </div>
      )}

      {customLayouts > 0 && (
        <div className="flex flex-col gap-2 text-xs text-muted">
          <p>{m.controls.customLayouts(customLayouts)}</p>
          <button
            type="button"
            onClick={() => onChange({ panelTypes: {} })}
            className={`${secondaryButtonClass} self-start px-3 py-1.5 text-xs`}
          >
            {m.controls.resetLayouts}
          </button>
        </div>
      )}

      <details className="border-t border-line pt-3 text-sm">
        <summary className="cursor-pointer select-none text-foreground">
          {m.controls.calibration}
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-muted">{m.controls.calibrationHint}</p>
          <div className="grid grid-cols-2 gap-3">
            {LAYOUT_KEYS.map((key) => (
              <NumberField
                key={key}
                label={m.controls[key]}
                min={LAYOUT_LIMITS[key].min}
                max={LAYOUT_LIMITS[key].max}
                value={layout[key]}
                onChange={(v) => onChange({ layout: { ...layout, [key]: v } })}
              />
            ))}
          </div>
          {layoutChanged && (
            <button
              type="button"
              onClick={() => onChange({ layout: DEFAULT_LAYOUT })}
              className={`${secondaryButtonClass} self-start px-3 py-1.5 text-xs`}
            >
              {m.controls.resetDefaults}
            </button>
          )}
        </div>
      </details>
    </div>
  );
}
