import { NextResponse, type NextRequest } from "next/server";
import { createLocalClient, LOCAL_USER_ID, type LocalClient } from "@/lib/local/db";
import { eachDate } from "@/lib/date";
import { normalizeProfile, PROFILE_COLUMNS } from "@/lib/profile";
import type {
  DailyLog,
  DailyReflection,
  DailyTask,
  NutritionEntry,
  StudySession,
  WaterLog,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const TABLES = [
  "daily_logs",
  "daily_reflections",
  "nutrition_entries",
  "meals",
  "water_logs",
  "water_events",
  "daily_tasks",
  "reusable_task_templates",
  "habits",
  "habit_completions",
  "study_sessions",
  "focus_sessions",
  "career_goals",
  "career_milestones",
  "target_history",
  "monthly_recaps",
  "monthly_recap_revisions",
] as const;

async function fetchAll(
  supabase: LocalClient,
  table: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCsv(
  logs: DailyLog[],
  nutrition: NutritionEntry[],
  water: WaterLog[],
  tasks: DailyTask[],
  study: StudySession[],
  reflections: DailyReflection[],
): string {
  const dates = new Set<string>();
  for (const row of [...logs, ...nutrition, ...water, ...reflections]) dates.add(row.log_date);
  for (const row of tasks) dates.add(row.log_date);
  for (const row of study) dates.add(row.log_date);
  if (dates.size === 0) {
    return "date,checkin_status,completed_at,calories,protein_g,carbs_g,fat_g,fiber_g,water_ml,tasks_planned,tasks_completed,study_minutes,rating,win,mistake,improvement\n";
  }
  const sorted = Array.from(dates).sort();
  // Fill gaps for normal spans. For an unusually long history, fall back to the
  // dates that actually contain records rather than returning only a header.
  const expanded = eachDate(sorted[0], sorted[sorted.length - 1], 40_000);
  const allDates = expanded.length ? expanded : sorted;
  const byDate = <T extends { log_date: string }>(rows: T[]) => new Map(rows.map((r) => [r.log_date, r]));

  const logMap = byDate(logs);
  const nutritionMap = byDate(nutrition);
  const waterMap = byDate(water);
  const reflectionMap = byDate(reflections);
  const taskMap = new Map<string, DailyTask[]>();
  for (const task of tasks) taskMap.set(task.log_date, [...(taskMap.get(task.log_date) ?? []), task]);
  const studyMap = new Map<string, number>();
  for (const session of study) {
    studyMap.set(session.log_date, (studyMap.get(session.log_date) ?? 0) + session.minutes);
  }

  const header = [
    "date",
    "checkin_status",
    "completed_at",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "water_ml",
    "tasks_planned",
    "tasks_completed",
    "study_minutes",
    "rating",
    "win",
    "mistake",
    "improvement",
  ];
  const lines = [header.join(",")];
  for (const date of allDates) {
    const dayTasks = taskMap.get(date) ?? [];
    const n = nutritionMap.get(date);
    const w = waterMap.get(date);
    const l = logMap.get(date);
    const r = reflectionMap.get(date);
    lines.push(
      [
        date,
        l?.checkin_status ?? "",
        l?.completed_at ?? "",
        n?.calories ?? "",
        n?.protein_g ?? "",
        n?.carbs_g ?? "",
        n?.fat_g ?? "",
        n?.fiber_g ?? "",
        w?.total_ml ?? "",
        dayTasks.length || "",
        dayTasks.filter((t) => t.completed).length || (dayTasks.length ? 0 : ""),
        studyMap.get(date) ?? "",
        r?.rating ?? "",
        r?.win ?? "",
        r?.mistake ?? "",
        r?.improvement ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function GET(request: NextRequest) {
  const supabase = createLocalClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    if (format === "json") {
      const profileResult = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", LOCAL_USER_ID)
        .single();
      if (profileResult.error) throw new Error(profileResult.error.message);

      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const table of TABLES) {
        tables[table] = await fetchAll(supabase, table, LOCAL_USER_ID);
      }

      const payload = {
        application: "LOCKIN",
        export_version: 1,
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, storage: "local" },
        profile: normalizeProfile(profileResult.data as Record<string, unknown>),
        tables,
      };
      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="lockin-export-${stamp}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const [logs, nutrition, water, tasks, study, reflections] = await Promise.all([
      fetchAll(supabase, "daily_logs", LOCAL_USER_ID),
      fetchAll(supabase, "nutrition_entries", LOCAL_USER_ID),
      fetchAll(supabase, "water_logs", LOCAL_USER_ID),
      fetchAll(supabase, "daily_tasks", LOCAL_USER_ID),
      fetchAll(supabase, "study_sessions", LOCAL_USER_ID),
      fetchAll(supabase, "daily_reflections", LOCAL_USER_ID),
    ]);
    const csv = buildCsv(
      logs as unknown as DailyLog[],
      nutrition as unknown as NutritionEntry[],
      water as unknown as WaterLog[],
      tasks as unknown as DailyTask[],
      study as unknown as StudySession[],
      reflections as unknown as DailyReflection[],
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lockin-daily-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[lockin] export failed", error);
    return NextResponse.json(
      { error: "Export failed. Please try again." },
      { status: 500 },
    );
  }
}
