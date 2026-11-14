import type { Locale } from "./i18n/types";

const MB = 1024 * 1024;

const UNITS: Record<Locale, { kb: string; mb: string; s: string }> = {
  en: { kb: "KB", mb: "MB", s: "s" },
  uk: { kb: "КБ", mb: "МБ", s: "с" },
  nl: { kb: "KB", mb: "MB", s: "s" },
};

function fixed(value: number, digits: number, locale: Locale): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatBytes(bytes: number, locale: Locale = "en"): string {
  const u = UNITS[locale];
  if (bytes >= MB) return `${fixed(bytes / MB, 2, locale)} ${u.mb}`;
  return `${fixed(bytes / 1024, 1, locale)} ${u.kb}`;
}

export function formatSeconds(ms: number, locale: Locale = "en"): string {
  return `${fixed(ms / 1000, ms < 10_000 ? 1 : 0, locale)} ${UNITS[locale].s}`;
}
