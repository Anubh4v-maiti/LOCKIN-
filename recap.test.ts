import { describe, expect, it } from "vitest";
import { buildNarrative, computeMonthlyStats, recapCsv, type RecapInput } from "@/lib/recap";
import type { RangeData } from "@/lib/queries";
import type { Habit, MonthlyNarrative, TargetVersion } from "@/lib/types";

const userId = "11111111-1111-4111-8111-111111111111";

function range(partial: Partial<RangeData>): RangeData {
  return {
    logs: [],
    reflections: [],
    nutrition: [],
    water: [],
    tasks: [],
    study: [],
    habitCompletions: [],
    meals: [],
    ...partial,
  };
}

const target = {
  id: "t1",
  user_id: userId,
  effective_from: "2026-01-01",
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 70,
  fiber_g: 30,
  water_ml: 2500,
  study_minutes: 60,
  created_at: "",
} as TargetVersion;

const habit = {
  id: "h1",
  user_id: userId,
  name: "Read",
  description: null,
  color: "#C5F467",
  schedule_days: [0, 1, 2, 3, 4, 5, 6],
  target_per_week: 7,
  active: true,
  created_at: "",
  archived_at: null,
} as Habit;

function fixture(): RecapInput {
  return {
    month: "2026-09",
    today: "2026-10-23",
    weekStartsOn: 1,
    targets: [target],
    habits: [habit],
    data: range({
      logs: [
        { log_date: "2026-09-01", checkin_status: "complete" },
        { log_date: "2026-09-02", checkin_status: "complete" },
        { log_date: "2026-09-03", checkin_status: "partial" },
      ] as RangeData["logs"],
      reflections: [
        {
          log_date: "2026-09-01",
          rating: 4,
          win: "Shipped the draft, then rested",
          mistake: "Started late",
          improvement: null,
        },
      ] as RangeData["reflections"],
      nutrition: [
        {
          log_date: "2026-09-01",
          calories: 2000,
          protein_g: 160,
          carbs_g: 250,
          fat_g: 70,
          fiber_g: 30,
        },
        {
          log_date: "2026-09-02",
          calories: 1500,
          protein_g: 100,
          carbs_g: 200,
          fat_g: 70,
          fiber_g: 20,
        },
      ] as RangeData["nutrition"],
      water: [
        { log_date: "2026-09-01", total_ml: 2600 },
        { log_date: "2026-09-02", total_ml: 1000 },
      ] as RangeData["water"],
      tasks: [
        { log_date: "2026-09-01", title: "A", completed: true },
        { log_date: "2026-09-01", title: "B", completed: true },
        { log_date: "2026-09-02", title: "A", completed: true },
        { log_date: "2026-09-02", title: "B", completed: false },
        { log_date: "2026-09-04", title: "A", completed: false },
      ] as RangeData["tasks"],
      study: [{ log_date: "2026-09-01", minutes: 90 }] as RangeData["study"],
      habitCompletions: [
        { habit_id: "h1", log_date: "2026-09-01", completed: true },
        { habit_id: "h1", log_date: "2026-09-02", completed: true },
      ] as RangeData["habitCompletions"],
    }),
  };
}

