import type { LocalClient } from "@/lib/local/db";
import type { DateKey } from "@/lib/date";
import type {
  CareerGoal,
  CareerMilestone,
  DailyLog,
  DailyReflection,
  DailyTask,
  FocusSession,
  Habit,
  HabitCompletion,
  Meal,
  NutritionEntry,
  StudySession,
  TargetVersion,
  TaskTemplate,
  WaterEvent,
  WaterLog,
} from "@/lib/types";

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export interface DayData {
  dailyLog: DailyLog | null;
  reflection: DailyReflection | null;
  nutrition: NutritionEntry | null;
  meals: Meal[];
  water: WaterLog | null;
  waterEvents: WaterEvent[];
  tasks: DailyTask[];
  studySessions: StudySession[];
  activeFocus: FocusSession | null;
  habitCompletions: HabitCompletion[];
}

export async function fetchDay(
  supabase: LocalClient,
  userId: string,
  date: DateKey,
): Promise<DayData> {
  const [
    dailyLog,
    reflection,
    nutrition,
    meals,
    water,
    waterEvents,
    tasks,
    studySessions,
    activeFocus,
    habitCompletions,
  ] = await Promise.all([
    supabase.from("daily_logs").select("*").eq("user_id", userId).eq("log_date", date).maybeSingle(),
    supabase.from("daily_reflections").select("*").eq("user_id", userId).eq("log_date", date).maybeSingle(),
    supabase.from("nutrition_entries").select("*").eq("user_id", userId).eq("log_date", date).maybeSingle(),
    supabase.from("meals").select("*").eq("user_id", userId).eq("log_date", date).order("created_at"),
    supabase.from("water_logs").select("*").eq("user_id", userId).eq("log_date", date).maybeSingle(),
    supabase
      .from("water_events")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", date)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", date)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", date)
      .order("created_at"),
    supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .maybeSingle(),
    supabase.from("habit_completions").select("*").eq("user_id", userId).eq("log_date", date),
  ]);

  return {
    dailyLog: check(dailyLog) as DailyLog | null,
    reflection: check(reflection) as DailyReflection | null,
    nutrition: check(nutrition) as NutritionEntry | null,
    meals: (check(meals) ?? []) as Meal[],
    water: check(water) as WaterLog | null,
    waterEvents: (check(waterEvents) ?? []) as WaterEvent[],
    tasks: (check(tasks) ?? []) as DailyTask[],
    studySessions: (check(studySessions) ?? []) as StudySession[],
    activeFocus: check(activeFocus) as FocusSession | null,
    habitCompletions: (check(habitCompletions) ?? []) as HabitCompletion[],
  };
}

export interface RangeData {
  logs: DailyLog[];
  reflections: DailyReflection[];
  nutrition: NutritionEntry[];
  water: WaterLog[];
  tasks: DailyTask[];
  study: StudySession[];
  habitCompletions: HabitCompletion[];
  meals: Meal[];
}

export async function fetchRange(
  supabase: LocalClient,
  userId: string,
  start: DateKey,
  end: DateKey,
): Promise<RangeData> {
  const [logs, reflections, nutrition, water, tasks, study, habitCompletions, meals] =
    await Promise.all([
      supabase.from("daily_logs").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("daily_reflections").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("nutrition_entries").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("water_logs").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("daily_tasks").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date").order("position"),
      supabase.from("study_sessions").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("habit_completions").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
      supabase.from("meals").select("*").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date"),
    ]);
  return {
    logs: (check(logs) ?? []) as DailyLog[],
    reflections: (check(reflections) ?? []) as DailyReflection[],
    nutrition: (check(nutrition) ?? []) as NutritionEntry[],
    water: (check(water) ?? []) as WaterLog[],
    tasks: (check(tasks) ?? []) as DailyTask[],
    study: (check(study) ?? []) as StudySession[],
    habitCompletions: (check(habitCompletions) ?? []) as HabitCompletion[],
    meals: (check(meals) ?? []) as Meal[],
  };
}

export async function fetchTargetVersions(
  supabase: LocalClient,
  userId: string,
): Promise<TargetVersion[]> {
  const result = await supabase
    .from("target_history")
    .select("*")
    .eq("user_id", userId)
    .order("effective_from", { ascending: false });
  return (check(result) ?? []) as TargetVersion[];
}

export async function fetchCompletedDates(
  supabase: LocalClient,
  userId: string,
  upTo: DateKey,
  limit = 1500,
): Promise<DateKey[]> {
  const result = await supabase
    .from("daily_logs")
    .select("log_date")
    .eq("user_id", userId)
    .eq("checkin_status", "complete")
    .lte("log_date", upTo)
    .order("log_date", { ascending: false })
    .limit(limit);
  return ((check(result) ?? []) as { log_date: DateKey }[]).map((row) => row.log_date);
}

export async function fetchHabits(
  supabase: LocalClient,
  userId: string,
  includeArchived = false,
): Promise<Habit[]> {
  let query = supabase.from("habits").select("*").eq("user_id", userId);
  if (!includeArchived) query = query.eq("active", true);
  const result = await query.order("created_at");
  return (check(result) ?? []) as Habit[];
}

export async function fetchTemplates(
  supabase: LocalClient,
  userId: string,
): Promise<TaskTemplate[]> {
  const result = await supabase
    .from("reusable_task_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("position");
  return (check(result) ?? []) as TaskTemplate[];
}

export async function fetchCareer(
  supabase: LocalClient,
  userId: string,
): Promise<{ goals: CareerGoal[]; milestones: CareerMilestone[] }> {
  const [goals, milestones] = await Promise.all([
    supabase.from("career_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("career_milestones")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  return {
    goals: (check(goals) ?? []) as CareerGoal[],
    milestones: (check(milestones) ?? []) as CareerMilestone[],
  };
}

export async function fetchFocusActive(
  supabase: LocalClient,
  userId: string,
): Promise<FocusSession | null> {
  const result = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["running", "paused"])
    .maybeSingle();
  return check(result) as FocusSession | null;
}

export async function fetchStudyRange(
  supabase: LocalClient,
  userId: string,
  start: DateKey,
  end: DateKey,
): Promise<StudySession[]> {
  const result = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", start)
    .lte("log_date", end)
    .order("log_date");
  return (check(result) ?? []) as StudySession[];
}
