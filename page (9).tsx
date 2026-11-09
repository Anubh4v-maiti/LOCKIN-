import Link from "next/link";
import {
  Apple,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Flame,
  ListTodo,
  PenLine,
  Repeat2,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchCompletedDates, fetchDay, fetchHabits, fetchRange, fetchTargetVersions } from "@/lib/queries";
import { ensurePreviousMonthRecap, fetchRecap } from "@/lib/recap-service";
import {
  addMonths,
  dayOfWeek,
  endOfWeek,
  formatDate,
  formatMonth,
  startOfWeek,
  hourInTimeZone,
  type DateKey,
} from "@/lib/date";
import {
  checkinStreaks,
  dailyCompletionScore,
  macroTargets,
  metricProgress,
  nutritionTotals,
  percentOf,
  resolveTargets,
  taskStats,
  waterStats,
  weekConsistency,
} from "@/lib/metrics";
import { cn, formatMl, formatNumber, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressRing } from "@/components/ui/progress";
import { TaskQuickRow } from "@/components/tasks/task-toggle";
import { QuickWaterButtons } from "@/components/water/quick-water";
import { habitDayState } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const QUOTES = [
  "Consistency is built one honest evening at a time.",
  "You do not need a perfect day to make progress.",
  "Small inputs, repeated, become identity.",
  "Record the truth. Then adjust one thing.",
  "Progress often hides inside ordinary days.",
  "Show up before you feel ready.",
  "A missed day is data, not a verdict.",
  "Keep the promise small enough to keep.",
  "The streak is a tool, not a judge.",
  "Finish the day with clarity, not punishment.",
];

function quoteFor(date: DateKey) {
  const hash = date.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return QUOTES[hash % QUOTES.length];
}

