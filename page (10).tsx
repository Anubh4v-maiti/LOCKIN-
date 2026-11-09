import Link from "next/link";
import {
  Apple,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Info,
  ListTodo,
  Repeat2,
  Timer,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchHabits, fetchRange, fetchTargetVersions } from "@/lib/queries";
import {
  addDays,
  addMonths,
  eachDate,
  endOfWeek,
  formatDate,
  startOfWeek,
  type DateKey,
} from "@/lib/date";
import {
  averageRecorded,
  bestAndHardestDays,
  checkinStreaks,
  dayEvidenceScore,
  evaluateTargets,
  habitActiveOn,
  habitDayState,
  macroTargets,
  nutritionCompletion,
  nutritionTotals,
  percentOf,
  resolveTargets,
  round,
} from "@/lib/metrics";
import { cn, formatMl, formatNumber, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/misc";
import { TrendChart, BarTrendChart } from "@/components/charts/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const PERIODS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
] as const;

function sumRecorded(values: Array<number | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const period = PERIODS.some((item) => String(item.value) === params.period)
    ? Number(params.period)
    : 30;
  const start = addDays(today, -(period - 1));
  const previousStart = addDays(start, -period);
  const previousEnd = addDays(start, -1);

  const [range, previousRange, targetVersions, habits] = await Promise.all([
    fetchRange(supabase, userId, start, today),
    fetchRange(supabase, userId, previousStart, previousEnd),
    fetchTargetVersions(supabase, userId),
    fetchHabits(supabase, userId, true),
  ]);

  const days = eachDate(start, today);
  const logs = new Map(range.logs.map((row) => [row.log_date, row]));
  const reflections = new Map(range.reflections.map((row) => [row.log_date, row]));
  const nutrition = new Map(range.nutrition.map((row) => [row.log_date, row]));
  const water = new Map(range.water.map((row) => [row.log_date, row]));
  const study = new Map<string, number>();
  const studySessions = new Map<string, number>();
  for (const session of range.study) {
    study.set(session.log_date, (study.get(session.log_date) ?? 0) + session.minutes);
    studySessions.set(session.log_date, (studySessions.get(session.log_date) ?? 0) + 1);
  }
  const tasks = new Map<string, { total: number; completed: number }>();
  for (const task of range.tasks) {
    const existing = tasks.get(task.log_date) ?? { total: 0, completed: 0 };
    existing.total += 1;
    if (task.completed) existing.completed += 1;
    tasks.set(task.log_date, existing);
  }
  const completions = new Map<string, Set<string>>();
  for (const completion of range.habitCompletions) {
    const existing = completions.get(completion.log_date) ?? new Set<string>();
    existing.add(completion.habit_id);
    completions.set(completion.log_date, existing);
  }

  const recordedDates = new Set<string>();
  for (const date of days) {
    if (
      logs.has(date) ||
      reflections.has(date) ||
      nutrition.has(date) ||
      water.has(date) ||
      tasks.has(date) ||
      study.has(date) ||
      completions.has(date)
    ) {
      recordedDates.add(date);
    }
  }

  const completedDates = days.filter((date) => logs.get(date)?.checkin_status === "complete");
  const partialDays = days.filter((date) => logs.get(date)?.checkin_status === "partial").length;
  const streak = checkinStreaks(completedDates, today);
  const taskTotals = {
    planned: days.reduce((sum, date) => sum + (tasks.get(date)?.total ?? 0), 0),
    completed: days.reduce((sum, date) => sum + (tasks.get(date)?.completed ?? 0), 0),
  };
  const taskRate = taskTotals.planned ? (taskTotals.completed / taskTotals.planned) * 100 : null;
  const nutritionRows = days.map((date) => nutrition.get(date)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const nutritionDays = nutritionRows.length;
  const avgCalories = round(averageRecorded(nutritionRows.map((row) => row.calories)), 0);
  const avgProtein = round(averageRecorded(nutritionRows.map((row) => row.protein_g)), 0);
  const waterRows = days.map((date) => water.get(date)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const waterDays = waterRows.length;
  const avgWater = round(averageRecorded(waterRows.map((row) => row.total_ml)), 0);
  const studyDays = days.filter((date) => study.has(date));
  const recordedStudyTotal = sumRecorded(days.map((date) => study.get(date) ?? null));
  const studyTotal = studyDays.length ? recordedStudyTotal : null;
  const avgStudy = studyDays.length ? round(recordedStudyTotal / studyDays.length, 0) : null;

  const targetFlags = {
    calories: { met: 0, eligible: 0 },
    protein: { met: 0, eligible: 0 },
    carbs: { met: 0, eligible: 0 },
    fat: { met: 0, eligible: 0 },
    fiber: { met: 0, eligible: 0 },
    water: { met: 0, eligible: 0 },
    study: { met: 0, eligible: 0 },
    tasks: { met: 0, eligible: 0 },
  };
  for (const date of days) {
    const version = resolveTargets(targetVersions, date);
    const goals = macroTargets(version);
    const row = nutrition.get(date) ?? null;
    const nutritionTargets = evaluateTargets({
      nutrition: nutritionTotals(row),
      targets: goals,
      waterMl: null,
    });
    for (const key of ["calories", "protein", "carbs", "fat", "fiber"] as const) {
      const value = nutritionTargets[key];
      if (value !== null) {
        targetFlags[key].eligible += 1;
        if (value) targetFlags[key].met += 1;
      }
    }
    const waterValue = water.get(date)?.total_ml ?? null;
    if (waterValue !== null && goals.water_ml !== null) {
      targetFlags.water.eligible += 1;
      if (waterValue >= goals.water_ml) targetFlags.water.met += 1;
    }
    const studyValue = study.get(date) ?? null;
    if (studyValue !== null && goals.study_minutes !== null) {
      targetFlags.study.eligible += 1;
      if (studyValue >= goals.study_minutes) targetFlags.study.met += 1;
    }
    const taskInfo = tasks.get(date);
    if (taskInfo?.total) {
      targetFlags.tasks.eligible += 1;
      if (taskInfo.completed >= taskInfo.total) targetFlags.tasks.met += 1;
    }
  }

  const habitScheduled: DateKey[] = [];
  let habitCompleted = 0;
  let habitMissed = 0;
  let habitNoRecord = 0;
  for (const date of days) {
    const done = completions.get(date) ?? new Set<string>();
    for (const habit of habits) {
      if (!habitActiveOn(habit, date)) continue;
      if (!habit.schedule_days.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue;
      habitScheduled.push(date);
      if (done.has(habit.id)) habitCompleted += 1;
      else if (recordedDates.has(date)) habitMissed += 1;
      else habitNoRecord += 1;
    }
  }
  const habitRecordedScheduled = habitCompleted + habitMissed;

  const evidenceDays = days
    .filter((date) => recordedDates.has(date))
    .map((date) => {
      const taskInfo = tasks.get(date);
      const nutritionPct = nutritionCompletion(
        nutritionTotals(nutrition.get(date) ?? null),
        macroTargets(resolveTargets(targetVersions, date)),
      );
      const goals = macroTargets(resolveTargets(targetVersions, date));
      const waterPct = percentOf(water.get(date)?.total_ml ?? null, goals.water_ml);
      const evidence = dayEvidenceScore({
        checkinStatus: logs.get(date)?.checkin_status ?? "none",
        taskRate: taskInfo?.total ? (taskInfo.completed / taskInfo.total) * 100 : null,
        nutritionPct,
        waterPct,
      });
      return { date, ...evidence };
    });
  const highlight = bestAndHardestDays(evidenceDays);

  const weekly = new Map<
    DateKey,
    {
      start: DateKey;
      elapsed: number;
      checkins: number;
      taskPlanned: number;
      taskCompleted: number;
      calories: number[];
      water: number[];
      study: number | null;
      habitScheduled: number;
      habitCompleted: number;
      habitMissed: number;
    }
  >();
  for (const date of days) {
    const bucketStart = startOfWeek(date, profile.week_start);
    const bucket = weekly.get(bucketStart) ?? {
      start: bucketStart,
      elapsed: 0,
      checkins: 0,
      taskPlanned: 0,
      taskCompleted: 0,
      calories: [],
      water: [],
      study: null,
      habitScheduled: 0,
      habitCompleted: 0,
      habitMissed: 0,
    };
    bucket.elapsed += 1;
    if (logs.get(date)?.checkin_status === "complete") bucket.checkins += 1;
    const taskInfo = tasks.get(date);
    bucket.taskPlanned += taskInfo?.total ?? 0;
    bucket.taskCompleted += taskInfo?.completed ?? 0;
    const nutritionRow = nutrition.get(date);
    if (nutritionRow?.calories !== null && nutritionRow?.calories !== undefined) bucket.calories.push(nutritionRow.calories);
    const waterRow = water.get(date);
    if (waterRow) bucket.water.push(waterRow.total_ml);
    const studyValue = study.get(date);
    if (studyValue !== undefined) bucket.study = (bucket.study ?? 0) + studyValue;
    const done = completions.get(date) ?? new Set<string>();
    for (const habit of habits) {
      if (!habitActiveOn(habit, date)) continue;
      if (!habit.schedule_days.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue;
      bucket.habitScheduled += 1;
      if (done.has(habit.id)) bucket.habitCompleted += 1;
      else if (recordedDates.has(date)) bucket.habitMissed += 1;
    }
    weekly.set(bucketStart, bucket);
  }
  const weeklyRows = Array.from(weekly.values()).sort((a, b) => (a.start < b.start ? -1 : 1));
  const weeklyChart = weeklyRows.map((bucket) => ({
    label: formatDate(bucket.start, "MMM d"),
    checkins: bucket.elapsed ? (bucket.checkins / bucket.elapsed) * 100 : null,
    tasks: bucket.taskPlanned ? (bucket.taskCompleted / bucket.taskPlanned) * 100 : null,
    habits:
      bucket.habitCompleted + bucket.habitMissed > 0
        ? (bucket.habitCompleted / (bucket.habitCompleted + bucket.habitMissed)) * 100
        : null,
    calories: bucket.calories.length ? bucket.calories.reduce((a, b) => a + b, 0) / bucket.calories.length : null,
    water: bucket.water.length ? bucket.water.reduce((a, b) => a + b, 0) / bucket.water.length : null,
    study: bucket.study,
  }));

  const dailyChart = days.map((date) => {
    const score = evidenceDays.find((row) => row.date === date)?.score ?? null;
    return {
      label: formatDate(date, "MMM d"),
      score,
      calories: nutrition.get(date)?.calories ?? null,
      water: water.get(date)?.total_ml ?? null,
      study: study.get(date) ?? null,
    };
  });

  const previousLogs = new Set(previousRange.logs.filter((row) => row.checkin_status === "complete").map((row) => row.log_date));
  const previousNutrition = previousRange.nutrition.map((row) => row.calories);
  const previousWater = previousRange.water.map((row) => row.total_ml);
  const previousTasksPlanned = previousRange.tasks.length;
  const previousTasksCompleted = previousRange.tasks.filter((task) => task.completed).length;
  const previousStudy = previousRange.study.reduce((sum, session) => sum + session.minutes, 0);
  const comparison = {
    checkins: {
      current: completedDates.length,
      previous: previousLogs.size,
    },
    calories: {
      current: avgCalories,
      previous: round(averageRecorded(previousNutrition), 0),
    },
    water: {
      current: avgWater,
      previous: round(averageRecorded(previousWater), 0),
    },
    tasks: {
      current: taskRate,
      previous: previousTasksPlanned ? (previousTasksCompleted / previousTasksPlanned) * 100 : null,
    },
    study: {
      current: studyTotal,
      previous: previousRange.study.length ? previousStudy : null,
    },
  };

  const targetRows = [
    { key: "calories", label: "Calories in range (±10%)", value: targetFlags.calories, color: "#C5F467" },
    { key: "protein", label: "Protein at or above", value: targetFlags.protein, color: "#82B7FF" },
    { key: "carbs", label: "Carbs in range (±10%)", value: targetFlags.carbs, color: "#B6A5FF" },
    { key: "fat", label: "Fat in range (±10%)", value: targetFlags.fat, color: "#F5CE73" },
    { key: "fiber", label: "Fiber at or above", value: targetFlags.fiber, color: "#7EE7C1" },
    { key: "water", label: "Water target met", value: targetFlags.water, color: "#7EC8F5" },
    { key: "study", label: "Study target met", value: targetFlags.study, color: "#B6A5FF" },
    { key: "tasks", label: "All planned tasks done", value: targetFlags.tasks, color: "#FF9E9E" },
  ];

  const averageCoverage = days.length ? (recordedDates.size / days.length) * 100 : null;

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Evidence, not vibes."
        description={`${formatDate(start, "MMM d")} – ${formatDate(today, "MMM d, yyyy")}. Every denominator is visible; missing records are excluded rather than counted as failures.`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((item) => (
              <Button
                key={item.value}
                asChild
                size="sm"
                variant={period === item.value ? "default" : "outline"}
              >
                <Link href={`/analytics?period=${item.value}`}>{item.label}</Link>
              </Button>
            ))}
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Check-ins"
              value={`${completedDates.length}/${days.length}`}
              hint={`${pct((completedDates.length / days.length) * 100)} of elapsed days`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Data coverage"
              value={pct(averageCoverage)}
              hint={`${recordedDates.size} days with any record`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Tasks"
              value={taskRate === null ? "—" : pct(taskRate)}
              hint={taskTotals.planned ? `${taskTotals.completed} of ${taskTotals.planned}` : "Nothing planned"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Calories"
              value={avgCalories === null ? "—" : formatNumber(avgCalories)}
              suffix="kcal"
              hint={`${nutritionDays} recorded ${nutritionDays === 1 ? "day" : "days"}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Water"
              value={avgWater === null ? "—" : formatMl(avgWater)}
              hint={`${waterDays} recorded ${waterDays === 1 ? "day" : "days"}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Study"
              value={studyTotal === null ? "—" : formatNumber(studyTotal)}
              suffix={studyTotal === null ? undefined : "min"}
              hint={`${studyDays.length} recorded ${studyDays.length === 1 ? "day" : "days"}`}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Consistency over time
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Weekly check-in completion, task completion and habit completion. Missing evidence produces gaps.
            </p>
          </CardHeader>
          <CardContent>
            <BarTrendChart
              data={weeklyChart}
              series={[
                { key: "checkins", label: "Check-ins", color: "#C5F467" },
                { key: "tasks", label: "Tasks", color: "#82B7FF" },
                { key: "habits", label: "Habits", color: "#7EE7C1" },
              ]}
              unit="%"
              ariaLabel="Weekly consistency percentages"
              valueFormat="percent"
              yTickFormat="percent"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-secondary" /> Daily evidence score
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              A transparent 0–100 summary of saved evidence, not a judgment of your worth.
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={dailyChart}
              series={[{ key: "score", label: "Evidence score", color: "#C5F467" }]}
              variant="line"
              height={216}
              ariaLabel="Daily evidence score over the selected period"
              valueFormat="score"
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="size-4 text-[var(--chart-lime)]" /> Nutrition and water
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Recorded-day averages: calories and water are averaged only on days with a record.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TrendChart
              data={weeklyChart}
              series={[
                { key: "calories", label: "Avg calories", color: "#C5F467" },
              ]}
              height={190}
              unit=" kcal"
              ariaLabel="Average recorded calories by week"
              valueFormat="kcal"
            />
            <BarTrendChart
              data={weeklyChart}
              series={[{ key: "water", label: "Avg water (ml)", color: "#7EC8F5" }]}
              height={180}
              unit=" ml"
              ariaLabel="Average recorded water by week"
              valueFormat="water"
              yTickFormat="liters"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target achievement</CardTitle>
            <p className="text-xs text-muted-foreground">Eligible recorded days only. A null target or missing value is never a failure.</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {targetRows.map((row) => (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {row.value.eligible ? `${row.value.met}/${row.value.eligible}` : "—"}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.value.eligible ? (row.value.met / row.value.eligible) * 100 : 0}%`,
                      background: row.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" /> Check-in patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">{completedDates.length}</strong> completed check-ins and <strong className="text-foreground">{partialDays}</strong> draft-only days.</p>
            <p>Current streak: <strong className="text-foreground">{streak.current} days</strong>; best in this period: <strong className="text-foreground">{streak.best} days</strong>.</p>
            {completedDates.length === 0 ? (
              <p className="rounded-lg border border-border/60 bg-surface-2/30 px-2.5 py-2">
                No completed check-ins yet. Opening a page does not count; completing the check-in does.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat2 className="size-4 text-secondary" /> Habits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">{habitCompleted}</strong> completed, <strong className="text-foreground">{habitMissed}</strong> missed and <strong className="text-foreground">{habitNoRecord}</strong> unassessed scheduled slots.</p>
            <p>
              Completion rate:{" "}
              <strong className="text-foreground">
                {habitRecordedScheduled ? pct((habitCompleted / habitRecordedScheduled) * 100) : "—"}
              </strong>{" "}
              across recorded slots only.
            </p>
            <p>Current habit schedules are used to interpret historical dates; schedule edits are not versioned.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparison to previous period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Check-ins", current: comparison.checkins.current, previous: comparison.checkins.previous, format: (v: number) => `${v}` },
              { label: "Task completion", current: comparison.tasks.current, previous: comparison.tasks.previous, format: (v: number) => pct(v) },
              { label: "Calories / recorded day", current: comparison.calories.current, previous: comparison.calories.previous, format: (v: number) => `${formatNumber(v)} kcal` },
              { label: "Water / recorded day", current: comparison.water.current, previous: comparison.water.previous, format: (v: number) => formatMl(v) },
              { label: "Study minutes", current: comparison.study.current, previous: comparison.study.previous, format: (v: number) => `${formatNumber(v)} min` },
            ].map((row) => {
              const current = row.current;
              const previous = row.previous;
              const delta =
                current !== null && previous !== null && previous !== 0
                  ? ((current - previous) / Math.abs(previous)) * 100
                  : null;
              return (
                <div key={row.label} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="text-right">
                    <span className="font-semibold">{current === null ? "—" : row.format(current)}</span>
                    {previous !== null ? (
                      <span className="ml-1.5 text-muted-foreground">from {row.format(previous)}</span>
                    ) : null}
                    {delta !== null ? (
                      <span className={cn("ml-1", delta > 0 ? "text-primary" : delta < 0 ? "text-warning" : "text-muted-foreground")}>
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta)}%
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best and hardest recorded days</CardTitle>
            <p className="text-xs text-muted-foreground">Only days with at least one saved record are eligible.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Best evidence</p>
              {highlight.best ? (
                <>
                  <p className="mt-1 text-sm font-semibold">{formatDate(highlight.best.date, "MMM d, yyyy")}</p>
                  <p className="text-xs text-primary">{highlight.best.score}/100</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{highlight.best.reason}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Not enough evidence.</p>
              )}
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-2/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Most limited evidence</p>
              {highlight.hardest ? (
                <>
                  <p className="mt-1 text-sm font-semibold">{formatDate(highlight.hardest.date, "MMM d, yyyy")}</p>
                  <p className="text-xs text-warning">{highlight.hardest.score}/100</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{highlight.hardest.reason}</p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Not enough distinct days.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-primary" /> How these numbers work
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p><strong className="text-foreground">Check-ins:</strong> only explicitly completed check-ins count. Drafts are separate.</p>
            <p><strong className="text-foreground">Averages:</strong> calculated per recorded day. No record means excluded, not zero.</p>
            <p><strong className="text-foreground">Task rate:</strong> completed tasks divided by planned tasks. No planned tasks means no rate.</p>
            <p><strong className="text-foreground">Evidence score:</strong> check-in 40, tasks 25, nutrition 20, water 15; only applicable components are used.</p>
            <p><strong className="text-foreground">Habits:</strong> scheduled slots with no daily record are shown as unassessed.</p>
          </CardContent>
        </Card>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardCheck className="size-3 text-primary" />
          All data computed from your saved records. No sample or estimated values are inserted.
        </span>
        <Link href="/recap" className="text-primary hover:underline">
          Build a monthly recap →
        </Link>
      </div>
    </div>
  );
}
