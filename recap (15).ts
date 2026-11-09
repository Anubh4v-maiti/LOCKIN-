import {
  type DateKey,
  type MonthKey,
  addMonths,
  eachDate,
  endOfMonthKey,
  formatDate,
  formatMonth,
  startOfMonthKey,
  startOfWeek,
} from "@/lib/date";
import {
  averageRecorded,
  bestAndHardestDays,
  checkinStreaks,
  dailyCompletionScore,
  dayEvidenceScore,
  evaluateTargets,
  habitActiveOn,
  nutritionCompletion,
  nutritionTotals,
  percentOf,
  resolveTargets,
  round,
  taskConsistency,
  taskStats,
  weekCheckinCounts,
} from "@/lib/metrics";
import type { RangeData } from "@/lib/queries";
import type {
  DailyReflection,
  DailyTask,
  Habit,
  HabitCompletion,
  MonthlyNarrative,
  MonthlyRecapStats,
  NutritionEntry,
  RecapObstacle,
  TargetVersion,
  WaterLog,
} from "@/lib/types";

export interface RecapInput {
  month: MonthKey;
  today: DateKey;
  weekStartsOn: 0 | 1;
  targets: TargetVersion[];
  data: RangeData;
  habits: Habit[];
}

function byDate<T extends { log_date: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.log_date, row]));
}

function macroAverages(nutrition: NutritionEntry[], days: DateKey[]) {
  const set = new Set(days);
  const rows = nutrition.filter((n) => set.has(n.log_date));
  return {
    avg_calories: round(averageRecorded(rows.map((n) => n.calories)), 0),
    avg_protein_g: round(averageRecorded(rows.map((n) => n.protein_g)), 0),
    avg_carbs_g: round(averageRecorded(rows.map((n) => n.carbs_g)), 0),
    avg_fat_g: round(averageRecorded(rows.map((n) => n.fat_g)), 0),
    avg_fiber_g: round(averageRecorded(rows.map((n) => n.fiber_g)), 0),
  };
}

function habitMonthStats(input: {
  habits: Habit[];
  completions: HabitCompletion[];
  days: DateKey[];
  recordDates: Set<DateKey>;
}) {
  const completionSet = new Set(
    input.completions.filter((c) => c.completed).map((c) => `${c.habit_id}:${c.log_date}`),
  );
  let scheduled = 0;
  let completed = 0;
  let missed = 0;
  let noRecord = 0;
  for (const habit of input.habits) {
    for (const day of input.days) {
      if (!habitActiveOn(habit, day)) continue;
      const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
      if (!habit.schedule_days.includes(dow)) continue;
      scheduled += 1;
      if (completionSet.has(`${habit.id}:${day}`)) {
        completed += 1;
      } else if (input.recordDates.has(day)) {
        missed += 1;
      } else {
        noRecord += 1;
      }
    }
  }
  return {
    scheduled,
    completed,
    noRecord,
    missed,
    // Unexamined slots are excluded from the rate rather than counted as failures.
    rate: completed + missed ? (completed / (completed + missed)) * 100 : null,
  };
}

