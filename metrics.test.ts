import { describe, expect, it } from "vitest";
import {
  averageRecorded,
  bestAndHardestDays,
  checkinStreaks,
  dailyCompletionScore,
  evaluateTargets,
  habitActiveOn,
  habitDayState,
  habitWeekSummary,
  macroTargets,
  metricProgress,
  percentOf,
  resolveTargets,
  taskStats,
  waterStats,
} from "@/lib/metrics";
import type { Habit, HabitCompletion, TargetVersion } from "@/lib/types";

const targets = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 70,
  fiber_g: 30,
  water_ml: 2500,
  study_minutes: 60,
};

describe("target calculations", () => {
  it("uses ±10% for calories/carbs/fat and minimums for protein/fiber", () => {
    const result = evaluateTargets({
      nutrition: { calories: 1800, protein_g: 150, carbs_g: 275, fat_g: 77, fiber_g: 29 },
      targets,
      waterMl: 2500,
      studyMinutes: 60,
      tasksPlanned: 2,
      tasksCompleted: 2,
    });
    expect(result.calories).toBe(true); // exactly -10%
    expect(result.protein).toBe(true);
    expect(result.carbs).toBe(true); // exactly +10%
    expect(result.fat).toBe(true); // exactly +10%
    expect(result.fiber).toBe(false);
    expect(result.water).toBe(true);
    expect(result.study).toBe(true);
    expect(result.tasks).toBe(true);
    expect(result.applicable).toBe(8);
    expect(result.met).toBe(7);
  });

  it("keeps missing data and missing targets as null, never false", () => {
    const result = evaluateTargets({
      nutrition: { calories: null, protein_g: 150, carbs_g: null, fat_g: null, fiber_g: null },
      targets: { ...targets, calories: null, protein_g: 150 },
      waterMl: null,
      studyMinutes: null,
      tasksPlanned: 0,
      tasksCompleted: 0,
    });
    expect(result.calories).toBeNull();
    expect(result.protein).toBe(true);
    expect(result.water).toBeNull();
    expect(result.study).toBeNull();
    expect(result.tasks).toBeNull();
    expect(result.applicable).toBe(1);
    expect(result.pct).toBe(100);
  });

  it("resolves historical target versions by effective date", () => {
    const versions = [
      { id: "b", effective_from: "2026-06-01", ...targets },
      { id: "a", effective_from: "2026-01-01", ...targets, calories: 1800 },
    ] as TargetVersion[];
    expect(resolveTargets(versions, "2025-12-31")).toBeNull();
    expect(resolveTargets(versions, "2026-01-01")?.calories).toBe(1800);
    expect(resolveTargets(versions, "2026-06-01")?.calories).toBe(2000);
    expect(macroTargets(null).calories).toBeNull();
  });

  it("handles percentages and averages without inventing zeroes", () => {
    expect(percentOf(null, 100)).toBeNull();
    expect(percentOf(10, null)).toBeNull();
    expect(percentOf(10, 0)).toBeNull();
    expect(percentOf(50, 200)).toBe(25);
    expect(averageRecorded([null, undefined, 10, 20])).toBe(15);
    expect(averageRecorded([null, undefined])).toBeNull();
  });

  it("computes task and water stats honestly", () => {
    expect(taskStats([])).toMatchObject({ total: 0, completed: 0, percent: null, allDone: false });
    expect(taskStats([{ completed: true }, { completed: false }])).toMatchObject({
      total: 2,
      completed: 1,
      pending: 1,
      percent: 50,
      allDone: false,
    });
    const water = waterStats(null, 2500);
    expect(water).toMatchObject({ totalMl: null, percent: null, met: null, hasRecord: false });
    expect(waterStats(2500, 2500).met).toBe(true);
  });

  it("treats an absent check-in as missing evidence in the daily score", () => {
    const empty = dailyCompletionScore({
      checkinStatus: "none",
      tasksPlanned: 0,
      tasksCompleted: 0,
      nutrition: null,
      targets,
      waterMl: null,
    });
    expect(empty.score).toBeNull();

    const complete = dailyCompletionScore({
      checkinStatus: "complete",
      tasksPlanned: 2,
      tasksCompleted: 2,
      nutrition: { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 70, fiber_g: 30 },
      targets,
      waterMl: 2500,
    });
    expect(complete.score).toBe(100);
  });

  it("does not mark calories over target as met using MetricProgress", () => {
    expect(metricProgress(2500, 2000).met).toBe(true);
    // The ±10% rule lives in evaluateTargets; MetricProgress is a simple ratio
    // used for progress bars only.
    expect(evaluateTargets({
      nutrition: { calories: 2500, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null },
      targets,
      waterMl: null,
    }).calories).toBe(false);
  });
});

