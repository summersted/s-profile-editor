"use client";

import { useState, type ReactNode } from "react";

/** Shared look of text inputs and selects. */
export const inputClass =
  "rounded border border-line bg-background px-2 py-1.5 text-foreground outline-none focus:border-accent disabled:cursor-not-allowed";

export const primaryButtonClass =
  "rounded bg-accent font-semibold text-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded bg-line font-medium text-foreground hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{children}</h2>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-foreground">
      {label}
      {children}
    </label>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Number input that tolerates half-typed values. While the user is editing,
 * the raw text is kept locally; the parent only ever receives valid numbers
 * inside [min, max], and the field snaps back to the real value on blur.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  /** Also the precision values are rounded to. */
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const parse = (text: string): number | null => {
    const n = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(n)) return null;
    // Round to the step grid, then strip float noise like 0.30000000000000004.
    return Number((Math.round(n / step) * step).toFixed(6));
  };

  return (
    <Field label={label}>
      <input
        disabled={disabled}
        type="number"
        inputMode={step < 1 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value);
          // Out-of-range input is usually a number still being typed ("2" on the way to "200").
          if (n !== null && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          const n = draft === null ? null : parse(draft);
          if (n !== null) onChange(clamp(n, min, max));
          setDraft(null);
        }}
        className={inputClass}
      />
    </Field>
  );
}

export function RangeField({
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
    <label className="flex flex-col gap-1 text-sm text-foreground">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-muted">{format(value)}</span>
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

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: ReactNode;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <select
        disabled={disabled}
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent"
      />
      <span className="flex flex-col">
        {label}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
