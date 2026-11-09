import Link from "next/link";
import { ChartSpline, Repeat2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchHabits, fetchRange } from "@/lib/queries";
import { endOfWeek, isValidDateKey, startOfWeek } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DateNavigator } from "@/components/date-navigator";
import { HabitBoard } from "@/components/habits/habit-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Habits" };

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected =
    params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;
  const weekStart = startOfWeek(selected, profile.week_start);
  const weekEnd = endOfWeek(selected, profile.week_start);

  const [habits, weekData] = await Promise.all([
    fetchHabits(supabase, userId),
    fetchRange(supabase, userId, weekStart, weekEnd),
  ]);

  const recordedDates = Array.from(
    new Set([
      ...weekData.logs.map((row) => row.log_date),
      ...weekData.reflections.map((row) => row.log_date),
      ...weekData.nutrition.map((row) => row.log_date),
      ...weekData.water.map((row) => row.log_date),
      ...weekData.tasks.map((row) => row.log_date),
      ...weekData.study.map((row) => row.log_date),
      ...weekData.habitCompletions.map((row) => row.log_date),
    ]),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Habits & routines"
        title="Repeat what matters. Rest without penalty."
        description="Scheduled days are the denominator. Days with no daily record stay unassessed, not failed."
        actions={
          <>
            <DateNavigator date={selected} today={today} basePath="/habits" />
            <Button asChild variant="outline" size="sm">
              <Link href="/analytics?period=30">
                <ChartSpline className="size-3.5" />
                Trends
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <Repeat2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Editing the schedule applies going forward; past completed records are never deleted. Archived
        habits keep their history.
      </div>

      <HabitBoard
        habits={habits}
        completions={weekData.habitCompletions}
        selectedDate={selected}
        today={today}
        weekStart={weekStart}
        weekEnd={weekEnd}
        todayRecorded={recordedDates.includes(today)}
        recordedDates={recordedDates}
      />
    </div>
  );
}