describe("streaks", () => {
  it("counts backwards from today and tolerates an incomplete today", () => {
    expect(checkinStreaks(["2026-10-20", "2026-10-21", "2026-10-22"], "2026-10-23")).toMatchObject({
      current: 3,
      best: 3,
      todayComplete: false,
    });
    expect(checkinStreaks(["2026-10-20", "2026-10-21", "2026-10-23"], "2026-10-23")).toMatchObject({
      current: 1,
      best: 2,
      todayComplete: true,
    });
  });

  it("ignores future check-ins and handles no records", () => {
    const result = checkinStreaks(["2026-10-24", "2026-10-25"], "2026-10-23");
    expect(result.current).toBe(0);
    expect(result.best).toBe(0);
    expect(result.lastCompleted).toBeNull();
  });
});

describe("habits", () => {
  const habit = {
    id: "h1",
    user_id: "u1",
    name: "Read",
    description: null,
    color: "#C5F467",
    schedule_days: [1, 2, 3],
    target_per_week: 3,
    active: true,
    created_at: "",
    archived_at: null,
  } as Habit;

  it("distinguishes scheduled, missed, completed and no-record days", () => {
    // 2026-10-19 is Monday, 2026-10-20 Tuesday.
    expect(habitDayState({ habit, date: "2026-10-19", today: "2026-10-23", hasAnyRecord: false })).toBe("no-record");
    expect(habitDayState({ habit, date: "2026-10-20", today: "2026-10-23", hasAnyRecord: true })).toBe("missed");
    expect(habitDayState({ habit, date: "2026-10-21", today: "2026-10-21", hasAnyRecord: true })).toBe("scheduled");
    expect(
      habitDayState({ habit, date: "2026-10-19", today: "2026-10-23", completion: { completed: true }, hasAnyRecord: true }),
    ).toBe("completed");
    expect(habitDayState({ habit, date: "2026-10-26", today: "2026-10-23", hasAnyRecord: true })).toBe("future");
  });

  it("does not schedule a habit before creation or after archiving", () => {
    const dated = {
      ...habit,
      created_at: "2026-10-21T10:00:00.000Z",
      archived_at: "2026-10-22T10:00:00.000Z",
    } as Habit;
    expect(habitActiveOn(dated, "2026-10-20")).toBe(false);
    expect(habitActiveOn(dated, "2026-10-21")).toBe(true);
    expect(habitActiveOn(dated, "2026-10-22")).toBe(true);
    expect(habitActiveOn(dated, "2026-10-23")).toBe(false);
    expect(
      habitDayState({ habit: dated, date: "2026-10-19", today: "2026-10-23", hasAnyRecord: true }),
    ).toBe("unscheduled");
    expect(
      habitDayState({ habit: dated, date: "2026-10-23", today: "2026-10-23", hasAnyRecord: true }),
    ).toBe("unscheduled");
  });

  it("excludes no-record slots from the habit rate", () => {
    const week = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    const completions = [
      { habit_id: "h1", log_date: "2026-10-19", completed: true },
    ] as HabitCompletion[];
    const summary = habitWeekSummary({
      habit,
      week,
      today: "2026-10-23",
      completions,
      hasRecordByDate: new Set(["2026-10-19", "2026-10-20"]),
    });
    // Mon/Wed are scheduled and elapsed; Tue has a record and is missed.
    expect(summary).toMatchObject({ scheduled: 3, completed: 1, missed: 1, noRecord: 1 });
    expect(summary.percent).toBeCloseTo(50);
  });
});

describe("evidence highlights", () => {
  it("returns no highlight when no evidence exists and avoids duplicating one day", () => {
    expect(bestAndHardestDays([])).toEqual({ best: null, hardest: null });
    expect(
      bestAndHardestDays([{ date: "2026-10-23", score: 50, evidence: ["completed check-in"] }]),
    ).toEqual({
      best: { date: "2026-10-23", score: 50, reason: "completed check-in" },
      hardest: null,
    });
  });
});
