import Link from "next/link";
import { Apple, ArrowRight, CalendarDays, CheckCircle2, ChartSpline, Utensils } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchCompletedDates, fetchDay, fetchRange, fetchTargetVersions } from "@/lib/queries";
import {
  addDays,
  eachDate,
  endOfMonthKey,
  formatDate,
  isValidDateKey,
  monthKey,
  startOfMonth,
  startOfWeek,
  addMonths,
  startOfMonthKey,
  todayInTimeZone,
} from "@/lib/date";
import {
  averageRecorded,
  evaluateTargets,
  macroTargets,
  nutritionTotals,
  resolveTargets,
  round,
} from "@/lib/metrics";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/misc";
import { DateNavigator } from "@/components/date-navigator";
import { NutritionForm } from "@/components/nutrition/nutrition-form";
import { MealLogger } from "@/components/nutrition/meal-logger";
import { NutritionCharts } from "@/components/nutrition/nutrition-charts";
import type { NutritionEntry, TargetVersion } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nutrition" };

const MACRO_KEYS = ["calories", "protein", "carbs", "fat"] as const;

function averages(rows: NutritionEntry[], days: string[]) {
  const set = new Set(days);
  const scoped = rows.filter((row) => set.has(row.log_date));
  return {
    days: scoped.length,
    calories: round(averageRecorded(scoped.map((r) => r.calories)), 0),
    protein: round(averageRecorded(scoped.map((r) => r.protein_g)), 0),
    carbs: round(averageRecorded(scoped.map((r) => r.carbs_g)), 0),
    fat: round(averageRecorded(scoped.map((r) => r.fat_g)), 0),
    fiber: round(averageRecorded(scoped.map((r) => r.fiber_g)), 0),
  };
}

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected = params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;

  const [day, targetVersions, completedDates] = await Promise.all([
    fetchDay(supabase, userId, selected),
    fetchTargetVersions(supabase, userId),
    fetchCompletedDates(supabase, userId, today, 1),
  ]);
  const target = resolveTargets(targetVersions, selected);

  const windowStart = addDays(selected, -29);
  const previousWindowStart = addDays(windowStart, -30);
  const currentMonthStart = startOfMonth(selected);
  const previousMonth = addMonths(monthKey(selected), -1);
  const previousMonthStart = startOfMonthKey(previousMonth);
  const previousMonthEnd = endOfMonthKey(previousMonth);
  const queryStart = [windowStart, previousMonthStart, previousWindowStart].sort()[0];
  const history = await fetchRange(supabase, userId, queryStart, selected);

  const windowDays = eachDate(windowStart, selected);
  const windowAverages = averages(history.nutrition, windowDays);
  const previousWindowDays = eachDate(previousWindowStart, addDays(windowStart, -1));
  const previousWindowAverages = averages(history.nutrition, previousWindowDays);

  const entryMap = new Map(history.nutrition.map((entry) => [entry.log_date, entry]));
  const targetFlags = {
    calories: { met: 0, eligible: 0 },
    protein: { met: 0, eligible: 0 },
    carbs: { met: 0, eligible: 0 },
    fat: { met: 0, eligible: 0 },
    all: { met: 0, eligible: 0 },
  };
  for (const date of windowDays) {
    const entry = entryMap.get(date);
    const version = resolveTargets(targetVersions, date);
    if (!entry || !version) continue;
    const evaluated = evaluateTargets({
      nutrition: nutritionTotals(entry),
      targets: macroTargets(version),
      waterMl: null,
    });
    for (const key of MACRO_KEYS) {
      if (evaluated[key] !== null) {
        targetFlags[key].eligible += 1;
        if (evaluated[key]) targetFlags[key].met += 1;
      }
    }
    const applicable = [evaluated.calories, evaluated.protein, evaluated.carbs, evaluated.fat].filter(
      (v): v is boolean => v !== null,
    );
    if (applicable.length > 0) {
      targetFlags.all.eligible += 1;
      if (applicable.every(Boolean)) targetFlags.all.met += 1;
    }
  }

  const dailyChart = windowDays.map((date) => {
    const entry = entryMap.get(date);
    return {
      label: formatDate(date, "MMM d"),
      calories: entry?.calories ?? null,
      protein: entry?.protein_g ?? null,
      carbs: entry?.carbs_g ?? null,
      fat: entry?.fat_g ?? null,
    };
  });

  const weekBuckets = new Map<string, string[]>();
  for (const date of windowDays) {
    const key = startOfWeek(date, profile.week_start);
    weekBuckets.set(key, [...(weekBuckets.get(key) ?? []), date]);
  }
  const weeklyChart = Array.from(weekBuckets.entries()).map(([weekStart, days]) => {
    const avg = averages(history.nutrition, days);
    return {
      label: `${formatDate(weekStart, "MMM d")}`,
      calories: avg.calories,
      protein: avg.protein,
      carbs: avg.carbs,
      fat: avg.fat,
      recorded: avg.days,
    };
  });

  const currentMonthAverages = averages(
    history.nutrition,
    eachDate(currentMonthStart, selected),
  );
  const previousMonthAverages = averages(
    history.nutrition,
    eachDate(previousMonthStart, previousMonthEnd),
  );

  const currentNutrition = nutritionTotals(day.nutrition);
  const hasTargets = Boolean(
    target &&
      [target.calories, target.protein_g, target.carbs_g, target.fat_g].some((v) => v !== null),
  );
  const lastCheckin = completedDates[0] ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Nutrition"
        title="Final totals, not a food diary."
        description="Log once at the end of the day. Partial records are allowed; missing values always stay missing."
        actions={
          <>
            <DateNavigator date={selected} today={today} basePath="/nutrition" />
            <Button asChild variant="outline" size="sm">
              <Link href="/check-in">
                <CheckCircle2 className="size-3.5" />
                Check-in
              </Link>
            </Button>
          </>
        }
      />

      {!hasTargets ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            No nutrition targets are set for this date. You can still record totals, but target
            achievement cannot be calculated — no example values are assumed.
          </p>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/settings#targets">
              Set targets <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <NutritionForm logDate={selected} entry={day.nutrition} targets={target} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="size-4 text-primary" /> This date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Calories"
                value={formatNumber(currentNutrition.calories)}
                suffix="kcal"
                hint={target?.calories ? `Target ${formatNumber(target.calories)}` : "No target"}
              />
              <Stat
                label="Protein"
                value={formatNumber(currentNutrition.protein_g)}
                suffix="g"
                hint={target?.protein_g ? `Target ${formatNumber(target.protein_g)}` : "No target"}
              />
              <Stat
                label="Carbs"
                value={formatNumber(currentNutrition.carbs_g)}
                suffix="g"
                hint={target?.carbs_g ? `Target ${formatNumber(target.carbs_g)}` : "No target"}
              />
              <Stat
                label="Fat"
                value={formatNumber(currentNutrition.fat_g)}
                suffix="g"
                hint={target?.fat_g ? `Target ${formatNumber(target.fat_g)}` : "No target"}
              />
            </div>
            <div className="hairline" />
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={day.nutrition ? "default" : "outline"}>
                  {day.nutrition ? "Recorded" : "Not recorded"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="capitalize">{day.nutrition?.source === "meals" ? "Copied from meals" : day.nutrition ? "Manual totals" : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Meals logged</span>
                <span>{day.meals.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fiber</span>
                <span>{currentNutrition.fiber_g === null ? "Not recorded" : `${formatNumber(currentNutrition.fiber_g)} g`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last completed check-in</span>
                <span>{lastCheckin ? formatDate(lastCheckin, profile.date_format) : "None yet"}</span>
              </div>
            </div>
            <p className="rounded-lg bg-surface-2/50 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              Nutrition values are your own estimates. LOCKIN does not invent food values or offer
              medical or dietary advice.
            </p>
          </CardContent>
        </Card>
      </div>

      {profile.modules.meals ? (
        <div className="mt-4">
          <MealLogger logDate={selected} meals={day.meals} entry={day.nutrition} />
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/40 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Utensils className="size-3.5" /> Meal logging is optional and currently turned off.
          </p>
          <Link href="/settings" className="text-[11px] font-medium text-primary hover:underline">
            Enable in Settings
          </Link>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Nutrition trends</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Last 30 days ending {formatDate(selected, profile.date_format)}. Averages use recorded days only.
            </p>
          </div>
          <CalendarDays className="size-4 text-muted-foreground" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <p className="eyebrow">Calories / recorded day</p>
            <p className="metric mt-1 text-2xl font-semibold">{formatNumber(windowAverages.calories)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {windowAverages.days} recorded of {windowDays.length} days
            </p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">Protein / recorded day</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {formatNumber(windowAverages.protein)}
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">g</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Previous 30d: {formatNumber(previousWindowAverages.protein)} g
            </p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">All macro targets met</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {targetFlags.all.met}
              <span className="ml-1 text-xs font-medium text-muted-foreground">days</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              of {targetFlags.all.eligible} eligible days with targets
            </p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">Missing days</p>
            <p className="metric mt-1 text-2xl font-semibold">{windowDays.length - windowAverages.days}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Not interpreted as zero intake</p>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader>
              <CardTitle>Recorded intake</CardTitle>
            </CardHeader>
            <CardContent>
              <NutritionCharts daily={dailyChart} weekly={weeklyChart} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Target achievement</CardTitle>
              <p className="text-xs text-muted-foreground">Last 30 days, eligible recorded days only.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasTargets ? (
                <>
                  {(
                    [
                      { key: "calories", label: "Calories (±10%)" },
                      { key: "protein", label: "Protein (minimum)" },
                      { key: "carbs", label: "Carbs (±10%)" },
                      { key: "fat", label: "Fat (±10%)" },
                    ] as const
                  ).map((item) => {
                    const flag = targetFlags[item.key];
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium tabular-nums">
                          {flag.met}/{flag.eligible} days
                        </span>
                      </div>
                    );
                  })}
                  <div className="hairline" />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Calories, carbs and fat count as met within ±10% of the target. Protein counts at
                    or above target. Eligibility requires both a saved value and a target effective
                    on that date.
                  </p>
                </>
              ) : (
                <EmptyState
                  icon={ChartSpline}
                  title="Targets not set"
                  description="Add targets in settings to see achievement counts. No generic values are assumed."
                  action={{ label: "Set targets", href: "/settings#targets" }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Month to month</CardTitle>
            <p className="text-xs text-muted-foreground">
              Current month to date versus the previous full month. Each average uses recorded days only.
            </p>
          </CardHeader>
          <CardContent>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>This month</th>
                    <th>Previous month</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { key: "calories", label: "Avg calories", unit: "kcal" },
                      { key: "protein", label: "Avg protein", unit: "g" },
                      { key: "carbs", label: "Avg carbs", unit: "g" },
                      { key: "fat", label: "Avg fat", unit: "g" },
                    ] as const
                  ).map((row) => {
                    const current = currentMonthAverages[row.key];
                    const prev = previousMonthAverages[row.key];
                    const change = current !== null && prev !== null ? current - prev : null;
                    return (
                      <tr key={row.key}>
                        <td className="text-muted-foreground">{row.label}</td>
                        <td className="font-medium tabular-nums">
                          {current === null ? "—" : `${formatNumber(current)} ${row.unit}`}
                        </td>
                        <td className="tabular-nums text-muted-foreground">
                          {prev === null ? "—" : `${formatNumber(prev)} ${row.unit}`}
                        </td>
                        <td
                          className={cn(
                            "tabular-nums",
                            change === null ? "text-muted-foreground" : change > 0 ? "text-primary" : change < 0 ? "text-secondary" : "",
                          )}
                        >
                          {change === null ? "—" : `${change > 0 ? "+" : ""}${formatNumber(change)} ${row.unit}`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="text-muted-foreground">Recorded days</td>
                    <td className="tabular-nums">{currentMonthAverages.days}</td>
                    <td className="tabular-nums text-muted-foreground">{previousMonthAverages.days}</td>
                    <td className="tabular-nums text-muted-foreground">
                      {currentMonthAverages.days - previousMonthAverages.days > 0 ? "+" : ""}
                      {currentMonthAverages.days - previousMonthAverages.days}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                Current month: {formatDate(currentMonthStart, "MMM d")} – {formatDate(selected, "MMM d")}.
                Previous month recorded {previousMonthAverages.days} days.
              </p>
              <Badge variant="outline">
                {todayInTimeZone(profile.timezone) === selected ? "Today" : formatDate(selected, "MMM d")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