function MacroMetric({
  label,
  value,
  target,
  unit,
  color,
  digits = 0,
}: {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  color: string;
  digits?: number;
}) {
  const p = metricProgress(value, target);
  const remaining = p.remaining;
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="size-1.5 rounded-full" style={{ background: color }} />
      </div>
      <p className="metric mt-2 flex items-baseline gap-1 text-2xl font-semibold">
        {formatNumber(value, digits)}
        <span className="text-[11px] font-medium text-muted-foreground">{unit}</span>
      </p>
      <div className="mt-2">
        <Progress
          value={p.percent === null ? null : Math.min(100, p.percent)}
          barClassName={p.met ? "bg-primary" : ""}
          label={`${label} progress`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{target === null ? "Target not set" : `of ${formatNumber(target, digits)} ${unit}`}</span>
        <span className={cn(p.over && "text-warning")}>
          {value === null
            ? "Not recorded"
            : remaining === null
              ? "—"
              : remaining >= 0
                ? `${formatNumber(remaining, digits)} left`
                : `${formatNumber(Math.abs(remaining), digits)} over`}
        </span>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: typeof Sparkles;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-surface/40 p-3 transition-colors hover:border-primary/30 hover:bg-surface-2/60"
    >
      <span className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-surface-2 text-primary transition-colors group-hover:border-primary/30">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

export default async function DashboardPage() {
  const { supabase, userId, profile, today } = await requireUser();
  const weekStart = startOfWeek(today, profile.week_start);
  const weekEnd = endOfWeek(today, profile.week_start);
  const previousMonth = addMonths(today.slice(0, 7), -1);

  await ensurePreviousMonthRecap(supabase, userId, profile, today);

  const [day, targetVersions, habits, completedDates, weekData, previousRecap] = await Promise.all([
    fetchDay(supabase, userId, today),
    fetchTargetVersions(supabase, userId),
    profile.modules.habits ? fetchHabits(supabase, userId) : Promise.resolve([]),
    fetchCompletedDates(supabase, userId, today),
    fetchRange(supabase, userId, weekStart, weekEnd),
    fetchRecap(supabase, userId, previousMonth),
  ]);

  const targetVersion = resolveTargets(targetVersions, today);
  const targets = macroTargets(targetVersion);
  const nutrition = nutritionTotals(day.nutrition);
  const tasks = day.tasks;
  const tStats = taskStats(tasks);
  const water = waterStats(day.water?.total_ml ?? null, targets.water_ml);
  const studyMinutes = day.studySessions.reduce((sum, session) => sum + session.minutes, 0);
  const checkinStatus = day.dailyLog?.checkin_status ?? "none";
  const streak = checkinStreaks(completedDates, today);
  const week = weekConsistency(today, completedDates, profile.week_start);
  const score = dailyCompletionScore({
    checkinStatus,
    tasksPlanned: tStats.total,
    tasksCompleted: tStats.completed,
    nutrition,
    targets,
    waterMl: water.totalMl,
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const weekLogs = new Map(weekData.logs.map((log) => [log.log_date, log]));

  const todayHabits = habits
    .filter((habit) => habit.schedule_days.includes(dayOfWeek(today)))
    .map((habit) => ({
      habit,
      state: habitDayState({
        habit,
        date: today,
        today,
        completion: day.habitCompletions.find((c) => c.habit_id === habit.id) ?? null,
        hasAnyRecord: true,
      }),
    }));
  const habitsDone = todayHabits.filter((h) => h.state === "completed").length;

  const firstName = (profile.display_name ?? "there").split(/\s+/)[0];
  const greeting = `${hourInTimeZone(profile.timezone) < 12 ? "Good morning" : hourInTimeZone(profile.timezone) < 17 ? "Good afternoon" : "Good evening"}, ${firstName}.`;
  const hasTargets = Boolean(targetVersion);
  const needsSetup = !targetVersion || !profile.onboarded;

  const pendingTasks = tasks.filter((task) => !task.completed).slice(0, 4);
  const displayTasks = pendingTasks.length ? pendingTasks : tasks.slice(0, 4);

  return (
    <div className="space-y-5">
      {needsSetup ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Finish setting up your space</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {targetVersion
                  ? "Choose your modules and confirm your timezone. No example targets are assumed."
                  : "Set your own targets and timezone. Until then, progress stays blank — never faked."}
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={hasTargets ? "/settings" : "/settings#targets"}>
              {hasTargets ? "Finish setup" : "Set targets"}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.10),transparent_70%)]" />
          <CardContent className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/25 text-primary">
                  <Flame className="size-3" />
                  {streak.current > 0 ? `${streak.current}-day streak` : "Start a streak"}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{formatDate(today, profile.date_format)}</span>
              </div>
              <h1 className="mt-4 font-display text-[clamp(1.7rem,3.3vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
                {greeting}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {quoteFor(today)}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button asChild>
                  <Link href="/check-in">
                    <ClipboardCheck className="size-4" />
                    {checkinStatus === "complete" ? "Review check-in" : "Complete daily check-in"}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/tasks#add-task">
                    <ListTodo className="size-4" />
                    Add a task
                  </Link>
                </Button>
              </div>
              <div className="mt-6 grid max-w-md grid-cols-3 gap-3">
                <div>
                  <p className="eyebrow">Current</p>
                  <p className="metric mt-1 text-xl font-semibold">
                    {streak.current}
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground">days</span>
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Best</p>
                  <p className="metric mt-1 text-xl font-semibold">
                    {streak.best}
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground">days</span>
                  </p>
                </div>
                <div>
                  <p className="eyebrow">This week</p>
                  <p className="metric mt-1 text-xl font-semibold">
                    {week.completed}/{week.elapsed}
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground">check-ins</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2">
              <ProgressRing
                value={score.score}
                size={156}
                strokeWidth={11}
                label="Overall daily completion"
              >
                <div className="text-center">
                  <p className="metric text-3xl font-semibold">
                    {score.score === null ? "—" : `${Math.round(score.score)}%`}
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Daily score</p>
                </div>
              </ProgressRing>
              <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                {checkinStatus === "complete"
                  ? "Check-in complete. Aiming for consistency, not perfection."
                  : "Weighted by check-in, tasks, nutrition and water."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Weekly consistency</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Completed check-ins, not website visits.</p>
            </div>
            <TrendingUp className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {weekDates.map((date) => {
                const log = weekLogs.get(date);
                const future = date > today;
                const state = future ? "future" : log?.checkin_status === "complete" ? "complete" : log?.checkin_status === "partial" ? "partial" : "none";
                return (
                  <div key={date} className="flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-medium uppercase text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(
                        new Date(`${date}T00:00:00Z`),
                      )}
                    </span>
                    <span
                      title={
                        future
                          ? "Future day"
                          : state === "complete"
                            ? "Check-in complete"
                            : state === "partial"
                              ? "Partial draft only"
                              : "No completed check-in"
                      }
                      className={cn(
                        "flex h-9 w-full items-center justify-center rounded-lg border text-[11px] font-semibold tabular-nums",
                        state === "complete" && "border-primary/30 bg-primary/15 text-primary",
                        state === "partial" && "border-secondary/25 bg-secondary/10 text-secondary",
                        state === "none" && "border-border/60 bg-surface-2/40 text-muted-foreground",
                        state === "future" && "border-dashed border-border/40 text-muted-foreground/40",
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Week to date</p>
                <p className="text-sm font-semibold">{pct(week.percent)}</p>
              </div>
              <p className="text-right text-[10px] leading-relaxed text-muted-foreground">
                {week.completed} of {week.elapsed} elapsed days
                <br />
                completed
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm border border-primary/30 bg-primary/15" /> Complete
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm border border-secondary/25 bg-secondary/10" /> Partial
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm border border-border bg-surface-2" /> None
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MacroMetric label="Calories" value={nutrition.calories} target={targets.calories} unit="kcal" color="var(--chart-lime)" />
        <MacroMetric label="Protein" value={nutrition.protein_g} target={targets.protein_g} unit="g" color="var(--chart-blue)" />
        <MacroMetric label="Carbs" value={nutrition.carbs_g} target={targets.carbs_g} unit="g" color="var(--chart-lavender)" />
        <MacroMetric label="Fat" value={nutrition.fat_g} target={targets.fat_g} unit="g" color="var(--chart-amber)" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="size-4 text-primary" /> Today&apos;s plan
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {tStats.total === 0
                  ? "No tasks planned."
                  : `${tStats.completed} of ${tStats.total} complete · ${pct(tStats.percent)}`}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tStats.total > 0 ? (
              <>
                <Progress value={tStats.percent} className="mb-2" label="Task completion" />
                <div className="divide-y divide-border/50">
                  {displayTasks.map((task) => (
                    <TaskQuickRow key={task.id} task={task} />
                  ))}
                </div>
                {tasks.length > displayTasks.length ? (
                  <Link href="/tasks" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                    View all {tasks.length} tasks <ArrowRight className="size-3" />
                  </Link>
                ) : null}
                {tStats.allDone ? (
                  <p className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.06] px-2.5 py-2 text-[11px] text-primary">
                    <CheckCircle2 className="size-3.5" /> Everything planned is complete.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">No tasks planned for today.</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Zero planned tasks is not a 100% success rate.
                </p>
                <Button asChild size="sm" variant="subtle" className="mt-3">
                  <Link href="/tasks#add-task">Add a task</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="size-4 text-[var(--chart-blue)]" /> Water
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {water.targetMl === null ? "Target not set" : `Target ${formatMl(water.targetMl)}`}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/water">Open</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ProgressRing
                value={water.percent}
                size={92}
                strokeWidth={8}
                label="Water progress"
              >
                <div className="text-center">
                  <p className="metric text-lg font-semibold">
                    {water.percent === null ? "—" : `${Math.round(Math.min(100, water.percent))}%`}
                  </p>
                </div>
              </ProgressRing>
              <div className="min-w-0">
                <p className="metric text-2xl font-semibold">
                  {water.totalMl === null ? "—" : formatMl(water.totalMl)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {water.totalMl === null
                    ? "No water recorded"
                    : water.remainingMl !== null && water.remainingMl > 0
                      ? `${formatMl(water.remainingMl)} remaining`
                      : "Target met"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <QuickWaterButtons logDate={today} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="size-4 text-[var(--chart-amber)]" /> Check-in
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {checkinStatus === "complete"
                    ? "Completed today"
                    : checkinStatus === "partial"
                      ? "Draft saved — not complete"
                      : "Not started"}
                </p>
              </div>
              <Badge variant={checkinStatus === "complete" ? "success" : checkinStatus === "partial" ? "secondary" : "outline"}>
                {checkinStatus === "complete" ? "Complete" : checkinStatus === "partial" ? "Partial" : "None"}
              </Badge>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" className="w-full" variant={checkinStatus === "complete" ? "subtle" : "default"}>
                <Link href="/check-in">
                  <PenLine className="size-3.5" />
                  {checkinStatus === "complete" ? "Review or edit" : "Two-minute check-in"}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {profile.modules.study ? (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <Timer className="size-3.5 text-[var(--chart-lavender)]" /> Focus today
                    </p>
                    <p className="metric mt-1 text-xl font-semibold">
                      {(studyMinutes / 60).toFixed(1)}
                      <span className="ml-1 text-[10px] font-medium text-muted-foreground">hours</span>
                    </p>
                  </div>
                  <Link href="/study" className="text-[10px] font-medium text-primary hover:underline">
                    Open
                  </Link>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{day.studySessions.length} session{day.studySessions.length === 1 ? "" : "s"}</span>
                  <span>
                    {targets.study_minutes === null ? "No study target" : `of ${(targets.study_minutes / 60).toFixed(1)}h`}
                  </span>
                </div>
                <Progress
                  value={percentOf(studyMinutes, targets.study_minutes)}
                  className="mt-2"
                  label="Study target progress"
                />
                {day.activeFocus ? (
                  <p className="mt-2 text-[10px] text-primary">Focus timer is active.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {profile.modules.habits ? (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <Repeat2 className="size-3.5 text-secondary" /> Habits today
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {todayHabits.length === 0
                        ? "No habits scheduled today."
                        : `${habitsDone} of ${todayHabits.length} scheduled complete`}
                    </p>
                  </div>
                  <Link href="/habits" className="text-[10px] font-medium text-primary hover:underline">
                    Open
                  </Link>
                </div>
                {todayHabits.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {todayHabits.slice(0, 6).map(({ habit, state }) => (
                      <span
                        key={habit.id}
                        title={`${habit.name}: ${state}`}
                        className={cn(
                          "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                          state === "completed"
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border bg-surface-2 text-muted-foreground",
                        )}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: habit.color }} />
                        <span className="truncate">{habit.name}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                    A rest day is allowed. Unscheduled is not missed.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-end justify-between">
          <div>
            <h2 className="section-title">Quick actions</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Everything essential, one tap away.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <QuickAction href="/check-in" icon={ClipboardCheck} label="Check in" hint="Two-minute wrap-up" />
          <QuickAction href="/nutrition" icon={Apple} label="Nutrition" hint="Update daily totals" />
          <QuickAction href="/water" icon={Droplets} label="Water" hint="Add or correct intake" />
          <QuickAction href="/tasks#add-task" icon={ListTodo} label="Add task" hint="Plan today" />
          <QuickAction href="/study" icon={Timer} label="Focus" hint="Start a session" />
          <QuickAction href="/check-in#reflection" icon={PenLine} label="Reflect" hint="Win, mistake, next" />
        </div>
      </section>

      {previousRecap ? (
        <Link
          href={`/recap?month=${previousMonth}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-secondary/20 bg-secondary/[0.05] p-4 transition-colors hover:border-secondary/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{formatMonth(previousMonth)} recap is ready</p>
              <p className="text-[11px] text-muted-foreground">
                Saved report · evidence-bound summary, wins and next-month plan.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-secondary" />
        </Link>
      ) : null}

      <p className="pb-2 text-center text-[10px] text-muted-foreground">
        All metrics are calculated from saved records. Missing data is shown as missing, never as zero.
        {" "}
        <Link href="/analytics" className="text-primary hover:underline">
          How calculations work
        </Link>
      </p>
    </div>
  );
}
