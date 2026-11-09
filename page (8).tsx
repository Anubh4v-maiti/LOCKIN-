import Link from "next/link";
import { ArrowRight, BookOpen, ChartSpline, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchDay, fetchRange, fetchTargetVersions } from "@/lib/queries";
import { addDays, eachDate, formatDate, isValidDateKey } from "@/lib/date";
import { macroTargets, resolveTargets, round } from "@/lib/metrics";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/misc";
import { DateNavigator } from "@/components/date-navigator";
import { StudyBoard } from "@/components/study/study-board";
import { BarTrendChart } from "@/components/charts/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Study & focus" };

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected =
    params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;

  const windowStart = addDays(selected, -27);
  const [day, targetVersions, range] = await Promise.all([
    fetchDay(supabase, userId, selected),
    fetchTargetVersions(supabase, userId),
    fetchRange(supabase, userId, windowStart, selected),
  ]);
  const target = resolveTargets(targetVersions, selected);
  const targets = macroTargets(target);

  const minutesByDate = new Map<string, number>();
  for (const session of range.study) {
    minutesByDate.set(session.log_date, (minutesByDate.get(session.log_date) ?? 0) + session.minutes);
  }
  const days = eachDate(windowStart, selected);
  const chart = days.map((date) => ({
    label: formatDate(date, "MMM d"),
    minutes: minutesByDate.get(date) ?? null,
  }));
  const recordedDays = days.filter((date) => minutesByDate.has(date));
  const total28 = recordedDays.reduce((sum, date) => sum + (minutesByDate.get(date) ?? 0), 0);
  const average = recordedDays.length ? round(total28 / recordedDays.length, 0) : null;
  const targetMet = days.filter((date) => {
    const version = resolveTargets(targetVersions, date);
    const value = minutesByDate.get(date);
    return value !== undefined && version?.study_minutes !== null && version?.study_minutes !== undefined && value >= version.study_minutes;
  }).length;

  const subjectTotals = new Map<string, number>();
  for (const session of range.study) {
    subjectTotals.set(session.subject, (subjectTotals.get(session.subject) ?? 0) + session.minutes);
  }
  const subjects = Array.from(subjectTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Study & focus"
        title="Attention, measured honestly."
        description="Use the timer for real focus blocks or log a session manually. Only saved minutes appear in analytics."
        actions={
          <>
            <DateNavigator date={selected} today={today} basePath="/study" />
            <Button asChild variant="outline" size="sm">
              <Link href="/analytics?period=30">
                <ChartSpline className="size-3.5" />
                Trends
              </Link>
            </Button>
          </>
        }
      />

      {targets.study_minutes === null ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Target className="mt-0.5 size-3.5 shrink-0" />
            No study target is set for this date. Sessions still save; target achievement stays blank.
          </p>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/settings#targets">
              Set a study target <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <StudyBoard
        logDate={selected}
        sessions={day.studySessions}
        activeFocus={day.activeFocus}
        targetMinutes={targets.study_minutes}
      />

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <Stat label="Recorded days" value={recordedDays.length} hint="Last 28 days" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Average"
              value={average === null ? "—" : `${formatNumber(average)} min`}
              hint={recordedDays.length ? "Per recorded day" : "No records in range"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Total"
              value={recordedDays.length ? `${formatNumber(total28)} min` : "—"}
              hint={recordedDays.length ? "Last 28 days" : "No records in range"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Stat
              label="Target met"
              value={targets.study_minutes === null ? "—" : `${targetMet}/${recordedDays.length}`}
              hint={targets.study_minutes === null ? "No target configured" : "Recorded days only"}
            />
          </CardContent>
        </Card>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Study minutes · last 28 days</CardTitle>
            <p className="text-xs text-muted-foreground">Unrecorded days remain gaps, not zero-minute failures.</p>
          </CardHeader>
          <CardContent>
            <BarTrendChart
              data={chart}
              series={[{ key: "minutes", label: "Minutes", color: "#B6A5FF" }]}
              unit=" min"
              ariaLabel="Study minutes by day over the last 28 days"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-[var(--chart-lavender)]" /> Subjects
            </CardTitle>
            <p className="text-xs text-muted-foreground">Last 28 days, highest total first.</p>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No study sessions recorded in this range.</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map(([subject, minutes]) => (
                  <li key={subject}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate">{subject}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{minutes} min</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-[var(--chart-lavender)]"
                        style={{ width: `${Math.min(100, (minutes / subjects[0][1]) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
