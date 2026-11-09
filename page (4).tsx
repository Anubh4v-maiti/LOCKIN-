import Link from "next/link";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Droplets,
  Dumbbell,
  ListTodo,
  PenLine,
  Repeat2,
  Timer,
  Utensils,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  fetchDay,
  fetchHabits,
  fetchRange,
  fetchTargetVersions,
} from "@/lib/queries";
import {
  addDays,
  addMonths,
  dayOfWeek,
  eachDate,
  endOfMonthKey,
  formatDate,
  formatMonth,
  formatWeekday,
  isValidDateKey,
  isValidMonthKey,
  monthKey,
  monthMatrix,
  startOfMonthKey,
  startOfWeek,
  endOfWeek,
} from "@/lib/date";
import type { DateKey, MonthKey } from "@/lib/date";
import {
  dailyCompletionScore,
  dayEvidenceScore,
  evaluateTargets,
  habitActiveOn,
  habitDayState,
  macroTargets,
  nutritionTotals,
  resolveTargets,
  taskStats,
  waterStats,
} from "@/lib/metrics";
import { cn, formatMl, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar & history" };

function dayStateLabel(status: string | undefined) {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Draft";
  return "No check-in";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const currentMonth = monthKey(today);
  const month: MonthKey =
    params.month && isValidMonthKey(params.month) && params.month <= currentMonth
      ? params.month
      : currentMonth;
  const primaryDate = params.date && isValidDateKey(params.date) ? params.date : null;
  const fallbackDate = month === currentMonth ? today : startOfMonthKey(month);
  const selected =
    primaryDate && primaryDate >= startOfMonthKey(month) && primaryDate <= endOfMonthKey(month)
      ? primaryDate
      : fallbackDate;

  const gridStart = startOfWeek(startOfMonthKey(month), profile.week_start);
  const gridEnd = endOfWeek(endOfMonthKey(month), profile.week_start);
  const [range, selectedDay, targetVersions, habits] = await Promise.all([
    fetchRange(supabase, userId, gridStart, gridEnd),
    fetchDay(supabase, userId, selected),
    fetchTargetVersions(supabase, userId),
    profile.modules.habits ? fetchHabits(supabase, userId, true) : Promise.resolve([]),
  ]);

  const logs = new Map(range.logs.map((row) => [row.log_date, row]));
  const reflections = new Map(range.reflections.map((row) => [row.log_date, row]));
  const nutrition = new Map(range.nutrition.map((row) => [row.log_date, row]));
  const water = new Map(range.water.map((row) => [row.log_date, row]));
  const study = new Map<string, number>();
  for (const session of range.study) study.set(session.log_date, (study.get(session.log_date) ?? 0) + session.minutes);
  const tasks = new Map<string, { total: number; completed: number }>();
  for (const task of range.tasks) {
    const existing = tasks.get(task.log_date) ?? { total: 0, completed: 0 };
    existing.total += 1;
    if (task.completed) existing.completed += 1;
    tasks.set(task.log_date, existing);
  }
  const completions = new Map<string, Set<string>>();
  for (const completion of range.habitCompletions) {
    const set = completions.get(completion.log_date) ?? new Set<string>();
    set.add(completion.habit_id);
    completions.set(completion.log_date, set);
  }

  const monthDays = eachDate(startOfMonthKey(month), endOfMonthKey(month));
  const elapsedDays = monthDays.filter((date) => date <= today);
  const studyDays = elapsedDays.filter((date) => study.has(date));
  const monthStats = {
    checkins: elapsedDays.filter((date) => logs.get(date)?.checkin_status === "complete").length,
    partial: elapsedDays.filter((date) => logs.get(date)?.checkin_status === "partial").length,
    nutritionDays: elapsedDays.filter((date) => nutrition.has(date)).length,
    waterDays: elapsedDays.filter((date) => water.has(date)).length,
    taskDays: elapsedDays.filter((date) => tasks.has(date)).length,
    tasksPlanned: elapsedDays.reduce((sum, date) => sum + (tasks.get(date)?.total ?? 0), 0),
    tasksCompleted: elapsedDays.reduce((sum, date) => sum + (tasks.get(date)?.completed ?? 0), 0),
    studyDays: studyDays.length,
    studyMinutes: studyDays.reduce((sum, date) => sum + (study.get(date) ?? 0), 0),
  };

  const target = resolveTargets(targetVersions, selected);
  const targets = macroTargets(target);
  const selectedTasks = taskStats(selectedDay.tasks);
  const selectedWater = waterStats(selectedDay.water?.total_ml ?? null, targets.water_ml);
  const selectedStudy = selectedDay.studySessions.length
    ? selectedDay.studySessions.reduce((sum, session) => sum + session.minutes, 0)
    : null;
  const selectedNutrition = nutritionTotals(selectedDay.nutrition);
  const selectedHabits = habits.filter(
    (habit) =>
      habitActiveOn(habit, selected) && habit.schedule_days.includes(dayOfWeek(selected)),
  );
  const selectedHabitDone = selectedHabits.filter((habit) =>
    selectedDay.habitCompletions.some((completion) => completion.habit_id === habit.id && completion.completed),
  ).length;
  const selectedTargetEval = evaluateTargets({
    nutrition: selectedNutrition,
    targets,
    waterMl: selectedWater.totalMl,
    studyMinutes: selectedStudy,
    tasksPlanned: selectedTasks.total,
    tasksCompleted: selectedTasks.completed,
  });
  const selectedScore = dailyCompletionScore({
    checkinStatus: selectedDay.dailyLog?.checkin_status ?? "none",
    tasksPlanned: selectedTasks.total,
    tasksCompleted: selectedTasks.completed,
    nutrition: selectedNutrition,
    targets,
    waterMl: selectedWater.totalMl,
  });

  const monthLabel = formatMonth(month);
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canGoNext = nextMonth <= currentMonth;
  const weekdays =
    profile.week_start === 1
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendar = monthMatrix(month, profile.week_start);

  return (
    <div>
      <PageHeader
        eyebrow="Calendar & history"
        title={monthLabel}
        description="The long view. Open any date to inspect or edit its saved record."
        actions={
          <>
            <Button asChild variant="outline" size="icon-sm" aria-label="Previous month">
              <Link href={`/calendar?month=${previousMonth}${month === currentMonth ? `&date=${today}` : ""}`}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant={month === currentMonth ? "default" : "outline"} size="sm">
              <Link href={`/calendar`}>This month</Link>
            </Button>
            {canGoNext ? (
              <Button asChild variant="outline" size="icon-sm" aria-label="Next month">
                <Link href={`/calendar?month=${nextMonth}`}>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="icon-sm" disabled aria-label="Next month unavailable">
                <ArrowRight className="size-4" />
              </Button>
            )}
          </>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed check-ins</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {monthStats.checkins}
              <span className="ml-1 text-xs font-medium text-muted-foreground">/ {elapsedDays.length} elapsed</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nutrition records</p>
            <p className="metric mt-1 text-2xl font-semibold">{monthStats.nutritionDays}</p>
            <p className="text-[10px] text-muted-foreground">Days with saved totals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tasks</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {monthStats.tasksCompleted}/{monthStats.tasksPlanned}
            </p>
            <p className="text-[10px] text-muted-foreground">Completed / planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Study</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {monthStats.studyDays ? `${Math.round((monthStats.studyMinutes / 60) * 10) / 10}h` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {monthStats.studyDays ? "Recorded minutes" : "No study records"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Water records</p>
            <p className="metric mt-1 text-2xl font-semibold">{monthStats.waterDays}</p>
            <p className="text-[10px] text-muted-foreground">Days with a saved total</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" /> {monthLabel}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  A filled circle means a completed check-in. Drafts remain visibly partial.
                </p>
              </div>
              <Badge variant="outline">{monthDays.length} days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map((day) => (
                <div key={day} className="py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {day.slice(0, 2)}
                </div>
              ))}
              {calendar.flat().map((date) => {
                const inMonth = date.slice(0, 7) === month;
                const future = date > today;
                const log = logs.get(date);
                const status = log?.checkin_status;
                const taskInfo = tasks.get(date);
                const nutritionInfo = nutrition.get(date);
                const waterInfo = water.get(date);
                const studyInfo = study.get(date);
                const isSelected = date === selected;
                const isToday = date === today;
                const habitScheduled = habits.filter(
                  (habit) =>
                    habitActiveOn(habit, date) && habit.schedule_days.includes(dayOfWeek(date)),
                );
                const habitDone = Array.from(completions.get(date) ?? []).length;
                return (
                  <Link
                    key={date}
                    href={`/calendar?month=${monthKey(date)}&date=${date}`}
                    aria-label={`${formatDate(date, "MMM d, yyyy")}: ${dayStateLabel(status)}`}
                    aria-current={isSelected ? "date" : undefined}
                    className={cn(
                      "group relative flex min-h-[78px] flex-col rounded-xl border p-1.5 transition-colors sm:min-h-[88px] sm:p-2",
                      inMonth ? "border-border/60 bg-surface/50" : "border-transparent bg-transparent opacity-45",
                      future && "opacity-55",
                      isSelected && "border-primary/50 bg-primary/[0.07] ring-1 ring-primary/30",
                      !isSelected && inMonth && "hover:border-primary/30 hover:bg-surface-2/60",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                          isToday && "bg-primary text-primary-foreground",
                          isSelected && !isToday && "text-primary",
                        )}
                      >
                        {Number(date.slice(8))}
                      </span>
                      {status === "complete" ? (
                        <CheckCircle2 className="size-3 text-primary" aria-label="Check-in complete" />
                      ) : status === "partial" ? (
                        <Circle className="size-3 fill-secondary/30 text-secondary" aria-label="Check-in draft" />
                      ) : null}
                    </div>
                    {inMonth ? (
                      <div className="mt-auto space-y-1 pt-1.5">
                        {taskInfo ? (
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <ListTodo className="size-2.5" />
                            <span className="tabular-nums">
                              {taskInfo.completed}/{taskInfo.total}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-1">
                          {nutritionInfo ? <span className="size-1.5 rounded-full bg-[var(--chart-lime)]" title="Nutrition recorded" /> : null}
                          {waterInfo ? <span className="size-1.5 rounded-full bg-[var(--chart-blue)]" title="Water recorded" /> : null}
                          {studyInfo ? <span className="size-1.5 rounded-full bg-[var(--chart-lavender)]" title="Study recorded" /> : null}
                          {habitScheduled.length > 0 && habitDone > 0 ? (
                            <span className="size-1.5 rounded-full bg-secondary" title={`${habitDone} habit completions`} />
                          ) : null}
                        </div>
                        {studyInfo ? (
                          <p className="truncate text-[8px] text-muted-foreground">{studyInfo}m study</p>
                        ) : null}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" /> Check-in</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--chart-lime)]" /> Nutrition</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--chart-blue)]" /> Water</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--chart-lavender)]" /> Study</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-secondary" /> Habits</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-primary" />
                  {formatWeekday(selected, "long")}, {formatDate(selected, "MMM d")}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Saved history for this date.</p>
              </div>
              <Badge variant={selectedDay.dailyLog?.checkin_status === "complete" ? "success" : selectedDay.dailyLog?.checkin_status === "partial" ? "secondary" : "outline"}>
                {dayStateLabel(selectedDay.dailyLog?.checkin_status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-surface-2/30 p-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Daily completion score</span>
                <span className="font-semibold text-foreground">{selectedScore.score === null ? "—" : `${Math.round(selectedScore.score)}%`}</span>
              </div>
              <Progress value={selectedScore.score} label="Selected day completion" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Utensils className="size-2.5" /> Nutrition
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {selectedNutrition.calories === null ? "Not recorded" : `${selectedNutrition.calories} kcal`}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {selectedTargetEval.applicable ? `${selectedTargetEval.met}/${selectedTargetEval.applicable} targets met` : "No target data"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Droplets className="size-2.5" /> Water
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {selectedWater.totalMl === null ? "Not recorded" : formatMl(selectedWater.totalMl)}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {selectedWater.targetMl === null ? "No target" : `${pct(selectedWater.percent)} of target`}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <ListTodo className="size-2.5" /> Tasks
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {selectedTasks.total ? `${selectedTasks.completed}/${selectedTasks.total}` : "None planned"}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {selectedTasks.total ? pct(selectedTasks.percent) : "Not a 100% success rate"}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Timer className="size-2.5" /> Study
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {selectedDay.studySessions.length ? `${selectedStudy} min` : "Not recorded"}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {selectedDay.studySessions.length} {selectedDay.studySessions.length === 1 ? "session" : "sessions"}
                </p>
              </div>
            </div>

            {profile.modules.habits && selectedHabits.length ? (
              <div className="rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Repeat2 className="size-2.5" /> Habits
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {selectedHabitDone}/{selectedHabits.length} scheduled complete
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selectedHabits.map((habit) => {
                    const completion = selectedDay.habitCompletions.find((row) => row.habit_id === habit.id) ?? null;
                    const state = habitDayState({
                      habit,
                      date: selected,
                      today,
                      completion,
                      hasAnyRecord: Boolean(completedEvidence(range, selected)),
                    });
                    return (
                      <span
                        key={habit.id}
                        title={`${habit.name}: ${state}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px]",
                          state === "completed" ? "border-primary/25 bg-primary/10 text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        <span className="size-1 rounded-full" style={{ background: habit.color }} />
                        {habit.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedDay.reflection ? (
              <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Reflection</p>
                {selectedDay.reflection.rating ? (
                  <p className="text-[10px]">Day rating: {selectedDay.reflection.rating}/5</p>
                ) : null}
                {selectedDay.reflection.win ? <p className="text-[10px] leading-relaxed"><span className="text-muted-foreground">Win:</span> {selectedDay.reflection.win}</p> : null}
                {selectedDay.reflection.mistake ? <p className="text-[10px] leading-relaxed"><span className="text-muted-foreground">Obstacle:</span> {selectedDay.reflection.mistake}</p> : null}
                {selectedDay.reflection.improvement ? <p className="text-[10px] leading-relaxed"><span className="text-muted-foreground">Next:</span> {selectedDay.reflection.improvement}</p> : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/check-in?date=${selected}`}>
                  <PenLine className="size-3.5" /> Check-in
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/nutrition?date=${selected}`}>
                  <Apple className="size-3.5" /> Nutrition
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/water?date=${selected}`}>
                  <Droplets className="size-3.5" /> Water
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/tasks?date=${selected}`}>
                  <ListTodo className="size-3.5" /> Tasks
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <Dumbbell className="mt-0.5 size-3 shrink-0 text-primary" />
        Past records can be corrected at any time. The calendar shows saved facts, not inferred activity.
        Partial check-ins stay labelled as drafts.
      </div>
    </div>
  );
}

function completedEvidence(range: Awaited<ReturnType<typeof fetchRange>>, date: DateKey) {
  return (
    range.logs.some((row) => row.log_date === date) ||
    range.nutrition.some((row) => row.log_date === date) ||
    range.water.some((row) => row.log_date === date) ||
    range.tasks.some((row) => row.log_date === date) ||
    range.study.some((row) => row.log_date === date) ||
    range.habitCompletions.some((row) => row.log_date === date)
  );
}
