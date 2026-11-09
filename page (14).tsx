import Link from "next/link";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fetchCompletedDates, fetchDay, fetchTargetVersions } from "@/lib/queries";
import { checkinStreaks, macroTargets, resolveTargets } from "@/lib/metrics";
import { formatDate, relativeDateLabel, isValidDateKey } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DateNavigator } from "@/components/date-navigator";
import { CheckinForm } from "@/components/checkin/checkin-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily check-in" };

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, userId, profile, today } = await requireUser();
  const params = await searchParams;
  const selected =
    params.date && isValidDateKey(params.date) && params.date <= today ? params.date : today;

  const [day, targetVersions, completedDates] = await Promise.all([
    fetchDay(supabase, userId, selected),
    fetchTargetVersions(supabase, userId),
    fetchCompletedDates(supabase, userId, today),
  ]);
  const target = resolveTargets(targetVersions, selected);
  const targets = macroTargets(target);
  const streak = checkinStreaks(completedDates, today);

  return (
    <div>
      <PageHeader
        eyebrow="Daily check-in"
        title={relativeDateLabel(selected, today)}
        description={`${formatDate(selected, profile.date_format)} · One honest record of the day. Two minutes is enough.`}
        actions={
          <>
            <DateNavigator date={selected} today={today} basePath="/check-in" />
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">
                <ClipboardCheck className="size-3.5" />
                Dashboard
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-primary" />
        Only you can read this record. Missing entries are never converted to zero.
        {streak.current > 0 ? ` You have ${streak.current} consecutive completed ${streak.current === 1 ? "day" : "days"}.` : ""}
      </div>

      <CheckinForm
        logDate={selected}
        today={today}
        dailyLog={day.dailyLog}
        reflection={day.reflection}
        nutrition={day.nutrition}
        water={day.water}
        targets={targets}
        streak={streak.current}
      />
    </div>
  );
}
