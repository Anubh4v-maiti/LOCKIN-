import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchDay, fetchTemplates } from "@/lib/queries";
import { formatDate, isValidDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DateNavigator } from "@/components/date-navigator";
import { TaskBoard } from "@/components/tasks/task-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected = params.date && isValidDateKey(params.date) ? params.date : today;

  const [day, templates] = await Promise.all([
    fetchDay(supabase, userId, selected),
    fetchTemplates(supabase, userId),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="To-do list"
        title="A list you can actually finish."
        description="Plan only what fits the day. Tasks are stored per date, so history stays accurate."
        actions={
          <>
            <DateNavigator date={selected} today={today} basePath="/tasks" allowFuture />
            <Button asChild variant="outline" size="sm">
              <Link href={`/check-in?date=${selected}`}>
                <ClipboardCheck className="size-3.5" />
                Check-in
              </Link>
            </Button>
          </>
        }
      />

      {selected > today ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/[0.05] px-3 py-2.5 text-xs text-muted-foreground">
          <ArrowRight className="size-3.5 text-secondary" />
          You are planning ahead for {formatDate(selected, "MMM d, yyyy")}. Tasks can be planned for
          the future; completions and check-ins cannot.
        </div>
      ) : null}

      <TaskBoard
        logDate={selected}
        today={today}
        initialTasks={day.tasks}
        templates={templates}
      />

      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3 text-primary" />
          Completion is calculated from the tasks you actually planned for this date.
        </span>
        <Link href={`/calendar?date=${selected}`} className="shrink-0 text-primary hover:underline">
          View in history
        </Link>
      </div>
    </div>
  );
}