describe("monthly recap statistics", () => {
  it("uses honest denominators and never turns missing records into zeroes", () => {
    const stats = computeMonthlyStats(fixture());

    expect(stats.month).toBe("2026-09");
    expect(stats.total_days).toBe(30);
    expect(stats.elapsed_days).toBe(30);
    expect(stats.checkin_days).toBe(2);
    expect(stats.partial_days).toBe(1);
    expect(stats.nutrition_days).toBe(2);
    expect(stats.water_days).toBe(2);
    expect(stats.task_days).toBe(3);
    expect(stats.planned_tasks).toBe(5);
    expect(stats.completed_tasks).toBe(3);
    expect(stats.task_completion_rate).toBe(60);

    expect(stats.avg_calories).toBe(1750);
    expect(stats.avg_protein_g).toBe(130);
    expect(stats.avg_water_ml).toBe(1800);
    expect(stats.study_days).toBe(1);
    expect(stats.study_minutes).toBe(90);

    expect(stats.target_met).toMatchObject({
      calories: 1,
      protein: 1,
      carbs: 1,
      fat: 2,
      water: 1,
      study: 1,
      tasks: 1,
    });
    expect(stats.eligible_target_days).toMatchObject({
      calories: 2,
      protein: 2,
      carbs: 2,
      fat: 2,
      water: 2,
      study: 1,
      tasks: 3,
    });

    expect(stats.longest_streak).toBe(2);
    expect(stats.current_streak_at_end).toBe(0);

    // 30 scheduled habit slots: 2 completed, 2 missed on recorded days,
    // 26 unexamined days excluded from the rate rather than counted as failures.
    expect(stats.habit_scheduled).toBe(30);
    expect(stats.habit_completed).toBe(2);
    expect(stats.habit_missed).toBe(2);
    expect(stats.habit_no_record).toBe(26);
    expect(stats.habit_completion_rate).toBe(50);
    expect(stats.warnings.some((w) => w.includes("28 of 30"))).toBe(true);
    expect(stats.warnings.some((w) => w.includes("Nutrition averages use 2 recorded days"))).toBe(true);
  });

  it("keeps all averages null in an empty month", () => {
    const stats = computeMonthlyStats({
      ...fixture(),
      data: range({}),
      habits: [],
      today: "2026-10-23",
    });
    expect(stats.avg_calories).toBeNull();
    expect(stats.avg_protein_g).toBeNull();
    expect(stats.avg_water_ml).toBeNull();
    expect(stats.task_completion_rate).toBeNull();
    expect(stats.habit_completion_rate).toBeNull();
    expect(stats.study_minutes).toBe(0);
    expect(stats.study_days).toBe(0);
    expect(stats.warnings).toContain("No meaningful records exist for this month yet.");
  });

  it("stops counting scheduled habit days after a habit is archived", () => {
    const stats = computeMonthlyStats({
      ...fixture(),
      habits: [
        {
          ...habit,
          created_at: "2026-09-01T00:00:00.000Z",
          archived_at: "2026-09-05T12:00:00.000Z",
        },
      ],
    });
    expect(stats.habit_scheduled).toBe(5);
    expect(stats.habit_completed).toBe(2);
    expect(stats.habit_missed).toBe(2);
    expect(stats.habit_no_record).toBe(1);
    expect(stats.habit_completion_rate).toBe(50);
  });

  it("only counts elapsed days for a current month", () => {
    const stats = computeMonthlyStats({
      ...fixture(),
      month: "2026-10",
      today: "2026-10-03",
      data: range({ logs: [{ log_date: "2026-10-01", checkin_status: "complete" }] as RangeData["logs"] }),
      habits: [habit],
    });
    expect(stats.total_days).toBe(31);
    expect(stats.elapsed_days).toBe(3);
    expect(stats.checkin_days).toBe(1);
  });
});

describe("deterministic narrative", () => {
  it("grounds every claim in saved records and avoids fake zero averages", () => {
    const stats = computeMonthlyStats(fixture());
    const narrative = buildNarrative(stats);
    expect(narrative.generated_by).toBe("deterministic");
    expect(narrative.summary).toContain("2 of 30 elapsed daily check-ins");
    expect(narrative.summary).toContain("3 of 5 planned tasks");
    expect(narrative.summary).toContain("1750 kcal and 130 g protein");
    expect(narrative.summary).not.toMatch(/\b0 kcal/);
    expect(narrative.obstacles.some((o) => o.observed.includes("28 days had no completed check-in"))).toBe(true);
    expect(narrative.plan.continue.length).toBeGreaterThanOrEqual(3);
    expect(narrative.plan.improve.length).toBeGreaterThanOrEqual(3);
    expect(narrative.plan.simplify.length).toBeGreaterThanOrEqual(2);
  });

  it("does not claim a 0 kcal average when a nutrition row has no macro values", () => {
    const stats = computeMonthlyStats({
      ...fixture(),
      data: range({
        nutrition: [{ log_date: "2026-09-01", calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null }] as RangeData["nutrition"],
      }),
      habits: [],
    });
    expect(stats.nutrition_days).toBe(1);
    expect(stats.avg_calories).toBeNull();
    const narrative = buildNarrative(stats);
    expect(narrative.summary).toContain("no recorded calorie values");
    expect(narrative.summary).toContain("no recorded protein values");
    expect(narrative.summary).not.toContain("0 kcal");
  });

  it("is explicit when a month has no evidence", () => {
    const stats = computeMonthlyStats({
      ...fixture(),
      data: range({}),
      habits: [],
    });
    const narrative = buildNarrative(stats);
    expect(narrative.summary).toContain("no meaningful records");
    expect(narrative.summary).toContain("intentionally empty rather than estimated");
    expect(narrative.wins[0]).toContain("Recording honestly");
    expect(narrative.plan.focus).toContain("recording habit");
  });

  it("compares study only when the previous month had recorded study", () => {
    const previous = computeMonthlyStats({ ...fixture(), data: range({}), habits: [] });
    const stats = computeMonthlyStats(fixture(), previous);
    expect(stats.previous?.study_minutes).toBeNull();
    const narrative = buildNarrative(stats);
    expect(narrative.summary).not.toContain("Study minutes was");
  });
});

describe("CSV export", () => {
  it("quotes commas, quotes and newlines and leaves missing values blank", () => {
    const stats = computeMonthlyStats({ ...fixture(), data: range({}), habits: [] });
    const narrative: MonthlyNarrative = {
      ...buildNarrative(stats),
      summary: 'A, "quoted"\nline',
    };
    const csv = recapCsv(stats, narrative);
    expect(csv).toContain('"A, ""quoted""\nline"');
    expect(csv).toContain('Study minutes,\n');
    expect(csv).toContain('Average calories (recorded days),\n');
    expect(csv).not.toContain("NaN");
  });
});
