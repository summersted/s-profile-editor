"use client";

import {
  COLOR_OPTIONS,
  FRAME_STEP_OPTIONS,
  LOSSY_RANGE,
  SCALE_OPTIONS,
  describeStep,
  type OptimizeMode,
  type OptimizeSettings,
  type OptimizeStep,
} from "@/lib/optimize/settings";
import {
  CheckField,
  NumberField,
  RangeField,
  SectionTitle,
  SelectField,
  primaryButtonClass,
} from "./ui";

interface OptimizerPanelProps {
  settings: OptimizeSettings;
  onChange: (settings: OptimizeSettings) => void;
  /** How many GIF files "optimize all" would process. */
  fileCount: number;
  busy: boolean;
  onOptimizeAll: () => void;
}

const MB = 1024 * 1024;

const MODES: ReadonlyArray<{ value: OptimizeMode; label: string }> = [
  { value: "auto", label: "Авто — вкласти в ліміт" },
  { value: "manual", label: "Вручну" },
];

const COLOR_SELECT = COLOR_OPTIONS.map((c) => ({
  value: c,
  label: c === 256 ? "не чіпати" : String(c),
}));

const FRAME_SELECT = FRAME_STEP_OPTIONS.map((n) => ({
  value: n,
  label: n === 1 ? "усі" : `кожен ${n}-й`,
}));

const SCALE_SELECT = SCALE_OPTIONS.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }));

/** Configurator for the GIF optimizer: what to aim for and what it may sacrifice. */
export default function OptimizerPanel({
  settings,
  onChange,
  fileCount,
  busy,
  onOptimizeAll,
}: OptimizerPanelProps) {
  const { auto, manual } = settings;
  const setAuto = (patch: Partial<OptimizeSettings["auto"]>) =>
    onChange({ ...settings, auto: { ...auto, ...patch } });
  const setManual = (patch: Partial<OptimizeStep>) =>
    onChange({ ...settings, manual: { ...manual, ...patch } });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
      <SectionTitle>Оптимізатор GIF</SectionTitle>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex overflow-hidden rounded border border-line text-sm" role="radiogroup">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={settings.mode === m.value}
              onClick={() => onChange({ ...settings, mode: m.value })}
              className={`px-3 py-1.5 ${
                settings.mode === m.value
                  ? "bg-accent font-semibold text-ink"
                  : "bg-background text-foreground hover:bg-line"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="w-36">
          <NumberField
            label="Ліміт файлу, МБ"
            min={0.1}
            max={20}
            step={0.1}
            value={Number((settings.targetBytes / MB).toFixed(1))}
            onChange={(mb) => onChange({ ...settings, targetBytes: Math.round(mb * MB) })}
          />
        </div>
      </div>

      {settings.mode === "auto" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            Спершу пробує стиснути без втрат. Якщо файл усе ще більший за ліміт — поступово
            додає втрати з дозволених нижче, і зупиняється на найлегшому варіанті, який
            вкладається.
          </p>
          <CheckField
            label="Lossy-стиснення"
            hint="Легкий шум у деталях; на малих значеннях майже непомітно."
            checked={auto.lossy}
            onChange={(lossy) => setAuto({ lossy })}
          />
          <CheckField
            label="Зменшення палітри"
            hint="Менше кольорів — можуть зʼявитись смуги на градієнтах."
            checked={auto.colors}
            onChange={(colors) => setAuto({ colors })}
          />
          <CheckField
            label="Проріджування кадрів"
            hint="Викидає кожен 2-й/3-й кадр; тривалість та сама, рух менш плавний."
            checked={auto.fps}
            onChange={(fps) => setAuto({ fps })}
          />
          {!auto.lossy && !auto.colors && !auto.fps && (
            <p className="text-xs text-warn">
              Нічого не дозволено — буде тільки стиснення без втрат, у ліміт може не влізти.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <RangeField
            label="Lossy"
            min={LOSSY_RANGE.min}
            max={LOSSY_RANGE.max}
            step={LOSSY_RANGE.step}
            value={manual.lossy}
            format={(v) => (v === 0 ? "вимкнено" : String(v))}
            onChange={(lossy) => setManual({ lossy })}
          />
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="Кольорів"
              value={manual.colors}
              options={COLOR_SELECT}
              onChange={(colors) => setManual({ colors })}
            />
            <SelectField
              label="Кадри"
              value={manual.frameStep}
              options={FRAME_SELECT}
              onChange={(frameStep) => setManual({ frameStep })}
            />
            <SelectField
              label="Роздільність"
              value={manual.scale}
              options={SCALE_SELECT}
              onChange={(scale) => setManual({ scale })}
            />
          </div>
          <p className="text-xs text-muted">
            Застосується рівно це: {describeStep(manual)}. Ліміт тут лише для позначки
            «вкладається / ні».
            {manual.scale < 1 &&
              " Зменшена роздільність: Steam розтягне файл до ширини слота, картинка буде мʼякша."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || fileCount === 0}
          onClick={onOptimizeAll}
          className={`${primaryButtonClass} px-4 py-2 text-sm`}
        >
          {busy ? "Оптимізуємо…" : `Оптимізувати всі (${fileCount})`}
        </button>
        <span className="text-xs text-muted">
          Кожен запуск стартує з оригінальної нарізки, тож налаштування можна міняти й
          перезапускати без накопичення втрат.
        </span>
      </div>
    </div>
  );
}