function computeCore(input: RecapInput): MonthlyRecapStats {
  const { month, targets, data, habits } = input;
  const start = startOfMonthKey(month);
  const end = endOfMonthKey(month);
  const allDays = eachDate(start, end);
  const effectiveEnd = end < input.today ? end : input.today;
  const elapsedDays = allDays.filter((d) => d <= effectiveEnd);
  const daysSet = new Set(elapsedDays);

  const logs = data.logs.filter((l) => daysSet.has(l.log_date));
  const reflections = data.reflections.filter((r) => daysSet.has(r.log_date));
  const nutrition = data.nutrition.filter((n) => daysSet.has(n.log_date));
  const water = data.water.filter((w) => daysSet.has(w.log_date));
  const tasks = data.tasks.filter((t) => daysSet.has(t.log_date));
  const study = data.study.filter((s) => daysSet.has(s.log_date));
  const completions = data.habitCompletions.filter((c) => daysSet.has(c.log_date));

  const logMap = byDate(logs);
  const nutritionMap = byDate(nutrition);
  const waterMap = byDate(water);
  const reflectionMap = byDate(reflections);
  const tasksByDate = new Map<string, DailyTask[]>();
  for (const task of tasks) tasksByDate.set(task.log_date, [...(tasksByDate.get(task.log_date) ?? []), task]);
  const studyByDate = new Map<string, number>();
  for (const session of study) {
    studyByDate.set(session.log_date, (studyByDate.get(session.log_date) ?? 0) + session.minutes);
  }

  const checkinDays = logs.filter((l) => l.checkin_status === "complete");
  const partialDays = logs.filter((l) => l.checkin_status === "partial");
  const checkinDates = new Set(checkinDays.map((l) => l.log_date));

  const recordDates = new Set<DateKey>([
    ...logs.map((l) => l.log_date),
    ...nutrition.map((n) => n.log_date),
    ...water.map((w) => w.log_date),
    ...tasks.map((t) => t.log_date),
    ...study.map((s) => s.log_date),
    ...reflections.map((r) => r.log_date),
    ...completions.map((c) => c.log_date),
  ]);

  const plannedTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;

  const targetMet = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: 0,
    study: 0,
    tasks: 0,
  };
  const eligible = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: 0,
    study: 0,
    tasks: 0,
  };

  const scoredDays: { date: DateKey; score: number; evidence: string[] }[] = [];

  for (const day of elapsedDays) {
    const version = resolveTargets(targets, day);
    const n = nutritionMap.get(day) ?? null;
    const totals = n ? nutritionTotals(n) : null;
    const waterMl = waterMap.get(day)?.total_ml ?? null;
    const dayTasks = tasksByDate.get(day) ?? [];
    const stats = taskStats(dayTasks);
    const studyMinutes = studyByDate.get(day) ?? null;
    const t = version
      ? {
          calories: version.calories,
          protein_g: version.protein_g,
          carbs_g: version.carbs_g,
          fat_g: version.fat_g,
          fiber_g: version.fiber_g,
          water_ml: version.water_ml,
          study_minutes: version.study_minutes,
        }
      : null;
    const evaluated = evaluateTargets({
      nutrition: totals,
      targets: t,
      waterMl,
      studyMinutes,
      tasksPlanned: stats.total,
      tasksCompleted: stats.completed,
    });

    for (const key of ["calories", "protein", "carbs", "fat"] as const) {
      if (evaluated[key] !== null) {
        eligible[key] += 1;
        if (evaluated[key]) targetMet[key] += 1;
      }
    }
    if (evaluated.water !== null) {
      eligible.water += 1;
      if (evaluated.water) targetMet.water += 1;
    }
    if (evaluated.study !== null) {
      eligible.study += 1;
      if (evaluated.study) targetMet.study += 1;
    }
    if (evaluated.tasks !== null) {
      eligible.tasks += 1;
      if (evaluated.tasks) targetMet.tasks += 1;
    }

    if (recordDates.has(day)) {
      const nutritionPct = nutritionCompletion(totals, t);
      const evidence = dayEvidenceScore({
        checkinStatus: logMap.get(day)?.checkin_status ?? "none",
        taskRate: stats.percent,
        nutritionPct,
        waterPct: percentOf(waterMl, t?.water_ml ?? null),
      });
      if (evidence.score > 0) {
        scoredDays.push({ date: day, score: evidence.score, evidence: evidence.evidence });
      }
    }
  }

  const weeks = weekCheckinCounts(allDays, checkinDates, input.weekStartsOn)
    .map((week) => {
      const weekDays = eachDate(week.start, addDays(week.start, 6)).filter(
        (d) => d >= start && d <= effectiveEnd,
      );
      return {
        ...week,
        elapsed: weekDays.length,
      };
    })
    .filter((w) => w.elapsed > 0);
  const strongest = weeks.length
    ? [...weeks].sort((a, b) => b.checkins / b.elapsed - a.checkins / a.elapsed || b.checkins - a.checkins)[0]
    : null;
  const weakest = weeks.length
    ? [...weeks].sort((a, b) => a.checkins / a.elapsed - b.checkins / b.elapsed || a.checkins - b.checkins)[0]
    : null;

  const streak = checkinStreaks(
    checkinDays.map((l) => l.log_date),
    effectiveEnd,
  );
  const studyMinutes = study.reduce((sum, s) => sum + s.minutes, 0);
  const habitStats = habitMonthStats({
    habits: habits.filter((h) => h.active || completions.some((c) => c.habit_id === h.id)),
    completions,
    days: elapsedDays,
    recordDates,
  });
  const consistency = taskConsistency(tasks);
  const bestHardest = bestAndHardestDays(scoredDays);

  const notes = {
    wins: reflections.map((r) => r.win?.trim()).filter((v): v is string => Boolean(v)).slice(0, 10),
    mistakes: reflections
      .map((r) => r.mistake?.trim())
      .filter((v): v is string => Boolean(v))
      .slice(0, 10),
    improvements: reflections
      .map((r) => r.improvement?.trim())
      .filter((v): v is string => Boolean(v))
      .slice(0, 10),
    ratings: reflections
      .map((r) => r.rating)
      .filter((v): v is number => typeof v === "number"),
  };

  const warnings: string[] = [];
  const missingCheckins = elapsedDays.length - checkinDays.length;
  if (missingCheckins > 0) {
    warnings.push(
      `${missingCheckins} of ${elapsedDays.length} elapsed days had no completed check-in. Missing days are excluded from averages.`,
    );
  }
  if (partialDays.length > 0) {
    warnings.push(`${partialDays.length} partial check-in ${partialDays.length === 1 ? "draft was" : "drafts were"} not counted as completed.`);
  }
  if (nutrition.length > 0 && nutrition.length < elapsedDays.length) {
    warnings.push(
      `Nutrition averages use ${nutrition.length} recorded ${nutrition.length === 1 ? "day" : "days"}, not the full month.`,
    );
  }
  if (water.length > 0 && water.length < elapsedDays.length) {
    warnings.push(
      `Water averages use ${water.length} recorded ${water.length === 1 ? "day" : "days"}, not the full month.`,
    );
  }
  if (
    logs.length === 0 &&
    nutrition.length === 0 &&
    water.length === 0 &&
    tasks.length === 0 &&
    study.length === 0 &&
    completions.length === 0 &&
    reflections.length === 0
  ) {
    warnings.push("No meaningful records exist for this month yet.");
  }

  return {
    month,
    start_date: start,
    end_date: end,
    total_days: allDays.length,
    elapsed_days: elapsedDays.length,
    checkin_days: checkinDays.length,
    partial_days: partialDays.length,
    nutrition_days: nutrition.length,
    water_days: water.length,
    task_days: tasksByDate.size,
    planned_tasks: plannedTasks,
    completed_tasks: completedTasks,
    task_completion_rate: plannedTasks ? (completedTasks / plannedTasks) * 100 : null,
    ...macroAverages(nutrition, elapsedDays),
    avg_water_ml: round(averageRecorded(water.map((w) => w.total_ml)), 0),
    target_met: targetMet,
    eligible_target_days: eligible,
    longest_streak: streak.best,
    current_streak_at_end: streak.current,
    study_minutes: studyMinutes,
    study_sessions: study.length,
    study_days: studyByDate.size,
    habit_scheduled: habitStats.scheduled,
    habit_completed: habitStats.completed,
    habit_missed: habitStats.missed,
    habit_no_record: habitStats.noRecord,
    habit_completion_rate: habitStats.rate,
    strongest_week: strongest
      ? {
          start: strongest.start,
          checkins: strongest.checkins,
          label: weekLabel(strongest.start, strongest.elapsed, input.weekStartsOn),
        }
      : null,
    weakest_week: weakest
      ? {
          start: weakest.start,
          checkins: weakest.checkins,
          label: weekLabel(weakest.start, weakest.elapsed, input.weekStartsOn),
        }
      : null,
    best_day: bestHardest.best,
    hardest_day: bestHardest.hardest,
    frequent_tasks: consistency.frequent,
    incomplete_tasks: consistency.incomplete,
    notes,
    previous: null,
    warnings,
  };
}

