import Link from "next/link";
import { ArrowRight, Droplets, Info, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchDay, fetchRange, fetchTargetVersions } from "@/lib/queries";
import {
  addDays,
  eachDate,
  formatDate,
  isValidDateKey,
} from "@/lib/date";
import { averageRecorded, macroTargets, resolveTargets, round, waterStats } from "@/lib/metrics";
import { formatMl, pct } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/misc";
import { DateNavigator } from "@/components/date-navigator";
import { WaterTracker } from "@/components/water/water-tracker";
import { TrendChart } from "@/components/charts/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Water" };

export default async function WaterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected =
    params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;

  const [day, targetVersions] = await Promise.all([
    fetchDay(supabase, userId, selected),
    fetchTargetVersions(supabase, userId),
  ]);
  const target = resolveTargets(targetVersions, selected);
  const targets = macroTargets(target);
  const water = waterStats(day.water?.total_ml ?? null, targets.water_ml);

  const windowStart = addDays(selected, -29);
  const history = await fetchRange(supabase, userId, windowStart, selected);
  const historyByDate = new Map(history.water.map((log) => [log.log_date, log]));
  const days = eachDate(windowStart, selected);
  const recorded = days
    .map((date) => historyByDate.get(date)?.total_ml ?? null)
    .filter((value): value is number => value !== null);
  const average = round(averageRecorded(recorded), 0);
  const targetMetDays = days.filter((date) => {
    const version = resolveTargets(targetVersions, date);
    const value = historyByDate.get(date)?.total_ml ?? null;
    const goal = version?.water_ml ?? null;
    return value !== null && goal !== null && value >= goal;
  }).length;
  const targetEligibleDays = days.filter((date) => {
    const version = resolveTargets(targetVersions, date);
    return (historyByDate.get(date)?.total_ml ?? null) !== null && (version?.water_ml ?? null) !== null;
  }).length;

  const chart = days.map((date) => ({
    label: formatDate(date, "MMM d"),
    water: historyByDate.get(date)?.total_ml ?? null,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Water"
        title="Hydration, without guesswork."
        description="Each addition is saved as an event you can undo. Correct the total whenever your real intake differs."
        actions={<DateNavigator date={selected} today={today} basePath="/water" />}
      />

      {targets.water_ml === null ? (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            No personal water target is set for this date. You can still log intake; target progress
            stays blank because no medical target is assumed.
          </p>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/settings#targets">
              Set a target <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <WaterTracker
        logDate={selected}
        initialTotal={day.water?.total_ml ?? null}
        targetMl={targets.water_ml}
        hasEvents={day.waterEvents.length > 0}
        eventCount={day.waterEvents.length}
      />

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Selected date"
              value={water.totalMl === null ? "—" : formatMl(water.totalMl)}
              hint={water.hasRecord ? "Recorded" : "No water recorded"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Target"
              value={targets.water_ml === null ? "—" : formatMl(targets.water_ml)}
              hint={targets.water_ml === null ? "Not configured" : "Personal target"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="30-day average"
              value={average === null ? "—" : formatMl(average)}
              hint={recorded.length ? `${recorded.length} recorded days` : "No records in range"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Target met"
              value={targetEligibleDays ? `${targetMetDays}/${targetEligibleDays}` : "—"}
              hint={targetEligibleDays ? "Eligible recorded days" : "Not enough data"}
            />
          </CardContent>
        </Card>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Last 30 days</CardTitle>
            <p className="text-xs text-muted-foreground">
              Gaps stay empty. A day without a water record is not treated as zero litres.
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={chart}
              series={[{ key: "water", label: "Water (ml)", color: "#7EC8F5" }]}
              unit=" ml"
              ariaLabel="Water intake by day for the last 30 days"
              yTickFormat="liters"
              valueFormat="water"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="size-4 text-[var(--chart-blue)]" /> Entries on this date
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Newest first. Every line is an auditable event.
            </p>
          </CardHeader>
          <CardContent>
            {day.waterEvents.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No water events saved for this date yet.
              </p>
            ) : (
              <ul className="max-h-[310px] space-y-1.5 overflow-y-auto pr-1">
                {day.waterEvents.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {event.kind === "set" ? "Correction" : event.amount_ml > 0 ? "Addition" : "Removal"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Intl.DateTimeFormat("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(event.created_at))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">
                        {event.amount_ml > 0 ? "+" : ""}
                        {event.amount_ml} ml
                      </p>
                      <p className="text-[10px] text-muted-foreground">→ {formatMl(event.result_ml)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Target className="size-3" /> Recorded coverage
              </span>
              <span className="text-[10px] font-medium">
                {recorded.length ? `${recorded.length} of 30 days` : "No records"} ·{" "}
                {pct(recorded.length ? (recorded.length / 30) * 100 : null)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
