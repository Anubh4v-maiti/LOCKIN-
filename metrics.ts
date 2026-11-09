import {
  type DateKey,
  addDays,
  diffInDays,
  eachDate,
  endOfWeek,
  startOfWeek,
  weekDates,
} from "@/lib/date";
import type {
  DailyTask,
  Habit,
  HabitCompletion,
  NutritionEntry,
  TargetVersion,
  WaterLog,
} from "@/lib/types";

export function sumNullable(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

/** Average of recorded (non-null) values. Returns null when nothing was recorded. */
export function averageRecorded(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

export function round(value: number | null, digits = 0): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentOf(value: number | null, target: number | null): number | null {
  if (value === null || target === null || target <= 0) return null;
  return (value / target) * 100;
}

export function clampPercent(value: number | null): number {
  if (value === null) return 0;
  return Math.min(100, Math.max(0, value));
}

export function remainingOf(value: number | null, target: number | null): number | null {
  if (value === null || target === null) return null;
  return target - value;
}

export interface MetricProgress {
  value: number | null;
  target: number | null;
  percent: number | null;
  remaining: number | null;
  met: boolean | null;
  over: boolean;
}

export function metricProgress(value: number | null, target: number | null): MetricProgress {
  const percent = percentOf(value, target);
  const remaining = remainingOf(value, target);
  return {
    value,
    target,
    percent,
    remaining,
    met: percent === null ? null : percent >= 90,
    over: remaining !== null ? remaining < 0 : false,
  };
}

/** Latest target version whose effective date is on or before the given date. */
export function resolveTargets(
  versions: TargetVersion[],
  date: DateKey,
): TargetVersion | null {
  const eligible = versions
    .filter((v) => v.effective_from <= date)
    .sort((a, b) => (a.effective_from < b.effective_from ? 1 : a.effective_from > b.effective_from ? -1 : 0));
  return eligible[0] ?? null;
}

export function macroTargets(version: TargetVersion | null) {
  return {
    calories: version?.calories ?? null,
    protein_g: version?.protein_g ?? null,
    carbs_g: version?.carbs_g ?? null,
    fat_g: version?.fat_g ?? null,
    fiber_g: version?.fiber_g ?? null,
    water_ml: version?.water_ml ?? null,
    study_minutes: version?.study_minutes ?? null,
  };
}

export interface NutritionTotals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

export function nutritionTotals(
  entry: Pick<NutritionEntry, "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g"> | null,
): NutritionTotals {
  return {
    calories: entry?.calories ?? null,
    protein_g: entry?.protein_g ?? null,
    carbs_g: entry?.carbs_g ?? null,
    fat_g: entry?.fat_g ?? null,
    fiber_g: entry?.fiber_g ?? null,
  };
}

export interface TargetMetResult {
  calories: boolean | null;
  protein: boolean | null;
  carbs: boolean | null;
  fat: boolean | null;
  fiber: boolean | null;
  water: boolean | null;
  study: boolean | null;
  tasks: boolean | null;
  applicable: number;
  met: number;
  pct: number | null;
}

/**
 * Explicit target rules, shown in the UI:
 * - Calories, carbs and fat: within ±10% of the configured target.
 * - Protein and fiber: at or above target (minimums).
 * - Water and study: at or above target.
 * - Tasks: every planned task completed (only when at least one task was planned).
 * A `null` means "not enough configured/recorded data" — never a failure.
 */
export function evaluateTargets(input: {
  nutrition: NutritionTotals | null;
  targets: ReturnType<typeof macroTargets> | null;
  waterMl: number | null;
  studyMinutes?: number | null;
  tasksPlanned?: number;
  tasksCompleted?: number;
}): TargetMetResult {
  const n = input.nutrition;
  const t = input.targets;
  const within = (value: number | null | undefined, target: number | null | undefined) =>
    value == null || target == null || target <= 0 ? null : value >= target * 0.9 && value <= target * 1.1;
  const atLeast = (value: number | null | undefined, target: number | null | undefined) =>
    value == null || target == null || target <= 0 ? null : value >= target;

  const calories = within(n?.calories, t?.calories);
  const protein = atLeast(n?.protein_g, t?.protein_g);
  const carbs = within(n?.carbs_g, t?.carbs_g);
  const fat = within(n?.fat_g, t?.fat_g);
  const fiber = atLeast(n?.fiber_g, t?.fiber_g);
  const water = atLeast(input.waterMl, t?.water_ml);
  const study = atLeast(input.studyMinutes ?? null, t?.study_minutes);
  const tasks =
    input.tasksPlanned == null || input.tasksPlanned <= 0
      ? null
      : (input.tasksCompleted ?? 0) >= input.tasksPlanned;

  const values = [calories, protein, carbs, fat, fiber, water, study, tasks].filter(
    (v): v is boolean => v !== null,
  );
  const met = values.filter(Boolean).length;
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    water,
    study,
    tasks,
    applicable: values.length,
    met,
    pct: values.length ? (met / values.length) * 100 : null,
  };
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  percent: number | null;
  allDone: boolean;
}

export function taskStats(tasks: Pick<DailyTask, "completed">[]): TaskStats {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return {
    total,
    completed,
    pending: total - completed,
    percent: total === 0 ? null : (completed / total) * 100,
    allDone: total > 0 && completed === total,
  };
}

export interface WaterStats {
  totalMl: number | null;
  targetMl: number | null;
  remainingMl: number | null;
  percent: number | null;
  met: boolean | null;
  hasRecord: boolean;
}

export function waterStats(
  totalMl: number | null | undefined,
  targetMl: number | null | undefined,
): WaterStats {
  const total = totalMl ?? null;
  const target = targetMl ?? null;
  return {
    totalMl: total,
    targetMl: target,
    remainingMl: total === null || target === null ? null : target - total,
    percent: percentOf(total, target),
    met: total === null || target === null ? null : total >= target,
    hasRecord: total !== null,
  };
}

export interface StreakResult {
  current: number;
  best: number;
  bestEnd: DateKey | null;
  lastCompleted: DateKey | null;
  todayComplete: boolean;
}

/**
 * Streaks are based only on explicitly completed daily check-ins.
 * Today being incomplete does not break the current streak until the day ends;
 * the current streak is counted backwards from today (if complete) or yesterday.
 * Future dates are ignored.
 */
export function checkinStreaks(completedDates: DateKey[], today: DateKey): StreakResult {
  const unique = Array.from(new Set(completedDates.filter((d) => d <= today))).sort();
  const set = new Set(unique);
  const todayComplete = set.has(today);

  let current = 0;
  let cursor = todayComplete ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let bestEnd: DateKey | null = null;
  let run = 0;
  let previous: DateKey | null = null;
  for (const date of unique) {
    if (previous && diffInDays(previous, date) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run >= best) {
      best = run;
      bestEnd = date;
    }
    previous = date;
  }

  return {
    current,
    best,
    bestEnd,
    lastCompleted: unique.length ? unique[unique.length - 1] : null,
    todayComplete,
  };
}

export function studyStreak(
  minutesByDate: Record<DateKey, number | null | undefined>,
  today: DateKey,
  thresholdMinutes = 25,
): StreakResult {
  const completed = Object.entries(minutesByDate)
    .filter(([date, minutes]) => date <= today && (minutes ?? 0) >= thresholdMinutes)
    .map(([date]) => date);
  return checkinStreaks(completed, today);
}

export function weekConsistency(
  today: DateKey,
  checkinDates: DateKey[],
  weekStartsOn: 0 | 1 = 1,
): { start: DateKey; end: DateKey; elapsed: number; completed: number; percent: number | null } {
  const start = startOfWeek(today, weekStartsOn);
  const end = endOfWeek(today, weekStartsOn);
  const days = eachDate(start, end).filter((d) => d <= today);
  const set = new Set(checkinDates);
  const completed = days.filter((d) => set.has(d)).length;
  return {
    start,
    end,
    elapsed: days.length,
    completed,
    percent: days.length ? (completed / days.length) * 100 : null,
  };
}

export function nutritionCompletion(
  nutrition: NutritionTotals | null,
  targets: ReturnType<typeof macroTargets> | null,
): number | null {
  if (!nutrition || !targets) return null;
  const values: number[] = [];
  for (const key of ["calories", "protein_g", "carbs_g", "fat_g"] as const) {
    const value = nutrition[key];
    const target = targets[key];
    if (value != null && target != null && target > 0) values.push(Math.min(100, (value / target) * 100));
  }
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Transparent daily completion score (0-100) using only applicable components:
 * check-in 40, tasks 30, nutrition 15, water 15. Weights are renormalised when a
 * component is not configured/recorded. Null means nothing to measure yet.
 */
export function dailyCompletionScore(input: {
  checkinStatus: "none" | "partial" | "complete";
  tasksPlanned: number;
  tasksCompleted: number;
  nutrition: NutritionTotals | null;
  targets: ReturnType<typeof macroTargets> | null;
  waterMl: number | null;
}): { score: number | null; components: { label: string; weight: number; value: number | null }[] } {
  const components: { label: string; weight: number; value: number | null }[] = [
    {
      label: "Check-in",
      weight: 40,
      value:
        input.checkinStatus === "complete" ? 100 : input.checkinStatus === "partial" ? 40 : null,
    },
    {
      label: "Tasks",
      weight: 30,
      value: input.tasksPlanned > 0 ? (input.tasksCompleted / input.tasksPlanned) * 100 : null,
    },
    {
      label: "Nutrition",
      weight: 15,
      value: nutritionCompletion(input.nutrition, input.targets),
    },
    {
      label: "Water",
      weight: 15,
      value: percentOf(input.waterMl, input.targets?.water_ml ?? null),
    },
  ];
  const applicable = components.filter((c) => c.value !== null);
  if (!applicable.length) return { score: null, components };
  const weightSum = applicable.reduce((sum, c) => sum + c.weight, 0);
  const weighted = applicable.reduce((sum, c) => sum + c.weight * Math.min(100, c.value!), 0);
  return { score: weighted / weightSum, components };
}

export type HabitDayState =
  | "completed"
  | "scheduled"
  | "unscheduled"
  | "missed"
  | "no-record"
  | "future";

/** Whether a habit existed on a calendar day. Timestamps are reduced to their UTC date part. */
export function habitActiveOn(
  habit: Pick<Habit, "created_at" | "archived_at">,
  date: DateKey,
): boolean {
  const created = habit.created_at ? habit.created_at.slice(0, 10) : null;
  const archived = habit.archived_at ? habit.archived_at.slice(0, 10) : null;
  if (created && date < created) return false;
  if (archived && date > archived) return false;
  return true;
}

export function habitDayState(input: {
  habit: Pick<Habit, "schedule_days" | "created_at" | "archived_at">;
  date: DateKey;
  today: DateKey;
  completion?: Pick<HabitCompletion, "completed"> | null;
  hasAnyRecord: boolean;
}): HabitDayState {
  if (!habitActiveOn(input.habit, input.date)) return "unscheduled";
  const scheduled = input.habit.schedule_days.includes(new Date(`${input.date}T00:00:00Z`).getUTCDay());
  if (!scheduled) return "unscheduled";
  if (input.completion?.completed) return "completed";
  if (input.date > input.today) return "future";
  if (input.date === input.today) return "scheduled";
  if (input.hasAnyRecord) return "missed";
  return "no-record";
}

export interface HabitWeekSummary {
  scheduled: number;
  completed: number;
  missed: number;
  noRecord: number;
  percent: number | null;
}

export function habitWeekSummary(input: {
  habit: Habit;
  week: DateKey[];
  today: DateKey;
  completions: HabitCompletion[];
  hasRecordByDate: Set<DateKey>;
}): HabitWeekSummary {
  const byDate = new Map(input.completions.map((c) => [c.log_date, c]));
  let scheduled = 0;
  let completed = 0;
  let missed = 0;
  let noRecord = 0;
  for (const date of input.week) {
    if (date > input.today) continue;
    const state = habitDayState({
      habit: input.habit,
      date,
      today: input.today,
      completion: byDate.get(date),
      hasAnyRecord: input.hasRecordByDate.has(date),
    });
    if (state === "unscheduled") continue;
    scheduled += 1;
    if (state === "completed") completed += 1;
    else if (state === "missed") missed += 1;
    else if (state === "no-record") noRecord += 1;
  }
  return {
    scheduled,
    completed,
    missed,
    noRecord,
    // No-record and still-pending days stay out of the denominator rather
    // than being counted as failures.
    percent: completed + missed ? (completed / (completed + missed)) * 100 : null,
  };
}

export function taskConsistency(tasks: DailyTask[]): {
  frequent: { title: string; completed: number; total: number }[];
  incomplete: { title: string; missed: number; total: number }[];
} {
  const map = new Map<string, { title: string; completed: number; total: number }>();
  for (const task of tasks) {
    const key = task.title.trim().toLowerCase();
    const existing = map.get(key) ?? { title: task.title.trim(), completed: 0, total: 0 };
    existing.total += 1;
    if (task.completed) existing.completed += 1;
    map.set(key, existing);
  }
  const all = Array.from(map.values());
  return {
    frequent: all
      .filter((t) => t.total >= 2)
      .sort((a, b) => b.completed - a.completed || b.total - a.total)
      .slice(0, 5),
    incomplete: all
      .filter((t) => t.total >= 2 && t.completed < t.total)
      .sort((a, b) => b.total - b.completed - (a.total - a.completed) || b.total - a.total)
      .slice(0, 5)
      .map((t) => ({ title: t.title, missed: t.total - t.completed, total: t.total })),
  };
}

export function weekCheckinCounts(
  monthDays: DateKey[],
  checkinDates: Set<DateKey>,
  weekStartsOn: 0 | 1 = 1,
): { start: DateKey; checkins: number; total: number }[] {
  if (!monthDays.length) return [];
  const buckets = new Map<DateKey, { start: DateKey; checkins: number; total: number }>();
  for (const day of monthDays) {
    const start = startOfWeek(day, weekStartsOn);
    const bucket = buckets.get(start) ?? { start, checkins: 0, total: 0 };
    bucket.total += 1;
    if (checkinDates.has(day)) bucket.checkins += 1;
    buckets.set(start, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function dayEvidenceScore(input: {
  checkinStatus: "none" | "partial" | "complete";
  taskRate: number | null;
  nutritionPct: number | null;
  waterPct: number | null;
}): { score: number; evidence: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.checkinStatus === "complete") {
    score += 40;
    reasons.push("completed check-in");
  } else if (input.checkinStatus === "partial") {
    score += 15;
    reasons.push("partial check-in");
  }
  if (input.taskRate !== null) {
    score += (Math.min(100, input.taskRate) / 100) * 25;
    if (input.taskRate === 100) reasons.push("all tasks completed");
  }
  if (input.nutritionPct !== null) {
    score += (Math.min(100, input.nutritionPct) / 100) * 20;
    if (input.nutritionPct >= 90) reasons.push("nutrition targets on track");
  }
  if (input.waterPct !== null) {
    score += (Math.min(100, input.waterPct) / 100) * 15;
    if (input.waterPct >= 100) reasons.push("water target met");
  }
  return { score: Math.round(score), evidence: reasons };
}

export function waterWeekTotal(logs: WaterLog[], week: DateKey[]): number | null {
  const set = new Set(week);
  return sumNullable(logs.filter((l) => set.has(l.log_date)).map((l) => l.total_ml));
}

export function weeklyStudyMinutes(
  sessions: { log_date: DateKey; minutes: number }[],
  week: DateKey[],
): number {
  const set = new Set(week);
  return sessions.filter((s) => set.has(s.log_date)).reduce((sum, s) => sum + s.minutes, 0);
}

export function bestAndHardestDays(
  days: Array<{ date: DateKey; score: number; evidence: string[] }>,
): {
  best: { date: DateKey; score: number; reason: string } | null;
  hardest: { date: DateKey; score: number; reason: string } | null;
} {
  const considered = days.filter((d) => d.score > 0);
  if (!considered.length) return { best: null, hardest: null };
  const sorted = [...considered].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const hardest = sorted[sorted.length - 1];
  return {
    best: {
      date: best.date,
      score: best.score,
      reason: best.evidence.length ? best.evidence.join(", ") : "recorded activity",
    },
    hardest:
      hardest.date === best.date
        ? null
        : {
            date: hardest.date,
            score: hardest.score,
            reason: hardest.evidence.length ? hardest.evidence.join(", ") : "limited recorded evidence",
          },
  };
}

/** Latest date with any record, capped at today, for analytics eligibility. */
export function analyticsRange(totalDays: number, today: DateKey): DateKey[] {
  return Array.from({ length: totalDays }, (_, i) => addDays(today, -(totalDays - 1 - i)));
}