function addDays(date: DateKey, amount: number): DateKey {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function weekLabel(start: DateKey, elapsed: number, weekStartsOn: 0 | 1): string {
  const aligned = startOfWeek(start, weekStartsOn);
  return `${formatDate(aligned, "MMM d")} – ${formatDate(addDays(aligned, elapsed - 1), "MMM d")}`;
}

export function computeMonthlyStats(input: RecapInput, previous?: MonthlyRecapStats | null): MonthlyRecapStats {
  const stats = computeCore(input);
  if (!previous) return stats;
  return {
    ...stats,
    previous: {
      month: previous.month,
      checkin_days: previous.checkin_days,
      avg_calories: previous.avg_calories,
      avg_protein_g: previous.avg_protein_g,
      avg_water_ml: previous.avg_water_ml,
      task_completion_rate: previous.task_completion_rate,
      study_minutes: previous.study_days ? previous.study_minutes : null,
      habit_completion_rate: previous.habit_completion_rate,
    },
  };
}

function pct(n: number | null): string {
  return n === null ? "no eligible days" : `${Math.round(n)}%`;
}

function changeLine(
  label: string,
  current: number | null,
  previous: number | null,
  unit = "",
  digits = 0,
): string | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return `${label} held steady at ${Math.round(current)}${unit}.`;
  const direction = delta > 0 ? "up" : "down";
  return `${label} was ${direction} ${Math.abs(Math.round(delta * 10 ** digits) / 10 ** digits)}${unit} versus last month.`;
}

