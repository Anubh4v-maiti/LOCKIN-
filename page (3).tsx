import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  History,
  Info,
  Lightbulb,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchRange } from "@/lib/queries";
import { fetchRecap, fetchRecapRevisions } from "@/lib/recap-service";
import {
  addMonths,
  endOfMonthKey,
  formatDate,
  formatMonth,
  isValidMonthKey,
  monthKey,
  startOfMonthKey,
} from "@/lib/date";
import { cn, formatMl, formatNumber, pct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { RecapActions } from "@/components/recap/recap-actions";
import type { MonthlyRecapStats } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly recap" };

function TargetRow({
  label,
  met,
  eligible,
  unit,
}: {
  label: string;
  met: number | null;
  eligible: number;
  unit?: string;
}) {
  const value = met ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {eligible > 0 ? `${value}/${eligible}${unit ?? ""}` : "—"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${eligible > 0 ? (value / eligible) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-2/30 p-3">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="metric mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const currentMonth = monthKey(today);
  const month = params.month && isValidMonthKey(params.month) && params.month <= currentMonth ? params.month : currentMonth;
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const canGoNext = nextMonth <= currentMonth;

  const [recap, revisions, monthData] = await Promise.all([
    fetchRecap(supabase, userId, month),
    fetchRecapRevisions(supabase, userId, month),
    fetchRange(supabase, userId, startOfMonthKey(month), endOfMonthKey(month)),
  ]);
  const hasData =
    monthData.logs.length > 0 ||
    monthData.nutrition.length > 0 ||
    monthData.water.length > 0 ||
    monthData.tasks.length > 0 ||
    monthData.study.length > 0 ||
    monthData.habitCompletions.length > 0 ||
    monthData.reflections.length > 0;
  const stats: MonthlyRecapStats | null = recap?.stats ?? null;
  const narrative = recap?.narrative ?? null;

  return (
    <div className="print-full">
      <PageHeader
        eyebrow="Monthly recap"
        title={formatMonth(month)}
        description="A saved, evidence-bound review of the month. Regeneration archives the previous version instead of erasing it."
        actions={
          <div className="no-print flex items-center gap-1.5">
            <Button asChild variant="outline" size="icon-sm" aria-label="Previous month">
              <Link href={`/recap?month=${previousMonth}`}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant={month === currentMonth ? "default" : "outline"} size="sm">
              <Link href="/recap">This month</Link>
            </Button>
            {canGoNext ? (
              <Button asChild variant="outline" size="icon-sm" aria-label="Next month">
                <Link href={`/recap?month=${nextMonth}`}>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="icon-sm" disabled aria-label="No future recap">
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        }
      />

      <RecapActions
        month={month}
        hasRecap={Boolean(recap)}
        initialAnswers={recap?.reflection_answers ?? {}}
        aiEnabled={profile.ai_consent && profile.modules.aiInsights}
        hasData={hasData}
      />

      {!recap ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="empty-illustration">
                <Sparkles className="size-5" />
              </div>
              <p className="mt-4 font-display text-base font-semibold">No recap saved for {formatMonth(month)}.</p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {hasData
                  ? "The month has saved records. Generate a recap above to turn them into an honest summary."
                  : "The month has no saved records. A recap can still be generated, but it will explicitly say there is not enough evidence. No zeros are invented."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>What a recap contains</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>A plain-language summary, wins, repeated obstacles, and next-month plan.</p>
              <p>Check-in, task, nutrition, water, study and habit statistics with eligible denominators.</p>
              <p>Your own monthly reflection answers, saved as context rather than data.</p>
              <p>CSV export, print layout and browser PDF saving.</p>
              <p>Optional AI narration only when you enable both the AI module and consent in Settings.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={recap.ai_generated ? "secondary" : "default"}>
              <Sparkles className="size-3" />
              {narrative?.generated_by === "ai" ? "AI-assisted narration" : "Deterministic narration"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Generated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(recap.generated_at))}
            </span>
            {recap.ai_generated ? (
              <span className="text-[10px] text-muted-foreground">· Statistics always come from your saved records.</span>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> The month in one page
              </CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">{narrative?.summary}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <StatBox label="Elapsed days" value={stats?.elapsed_days ?? "—"} />
                <StatBox label="Completed check-ins" value={`${stats?.checkin_days ?? 0}/${stats?.elapsed_days ?? 0}`} hint="Explicit completions" />
                <StatBox label="Tasks" value={`${stats?.completed_tasks ?? 0}/${stats?.planned_tasks ?? 0}`} hint="Completed / planned" />
                <StatBox label="Avg calories" value={stats?.avg_calories === null ? "—" : formatNumber(stats?.avg_calories)} hint={`${stats?.nutrition_days ?? 0} recorded days`} />
                <StatBox label="Avg water" value={stats?.avg_water_ml === null ? "—" : formatMl(stats?.avg_water_ml)} hint={`${stats?.water_days ?? 0} recorded days`} />
                <StatBox label="Study" value={stats?.study_days ? `${formatNumber(stats.study_minutes)} min` : "—"} hint={`${stats?.study_days ?? 0} recorded days`} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" /> Wins that are actually supported
                </CardTitle>
              </CardHeader>
              <CardContent>
                {narrative?.wins.length ? (
                  <ul className="space-y-2">
                    {narrative.wins.map((win, index) => (
                      <li key={index} className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />
                        <span>{win}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No supported win could be identified.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-warning" /> Obstacles observed
                </CardTitle>
              </CardHeader>
              <CardContent>
                {narrative?.obstacles.length ? (
                  <ul className="space-y-2.5">
                    {narrative.obstacles.map((obstacle, index) => (
                      <li key={index} className="rounded-lg border border-border/60 bg-surface-2/25 p-2.5">
                        <p className="text-[11px] leading-relaxed">{obstacle.observed}</p>
                        {obstacle.possible ? (
                          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{obstacle.possible}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No repeated obstacle was identified.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="size-4 text-secondary" /> Consistency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Check-in coverage</span>
                    <span className="font-semibold text-foreground">{pct(stats && stats.elapsed_days ? (stats.checkin_days / stats.elapsed_days) * 100 : null)}</span>
                  </div>
                  <Progress value={stats && stats.elapsed_days ? (stats.checkin_days / stats.elapsed_days) * 100 : null} className="mt-1" label="Check-in coverage" />
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {stats?.partial_days ?? 0} partial draft {stats?.partial_days === 1 ? "day" : "days"} remained incomplete and are not counted as check-ins.
                </p>
                <StatBox label="Longest streak" value={`${stats?.longest_streak ?? 0} days`} hint={`${stats?.current_streak_at_end ?? 0} at month end`} />
                {stats?.strongest_week ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Strongest week: <span className="text-foreground">{stats.strongest_week.label}</span> with {stats.strongest_week.checkins} check-ins.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-4 text-[var(--chart-lime)]" /> Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <TargetRow label="Calories (±10%)" met={stats?.target_met.calories ?? null} eligible={stats?.eligible_target_days.calories ?? 0} />
                <TargetRow label="Protein minimum" met={stats?.target_met.protein ?? null} eligible={stats?.eligible_target_days.protein ?? 0} />
                <TargetRow label="Water" met={stats?.target_met.water ?? null} eligible={stats?.eligible_target_days.water ?? 0} />
                <TargetRow label="Study" met={stats?.target_met.study ?? null} eligible={stats?.eligible_target_days.study ?? 0} />
                <TargetRow label="All tasks done" met={stats?.target_met.tasks ?? null} eligible={stats?.eligible_target_days.tasks ?? 0} />
                <p className="text-[9px] leading-relaxed text-muted-foreground">
                  Eligible means both a configured target and a recorded value. Missing data is excluded.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4 text-[var(--chart-lavender)]" /> Moments
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] text-muted-foreground">
                {stats?.best_day ? (
                  <p><span className="text-foreground">Best day:</span> {formatDate(stats.best_day.date, "MMM d")} · {stats.best_day.score}/100 · {stats.best_day.reason}.</p>
                ) : <p>No best day can be identified from the saved evidence.</p>}
                {stats?.hardest_day ? (
                  <p><span className="text-foreground">Most limited:</span> {formatDate(stats.hardest_day.date, "MMM d")} · {stats.hardest_day.reason}.</p>
                ) : null}
                <p><span className="text-foreground">Habits:</span> {stats?.habit_completed ?? 0} completed of {stats?.habit_scheduled ?? 0} scheduled, {stats?.habit_no_record ?? 0} unassessed.</p>
                {stats?.incomplete_tasks.length ? (
                  <p><span className="text-foreground">Repeated miss:</span> “{stats.incomplete_tasks[0].title}” left incomplete {stats.incomplete_tasks[0].missed} times.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4 text-primary" /> Next month, realistically
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Continue</p>
                <ul className="space-y-1.5">
                  {narrative?.plan.continue.map((item, index) => (
                    <li key={index} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <ChevronRight className="mt-0.5 size-3 shrink-0 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Improve</p>
                <ul className="space-y-1.5">
                  {narrative?.plan.improve.map((item, index) => (
                    <li key={index} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <TrendingUp className="mt-0.5 size-3 shrink-0 text-secondary" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Simplify</p>
                <ul className="space-y-1.5">
                  {narrative?.plan.simplify.map((item, index) => (
                    <li key={index} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <Lightbulb className="mt-0.5 size-3 shrink-0 text-[var(--chart-amber)]" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Focus</p>
                <p className="mt-1 text-[11px] leading-relaxed">{narrative?.plan.focus}</p>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Consistency target: {narrative?.plan.consistency_target}
                </p>
              </div>
            </CardContent>
          </Card>

          {stats?.notes && (stats.notes.wins.length || stats.notes.mistakes.length || stats.notes.improvements.length) ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-secondary" /> In your own words
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {[
                  { label: "Wins you recorded", items: stats.notes.wins },
                  { label: "Obstacles you recorded", items: stats.notes.mistakes },
                  { label: "Changes you named", items: stats.notes.improvements },
                ].map((section) => (
                  <div key={section.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</p>
                    {section.items.length ? (
                      <ul className="mt-1.5 space-y-1">
                        {section.items.slice(0, 8).map((item, index) => (
                          <li key={index} className="text-[10px] leading-relaxed text-foreground/80">“{item}”</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">None recorded.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {stats?.warnings.length ? (
            <Card className="border-warning/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Info className="size-4 text-warning" /> Data notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {stats.warnings.map((warning, index) => (
                    <li key={index} className="text-[10px] leading-relaxed text-muted-foreground">• {warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {revisions.length ? (
            <Card className="no-print">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-4 text-muted-foreground" /> Previous versions
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Regenerating creates an archive snapshot. Earlier versions are preserved here and are not silently overwritten.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {revisions.map((revision, index) => (
                    <li key={`${revision.archived_at}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-2/25 px-3 py-2 text-[10px]">
                      <span className="text-muted-foreground">Archived {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.archived_at))}</span>
                      <span className="text-muted-foreground">Originally generated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(revision.generated_at))}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <p className="no-print text-center text-[10px] leading-relaxed text-muted-foreground">
            AI is off by default. When enabled, it can only rephrase statistics from this saved recap
            — it never creates new facts. Export or print this page from the buttons above.
          </p>
        </div>
      )}
    </div>
  );
}
