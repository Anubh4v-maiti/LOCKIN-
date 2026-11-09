/**
 * All calendar dates in LOCKIN are stored as `YYYY-MM-DD` strings representing
 * a *local* calendar day in the user's configured timezone. We never use
 * `Date.toISOString().slice(0, 10)` for a local date, because that can shift the
 * day at timezone boundaries. Date-key math is done in UTC, which is safe for
 * pure calendar arithmetic.
 */

export type DateKey = string;
export type MonthKey = string;

export const DATE_FORMATS = [
  "MMM d, yyyy",
  "MMM d",
  "d MMM yyyy",
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
] as const;

export type DateFormat = (typeof DATE_FORMATS)[number];

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value: string | null | undefined): value is DateKey {
  if (!value || !DATE_KEY_RE.test(value)) return false;
  const [, y, m, d] = value.match(DATE_KEY_RE)!;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

export function assertDateKey(value: string): DateKey {
  if (!isValidDateKey(value)) throw new Error(`Invalid calendar date: ${value}`);
  return value;
}

export function parseDateKey(value: DateKey): Date {
  assertDateKey(value);
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateKeyFromUTC(date: Date): DateKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Today's calendar date in a specific IANA timezone. */
export function todayInTimeZone(timeZone = "UTC", now: Date = new Date()): DateKey {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) throw new Error("Unable to resolve local date");
    return `${year}-${month}-${day}`;
  } catch {
    return dateKeyFromUTC(now);
  }
}

/** The hour (0-23) in a specific IANA timezone. */
export function hourInTimeZone(timeZone = "UTC", now: Date = new Date()): number {
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const parsed = Number(value.replace(/\D/g, ""));
    return Number.isFinite(parsed) ? parsed % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: DateKey, amount: number): DateKey {
  const d = parseDateKey(date);
  d.setUTCDate(d.getUTCDate() + amount);
  return dateKeyFromUTC(d);
}

export function diffInDays(from: DateKey, to: DateKey): number {
  const a = parseDateKey(from).getTime();
  const b = parseDateKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Sunday, 1 = Monday, ... */
export function dayOfWeek(date: DateKey): number {
  return parseDateKey(date).getUTCDay();
}

export function startOfWeek(date: DateKey, weekStartsOn: 0 | 1 = 1): DateKey {
  const dow = dayOfWeek(date);
  const delta = (dow - weekStartsOn + 7) % 7;
  return addDays(date, -delta);
}

export function endOfWeek(date: DateKey, weekStartsOn: 0 | 1 = 1): DateKey {
  return addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: DateKey): DateKey {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: DateKey): DateKey {
  const d = parseDateKey(startOfMonth(date));
  return dateKeyFromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function monthKey(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function isValidMonthKey(value: string | null | undefined): value is MonthKey {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function startOfMonthKey(month: MonthKey): DateKey {
  if (!isValidMonthKey(month)) throw new Error(`Invalid month: ${month}`);
  return `${month}-01`;
}

export function endOfMonthKey(month: MonthKey): DateKey {
  return endOfMonth(startOfMonthKey(month));
}

export function addMonths(month: MonthKey, amount: number): MonthKey {
  const d = parseDateKey(startOfMonthKey(month));
  d.setUTCMonth(d.getUTCMonth() + amount);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function eachDate(start: DateKey, end: DateKey, cap = 3700): DateKey[] {
  if (!isValidDateKey(start) || !isValidDateKey(end)) return [];
  const direction = start <= end ? 1 : -1;
  const total = Math.abs(diffInDays(start, end));
  if (total > cap) return [];
  const out: DateKey[] = [];
  for (let i = 0; i <= total; i += 1) out.push(addDays(start, i * direction));
  return out;
}

export function weekDates(date: DateKey, weekStartsOn: 0 | 1 = 1): DateKey[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthMatrix(month: MonthKey, weekStartsOn: 0 | 1 = 1): DateKey[][] {
  const first = startOfMonthKey(month);
  const last = endOfMonthKey(month);
  const gridStart = startOfWeek(first, weekStartsOn);
  const gridEnd = endOfWeek(last, weekStartsOn);
  const days = eachDate(gridStart, gridEnd);
  const weeks: DateKey[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

const FORMAT_OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  "MMM d, yyyy": { month: "short", day: "numeric", year: "numeric" },
  "MMM d": { month: "short", day: "numeric" },
  "d MMM yyyy": { day: "numeric", month: "short", year: "numeric" },
  "yyyy-MM-dd": { year: "numeric", month: "2-digit", day: "2-digit" },
  "MM/dd/yyyy": { year: "numeric", month: "2-digit", day: "2-digit" },
  "dd/MM/yyyy": { year: "numeric", month: "2-digit", day: "2-digit" },
};

export function formatDate(
  date: DateKey,
  format: DateFormat = "MMM d, yyyy",
  locale = "en-US",
): string {
  if (!isValidDateKey(date)) return "—";
  const d = parseDateKey(date);
  if (format === "yyyy-MM-dd") return date;
  if (format === "MM/dd/yyyy") {
    const [y, m, day] = date.split("-");
    return `${m}/${day}/${y}`;
  }
  if (format === "dd/MM/yyyy") {
    const [y, m, day] = date.split("-");
    return `${day}/${m}/${y}`;
  }
  return new Intl.DateTimeFormat(locale, {
    ...FORMAT_OPTIONS[format],
    timeZone: "UTC",
  }).format(d);
}

export function formatWeekday(date: DateKey, style: "short" | "long" = "short"): string {
  if (!isValidDateKey(date)) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: style, timeZone: "UTC" }).format(
    parseDateKey(date),
  );
}

export function formatMonth(month: MonthKey, style: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-US", { month: style, year: "numeric", timeZone: "UTC" }).format(
    parseDateKey(startOfMonthKey(month)),
  );
}

export function formatDayNumber(date: DateKey): string {
  return String(parseDateKey(date).getUTCDate());
}

export function relativeDateLabel(date: DateKey, today: DateKey): string {
  const delta = diffInDays(today, date);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  return formatDate(date, "MMM d, yyyy");
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function isFuture(date: DateKey, today: DateKey): boolean {
  return date > today;
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return monthKey(a) === monthKey(b);
}

export const WEEKDAY_LABELS = {
  long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  min: ["S", "M", "T", "W", "T", "F", "S"],
} as const;

export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

export function timezoneOptions(): string[] {
  try {
    // Available in modern browsers and Node 18+.
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      return intl.supportedValuesOf("timeZone");
    }
  } catch {
    // fall through
  }
  return [
    "UTC",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/New_York",
    "America/Sao_Paulo",
    "Asia/Dubai",
    "Asia/Hong_Kong",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Europe/Berlin",
    "Europe/London",
    "Europe/Paris",
    "Pacific/Auckland",
  ];
}

export function humanDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function humanSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