const REFLECTION_PATTERNS: { pattern: RegExp; label: string; suggestion: string }[] = [
  { pattern: /procrastinat/i, label: "procrastination", suggestion: "Choose the smallest first action for the task you are avoiding." },
  { pattern: /distract/i, label: "distractions", suggestion: "Remove one obvious distraction before the first focus block." },
  { pattern: /(phone|social media|instagram|tiktok|scroll)/i, label: "phone or social media use", suggestion: "Keep the phone out of reach during the first 25-minute block." },
  { pattern: /(sleep|tired|late night|insomnia)/i, label: "sleep or late nights", suggestion: "Set a fixed lights-out time before adding more daily tasks." },
  { pattern: /(overwhelm|too many|overload|busy)/i, label: "overloaded days", suggestion: "Cap the daily list at three must-do tasks." },
  { pattern: /(youtube|netflix|gaming|game|tv)/i, label: "screen time", suggestion: "Schedule screen time after the evening check-in, not before it." },
];

export function buildNarrative(stats: MonthlyRecapStats): MonthlyNarrative {
  const monthName = formatMonth(stats.month);
  const elapsed = stats.elapsed_days;
  const checkinPct = elapsed ? (stats.checkin_days / elapsed) * 100 : null;
  const hasRecords =
    stats.checkin_days > 0 ||
    stats.nutrition_days > 0 ||
    stats.water_days > 0 ||
    stats.planned_tasks > 0 ||
    stats.study_minutes > 0 ||
    stats.habit_completed > 0 ||
    stats.notes.wins.length > 0 ||
    stats.notes.mistakes.length > 0 ||
    stats.notes.improvements.length > 0 ||
    stats.notes.ratings.length > 0;

  const summaryParts: string[] = [];
  if (!hasRecords) {
    summaryParts.push(
      `There are no meaningful records saved for ${monthName}. This recap is intentionally empty rather than estimated.`,
    );
  } else {
    summaryParts.push(
      `In ${monthName}, you completed ${stats.checkin_days} of ${elapsed} elapsed daily check-ins (${pct(checkinPct)}).`,
    );
    if (stats.planned_tasks > 0) {
      summaryParts.push(
        `You completed ${stats.completed_tasks} of ${stats.planned_tasks} planned tasks (${pct(stats.task_completion_rate)}).`,
      );
    }
    if (stats.nutrition_days > 0) {
      const calorieText =
        stats.avg_calories === null ? "no recorded calorie values" : `${Math.round(stats.avg_calories)} kcal`;
      const proteinText =
        stats.avg_protein_g === null ? "no recorded protein values" : `${Math.round(stats.avg_protein_g)} g protein`;
      summaryParts.push(
        `Nutrition was recorded on ${stats.nutrition_days} days; recorded-day averages were ${calorieText} and ${proteinText}.`,
      );
    }
    if (stats.water_days > 0) {
      const waterText =
        stats.avg_water_ml === null ? "no recorded total" : `${(stats.avg_water_ml / 1000).toFixed(1)} L`;
      summaryParts.push(`Water was recorded on ${stats.water_days} days, averaging ${waterText}.`);
    }
    if (stats.study_minutes > 0) {
      summaryParts.push(`Study totalled ${Math.round(stats.study_minutes / 60 * 10) / 10} focused hours.`);
    }
    summaryParts.push(
      "All figures come from saved records. Missing values are treated as missing, never as zero.",
    );
  }

  const comparisonLines = stats.previous
    ? [
        changeLine("Check-in days", stats.checkin_days, stats.previous.checkin_days),
        changeLine("Task completion", stats.task_completion_rate, stats.previous.task_completion_rate, "%"),
        changeLine("Recorded-day calories", stats.avg_calories, stats.previous.avg_calories, " kcal"),
        changeLine("Recorded-day water", stats.avg_water_ml, stats.previous.avg_water_ml, " ml"),
        changeLine(
          "Study minutes",
          stats.study_days ? stats.study_minutes : null,
          stats.previous.study_minutes,
          " min",
        ),
      ].filter((line): line is string => Boolean(line))
    : [];

  const wins: string[] = [];
  if (stats.longest_streak >= 2) {
    wins.push(`Your longest check-in streak within the month was ${stats.longest_streak} days.`);
  }
  if (stats.completed_tasks > 0) {
    wins.push(`You finished ${stats.completed_tasks} planned tasks.`);
  }
  const metFacts: string[] = [];
  if ((stats.target_met.water ?? 0) > 0) metFacts.push(`water on ${stats.target_met.water} days`);
  if ((stats.target_met.protein ?? 0) > 0) metFacts.push(`protein on ${stats.target_met.protein} days`);
  if ((stats.target_met.calories ?? 0) > 0) metFacts.push(`calorie range on ${stats.target_met.calories} days`);
  if (metFacts.length) wins.push(`You met your ${metFacts.join(", ")}.`);
  if (stats.study_minutes >= 60) {
    wins.push(`You logged ${Math.round((stats.study_minutes / 60) * 10) / 10} hours of study across ${stats.study_days} days.`);
  }
  if (stats.habit_completed > 0) {
    wins.push(`You completed ${stats.habit_completed} scheduled habit ${stats.habit_completed === 1 ? "day" : "days"}.`);
  }
  if (stats.notes.wins.length > 0) {
    wins.push(`From your own notes: “${truncateText(stats.notes.wins[0], 180)}”`);
  }
  if (wins.length === 0) {
    wins.push("Recording honestly is the first win. There was not enough evidence for a larger achievement claim.");
  }

  const obstacles: RecapObstacle[] = [];
  if (stats.task_completion_rate !== null && stats.task_completion_rate < 80 && stats.planned_tasks >= 5) {
    obstacles.push({
      observed: `${stats.completed_tasks} of ${stats.planned_tasks} planned tasks were completed (${pct(stats.task_completion_rate)}).`,
      possible:
        stats.task_days > 0 && stats.planned_tasks / stats.task_days > 5
          ? "Possible: the daily list was longer than the available time. This is a hypothesis, not a stated cause."
          : undefined,
    });
  }
  if (stats.incomplete_tasks.length > 0) {
    const top = stats.incomplete_tasks[0];
    obstacles.push({
      observed: `“${top.title}” was planned ${top.total} times and left incomplete ${top.missed} times.`,
    });
  }
  if (stats.eligible_target_days.water > 0 && (stats.target_met.water ?? 0) / stats.eligible_target_days.water < 0.6) {
    obstacles.push({
      observed: `The water target was met on ${stats.target_met.water} of ${stats.eligible_target_days.water} eligible recorded days.`,
    });
  }
  if (stats.eligible_target_days.calories > 0 && (stats.target_met.calories ?? 0) / stats.eligible_target_days.calories < 0.5) {
    obstacles.push({
      observed: `The calorie range was met on ${stats.target_met.calories} of ${stats.eligible_target_days.calories} eligible recorded days.`,
    });
  }
  if (elapsed - stats.checkin_days >= 5) {
    obstacles.push({
      observed: `${elapsed - stats.checkin_days} days had no completed check-in.`,
      possible: "Possible: the evening routine was not reachable on those days. No cause is assumed.",
    });
  }

  const reflectionsText = [...stats.notes.mistakes, ...stats.notes.improvements];
  for (const item of REFLECTION_PATTERNS) {
    const count = reflectionsText.filter((text) => item.pattern.test(text)).length;
    if (count >= 2) {
      obstacles.push({
        observed: `Your saved reflections mention ${item.label} on ${count} days.`,
      });
    }
  }
  if (obstacles.length === 0) {
    obstacles.push({
      observed: "No repeated obstacle could be identified from the saved records this month.",
    });
  }

  const lowAreas: { label: string; score: number }[] = [];
  if (stats.task_completion_rate !== null) lowAreas.push({ label: "task completion", score: stats.task_completion_rate });
  if (stats.eligible_target_days.water > 0) {
    lowAreas.push({
      label: "hydration consistency",
      score: ((stats.target_met.water ?? 0) / stats.eligible_target_days.water) * 100,
    });
  }
  if (stats.eligible_target_days.study > 0) {
    lowAreas.push({
      label: "study consistency",
      score: ((stats.target_met.study ?? 0) / stats.eligible_target_days.study) * 100,
    });
  }
  if (stats.habit_scheduled > 0 && stats.habit_completion_rate !== null) {
    lowAreas.push({ label: "habit consistency", score: stats.habit_completion_rate });
  }
  lowAreas.sort((a, b) => a.score - b.score);

  const continueList: string[] = [];
  if (stats.longest_streak >= 2) continueList.push(`Keep the check-in ritual that produced a ${stats.longest_streak}-day streak.`);
  else continueList.push("Keep showing up for the nightly check-in, even in quick mode.");
  if (stats.frequent_tasks.length > 0) {
    const top = [...stats.frequent_tasks].sort((a, b) => b.completed - a.completed)[0];
    continueList.push(`Keep “${top.title}” in the routine; it was completed ${top.completed} of ${top.total} times.`);
  }
  if (stats.study_minutes > 0) continueList.push("Keep the study blocks that are already producing recorded minutes.");
  if (stats.habit_completed > 0) continueList.push("Keep the habits that are already scheduled and completed.");
  if (continueList.length < 3) continueList.push("Keep recording end-of-day totals instead of trying to log every event in real time.");
  if (continueList.length < 3) continueList.push("Keep using the same evening trigger so the check-in is easy to remember.");

  const improveList: string[] = [];
  for (const area of lowAreas.slice(0, 2)) {
    if (area.score < 80) {
      if (area.label === "task completion") improveList.push("Plan fewer tasks per day and finish the important ones first.");
      else if (area.label === "hydration consistency") improveList.push("Attach water to two fixed moments so the target is not left for the evening.");
      else if (area.label === "study consistency") improveList.push("Protect one short, repeatable study block rather than aiming for a perfect long session.");
      else if (area.label === "habit consistency") improveList.push("Reduce the number of scheduled habits to the ones that matter most right now.");
    }
  }
  if (elapsed - stats.checkin_days > 2) improveList.push("Use the quick check-in on busy nights instead of skipping the record entirely.");
  if (stats.nutrition_days < elapsed / 2) improveList.push("Save final nutrition totals even when the day was imperfect.");
  while (improveList.length < 3) {
    improveList.push(
      improveList.length === 0
        ? "Set one clear, realistic target before trying to optimise several areas at once."
        : "Review this report at the start of next month and adjust one thing only.",
    );
  }

  const simplify: string[] = [];
  if (stats.task_days > 0 && stats.planned_tasks / stats.task_days > 5) {
    simplify.push("Cap the daily list at three must-do tasks; everything else is optional.");
  }
  if (checkinPct !== null && checkinPct < 70) {
    simplify.push("Use quick check-in mode on weekdays and the full reflection when you have more time.");
  }
  if (stats.habit_scheduled > 14) {
    simplify.push("Run fewer habits concurrently so each one has a real chance of repeating.");
  }
  while (simplify.length < 2) {
    simplify.push(
      simplify.length === 0
        ? "Keep one evening trigger for tracking: same time, same place, two minutes."
        : "Prefer end-of-day totals over real-time logging to reduce friction.",
    );
  }

  const nextMonth = addMonths(stats.month, 1);
  const nextMonthDays = eachDate(startOfMonthKey(nextMonth), endOfMonthKey(nextMonth)).length;
  const currentPct = checkinPct ?? 0;
  const targetPct = Math.min(95, Math.max(40, Math.round(currentPct + 8)));
  const targetDays = Math.max(1, Math.round((nextMonthDays * targetPct) / 100));
  const consistencyTarget = hasRecords
    ? `Aim for ${targetDays} completed check-ins in ${formatMonth(nextMonth)} (about ${targetPct}% of ${nextMonthDays} days). This is a modest step above the ${Math.round(currentPct)}% pace recorded this month.`
    : `Aim for 8 completed check-ins in ${formatMonth(nextMonth)}. Establishing the record matters more than the number.`;

  let focus: string;
  if (!hasRecords) focus = "Build the recording habit before adding more targets.";
  else if (lowAreas.length > 0 && lowAreas[0].score < 70) {
    focus =
      lowAreas[0].label === "task completion"
        ? "Primary focus: protect a smaller, finishable daily plan."
        : lowAreas[0].label === "hydration consistency"
          ? "Primary focus: make hydration automatic."
          : lowAreas[0].label === "study consistency"
            ? "Primary focus: rebuild one repeatable study block."
            : "Primary focus: make the most important habit repeatable.";
  } else if (checkinPct !== null && checkinPct < 80) {
    focus = "Primary focus: make the nightly check-in unmissable.";
  } else {
    focus = "Primary focus: protect the routine that is already working and raise one target slightly.";
  }

  return {
    summary: [summaryParts.join(" "), ...comparisonLines].join(" "),
    wins: wins.slice(0, 5),
    obstacles,
    plan: {
      continue: continueList.slice(0, 3),
      improve: improveList.slice(0, 3),
      simplify: simplify.slice(0, 2),
      consistency_target: consistencyTarget,
      focus,
    },
    generated_by: "deterministic",
  };
}

