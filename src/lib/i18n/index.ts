"use client";

import { useMemo, useSyncExternalStore } from "react";
import { AppError, type Failure } from "../errors";
import { formatBytes, formatSeconds } from "../format";
import type { OptimizeLabel, OptimizeProgress } from "../optimize/settings";
import en from "./en";
import nl from "./nl";
import type { Locale, Messages } from "./types";
import uk from "./uk";

export type { Locale, Messages } from "./types";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "en", label: "English" },
  { id: "uk", label: "Українська" },
  { id: "nl", label: "Nederlands" },
];

const MESSAGES: Record<Locale, Messages> = { en, uk, nl };

const STORAGE_KEY = "sprofile-editor.locale";
const listeners = new Set<() => void>();
/** Last chosen locale for this page, so a failed storage write still switches. */
let current: Locale | null = null;

function isLocale(v: unknown): v is Locale {
  return LOCALES.some((l) => l.id === v);
}

function readLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Private mode / blocked storage: just use the default.
    return DEFAULT_LOCALE;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted, but still switch for this page.
  }
  current = locale;
  for (const notify of listeners) notify();
}

/** Current UI language. Server render and hydration always use the default. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, () => current ?? readLocale(), () => DEFAULT_LOCALE);
}

/** Messages plus locale-aware formatters for the current language. */
export function useI18n() {
  const locale = useLocale();
  return useMemo(() => {
    const m = MESSAGES[locale];
    return {
      locale,
      m,
      bytes: (n: number) => formatBytes(n, locale),
      seconds: (ms: number) => formatSeconds(ms, locale),
      step: (label: OptimizeLabel | "queued") => describeLabel(m, label),
      failure: (f: Failure) => describeFailure(m, f),
      progress: (p: OptimizeProgress | "queued") => describeProgress(m, p),
    };
  }, [locale]);
}

export type I18n = ReturnType<typeof useI18n>;

function describeLabel(m: Messages, label: OptimizeLabel | "queued"): string {
  if (label === "queued") return m.optimizer.queued;
  if (label.type === "jpeg") return m.steps.jpeg(Math.round(label.quality * 100));
  const { step } = label;
  const parts: string[] = [];
  if (step.lossy > 0) parts.push(m.steps.lossy(step.lossy));
  if (step.colors < 256) parts.push(m.steps.colors(step.colors));
  if (step.frameStep > 1) parts.push(m.steps.everyNthFrame(step.frameStep));
  if (step.scale < 1) parts.push(m.steps.scale(Math.round(step.scale * 100)));
  return parts.length ? parts.join(" · ") : m.steps.lossless;
}

export interface ProgressView {
  /** What is happening, e.g. "Reducing palette → Lossy compression". */
  stage: string;
  /** The exact settings being tried, if any. */
  detail: string | null;
  /** 0..100, by finished passes. */
  percent: number;
  /** "Pass 2 of up to 5"; null outside of passes. */
  pass: string | null;
}

function describeProgress(m: Messages, p: OptimizeProgress | "queued"): ProgressView {
  const t = m.optimizer.progress;
  if (p === "queued") return { stage: t.queued, detail: null, percent: 0, pass: null };
  const percent = p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
  const { phase } = p;
  if (phase.kind === "read") return { stage: t.reading, detail: null, percent, pass: null };
  if (phase.kind === "decode") return { stage: t.decoding, detail: null, percent, pass: null };

  const { label } = phase;
  let stage: string;
  if (label.type === "jpeg") {
    stage = t.encodingJpeg;
  } else {
    const { step } = label;
    const actions: string[] = [];
    if (step.frameStep > 1) actions.push(t.dropFrames);
    if (step.scale < 1) actions.push(t.scale);
    if (step.colors < 256) actions.push(t.palette);
    actions.push(step.lossy > 0 ? t.lossy : t.lossless);
    stage = actions.join(" → ");
  }
  return {
    stage,
    detail: describeLabel(m, label),
    percent,
    pass: t.pass(Math.min(p.done + 1, p.total), p.total),
  };
}

function describeFailure(m: Messages, f: Failure): string {
  const { cause } = f;
  const detail =
    cause instanceof AppError
      ? m.errors.codes[cause.code](cause.params)
      : cause instanceof Error && cause.message
        ? cause.message
        : m.errors[f.kind];
  return f.filename ? `${f.filename}: ${detail}` : detail;
}
