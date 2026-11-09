import { DATE_FORMATS, isValidTimeZone, type DateFormat } from "@/lib/date";
import { DEFAULT_MODULES, type ModulePreferences, type Profile, type ThemePreference } from "@/lib/types";

export function normalizeModules(value: unknown): ModulePreferences {
  const raw = (value ?? {}) as Partial<Record<keyof ModulePreferences, unknown>>;
  return {
    meals: typeof raw.meals === "boolean" ? raw.meals : DEFAULT_MODULES.meals,
    study: typeof raw.study === "boolean" ? raw.study : DEFAULT_MODULES.study,
    habits: typeof raw.habits === "boolean" ? raw.habits : DEFAULT_MODULES.habits,
    career: typeof raw.career === "boolean" ? raw.career : DEFAULT_MODULES.career,
    aiInsights: typeof raw.aiInsights === "boolean" ? raw.aiInsights : DEFAULT_MODULES.aiInsights,
  };
}

export function normalizeProfile(row: Record<string, unknown>): Profile {
  const rawDateFormat = String(row.date_format ?? "MMM d, yyyy");
  const dateFormat = (DATE_FORMATS as readonly string[]).includes(rawDateFormat)
    ? (rawDateFormat as DateFormat)
    : "MMM d, yyyy";
  const timezone = String(row.timezone ?? "UTC");
  const theme = String(row.theme ?? "dark");
  const weekStart = Number(row.week_start ?? 1);
  return {
    id: String(row.id),
    display_name: row.display_name ? String(row.display_name) : null,
    timezone: isValidTimeZone(timezone) ? timezone : "UTC",
    date_format: dateFormat,
    week_start: weekStart === 0 ? 0 : 1,
    theme: (["dark", "light", "system"].includes(theme) ? theme : "dark") as ThemePreference,
    modules: normalizeModules(row.modules),
    reminder_enabled: Boolean(row.reminder_enabled ?? false),
    reminder_time: row.reminder_time ? String(row.reminder_time).slice(0, 5) : null,
    onboarded: Boolean(row.onboarded ?? false),
    ai_consent: Boolean(row.ai_consent ?? false),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export const PROFILE_COLUMNS =
  "id, display_name, timezone, date_format, week_start, theme, modules, reminder_enabled, reminder_time, onboarded, ai_consent, created_at, updated_at";
