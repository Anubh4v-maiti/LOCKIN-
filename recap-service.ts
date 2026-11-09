import type { LocalClient } from "@/lib/local/db";
import {
  addMonths,
  endOfMonthKey,
  monthKey,
  startOfMonthKey,
  todayInTimeZone,
  type MonthKey,
} from "@/lib/date";
import { fetchHabits, fetchRange, fetchTargetVersions, type RangeData } from "@/lib/queries";
import { computeMonthlyStats, buildNarrative } from "@/lib/recap";
import { enhanceNarrativeWithAi } from "@/lib/ai";
import type { MonthlyNarrative, MonthlyRecap, MonthlyRecapStats, Profile } from "@/lib/types";

function rangeHasData(data: RangeData): boolean {
  return (
    data.logs.length > 0 ||
    data.nutrition.length > 0 ||
    data.water.length > 0 ||
    data.tasks.length > 0 ||
    data.study.length > 0 ||
    data.habitCompletions.length > 0 ||
    data.reflections.length > 0
  );
}

export async function buildRecap(
  supabase: LocalClient,
  userId: string,
  profile: Profile,
  month: MonthKey,
  options: { allowAi?: boolean } = {},
): Promise<{ stats: MonthlyRecapStats; narrative: MonthlyNarrative }> {
  const start = startOfMonthKey(month);
  const end = endOfMonthKey(month);
  const previousMonth = addMonths(month, -1);
  const prevStart = startOfMonthKey(previousMonth);
  const prevEnd = endOfMonthKey(previousMonth);

  const [data, prevData, targets, habits] = await Promise.all([
    fetchRange(supabase, userId, start, end),
    fetchRange(supabase, userId, prevStart, prevEnd),
    fetchTargetVersions(supabase, userId),
    fetchHabits(supabase, userId, true),
  ]);

  const previousStats = rangeHasData(prevData)
    ? computeMonthlyStats({
        month: previousMonth,
        today: todayInTimeZone(profile.timezone),
        weekStartsOn: profile.week_start,
        targets,
        data: prevData,
        habits,
      })
    : null;

  const stats = computeMonthlyStats(
    {
      month,
      today: todayInTimeZone(profile.timezone),
      weekStartsOn: profile.week_start,
      targets,
      data,
      habits,
    },
    previousStats,
  );

  const deterministic = buildNarrative(stats);
  const ai = await enhanceNarrativeWithAi({
    stats,
    fallback: deterministic,
    reflections: stats.notes,
    consent: profile.ai_consent && profile.modules.aiInsights,
  });

  return { stats, narrative: ai ?? deterministic };
}

async function rangeHasAnyRecord(
  supabase: LocalClient,
  userId: string,
  start: string,
  end: string,
): Promise<boolean> {
  const tables = [
    "daily_logs",
    "daily_reflections",
    "nutrition_entries",
    "water_logs",
    "daily_tasks",
    "study_sessions",
    "habit_completions",
  ];
  const results = await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("log_date", start)
        .lte("log_date", end),
    ),
  );
  return results.some((r) => (r.count ?? 0) > 0);
}

export async function generateRecap(input: {
  supabase: LocalClient;
  userId: string;
  profile: Profile;
  month: MonthKey;
  regenerate: boolean;
  allowAi?: boolean;
}): Promise<{ ok: true; recap: MonthlyRecap; existed: boolean } | { ok: false; error: string }> {
  const { supabase, userId, profile, month, regenerate } = input;
  try {
    const { data: existingData, error: existingError } = await supabase
      .from("monthly_recaps")
      .select("*")
      .eq("user_id", userId)
      .eq("month", startOfMonthKey(month))
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    const existing = existingData as MonthlyRecap | null;
    if (existing && !regenerate) return { ok: true, recap: existing, existed: true };

    const { stats, narrative } = await buildRecap(supabase, userId, profile, month, {
      allowAi: input.allowAi,
    });
    const now = new Date().toISOString();

    if (existing) {
      const { error: archiveError } = await supabase.from("monthly_recap_revisions").insert({
        user_id: userId,
        month: startOfMonthKey(month),
        stats: existing.stats,
        narrative: existing.narrative,
        reflection_answers: existing.reflection_answers,
        generated_at: existing.generated_at,
      });
      if (archiveError) throw new Error(archiveError.message);
    }

    const reflectionAnswers = existing?.reflection_answers ?? {};
    const { data, error } = await supabase
      .from("monthly_recaps")
      .upsert(
        {
          user_id: userId,
          month: startOfMonthKey(month),
          stats,
          narrative,
          reflection_answers: reflectionAnswers,
          ai_generated: narrative.generated_by === "ai",
          generated_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,month" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, recap: data as MonthlyRecap, existed: Boolean(existing) };
  } catch (error) {
    console.error("[lockin] recap generation failed", error);
    return { ok: false, error: "The monthly recap could not be generated." };
  }
}

/** Generate the previous month's recap once, if that month has real records. */
export async function ensurePreviousMonthRecap(
  supabase: LocalClient,
  userId: string,
  profile: Profile,
  today: string,
): Promise<void> {
  try {
    const previousMonth = addMonths(monthKey(today), -1);
    const { data: existing } = await supabase
      .from("monthly_recaps")
      .select("id")
      .eq("user_id", userId)
      .eq("month", startOfMonthKey(previousMonth))
      .maybeSingle();
    if (existing) return;

    const start = startOfMonthKey(previousMonth);
    const end = endOfMonthKey(previousMonth);
    const hasData = await rangeHasAnyRecord(supabase, userId, start, end);
    if (!hasData) return;

    // Automatic generation stays deterministic. AI requires an explicit user
    // action even when consent is already enabled.
    await generateRecap({
      supabase,
      userId,
      profile,
      month: previousMonth,
      regenerate: false,
      allowAi: false,
    });
  } catch (error) {
    // Never break the dashboard because an automatic recap could not be built.
    console.error("[lockin] automatic recap check failed", error);
  }
}

export async function fetchRecap(
  supabase: LocalClient,
  userId: string,
  month: MonthKey,
): Promise<MonthlyRecap | null> {
  const { data, error } = await supabase
    .from("monthly_recaps")
    .select("*")
    .eq("user_id", userId)
    .eq("month", startOfMonthKey(month))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MonthlyRecap | null) ?? null;
}

export async function fetchRecapRevisions(
  supabase: LocalClient,
  userId: string,
  month: MonthKey,
): Promise<{ generated_at: string; archived_at: string }[]> {
  const { data, error } = await supabase
    .from("monthly_recap_revisions")
    .select("generated_at, archived_at")
    .eq("user_id", userId)
    .eq("month", startOfMonthKey(month))
    .order("archived_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as { generated_at: string; archived_at: string }[];
}