function truncateText(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function recapCsv(stats: MonthlyRecapStats, narrative: MonthlyNarrative): string {
  const rows: (string | number | null)[][] = [
    ["Month", formatMonth(stats.month)],
    ["Total calendar days", stats.total_days],
    ["Elapsed days", stats.elapsed_days],
    ["Completed check-ins", stats.checkin_days],
    ["Partial check-ins", stats.partial_days],
    ["Nutrition record days", stats.nutrition_days],
    ["Water record days", stats.water_days],
    ["Task days", stats.task_days],
    ["Planned tasks", stats.planned_tasks],
    ["Completed tasks", stats.completed_tasks],
    ["Task completion rate", stats.task_completion_rate === null ? "" : `${Math.round(stats.task_completion_rate)}%`],
    ["Average calories (recorded days)", stats.avg_calories ?? ""],
    ["Average protein g (recorded days)", stats.avg_protein_g ?? ""],
    ["Average carbs g (recorded days)", stats.avg_carbs_g ?? ""],
    ["Average fat g (recorded days)", stats.avg_fat_g ?? ""],
    ["Average water ml (recorded days)", stats.avg_water_ml ?? ""],
    ["Days calorie target met", stats.target_met.calories],
    ["Days protein target met", stats.target_met.protein],
    ["Days water target met", stats.target_met.water],
    ["Longest check-in streak", stats.longest_streak],
    ["Study minutes", stats.study_days ? stats.study_minutes : ""],
    ["Habit completion rate", stats.habit_completion_rate === null ? "" : `${Math.round(stats.habit_completion_rate)}%`],
    [],
    ["Summary", narrative.summary],
    ["Primary focus", narrative.plan.focus],
    ["Consistency target", narrative.plan.consistency_target],
    [],
    ["Wins"],
    ...narrative.wins.map((w) => ["", w]),
    [],
    ["Observed obstacles"],
    ...narrative.obstacles.map((o) => ["", o.observed]),
    [],
    ["Continue"],
    ...narrative.plan.continue.map((c) => ["", c]),
    ["Improve"],
    ...narrative.plan.improve.map((c) => ["", c]),
  ];
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null || cell === undefined ? "" : String(cell);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}
