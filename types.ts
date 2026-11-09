import type { DateFormat, DateKey, MonthKey } from "@/lib/date";

export type ThemePreference = "dark" | "light" | "system";
export type CheckinStatus = "none" | "partial" | "complete";
export type TaskPriority = "low" | "medium" | "high";
export type TaskCategory =
  | "study"
  | "fitness"
  | "nutrition"
  | "personal"
  | "career"
  | "projects"
  | "other";
export type WaterEventKind = "add" | "remove" | "set";
export type StudySource = "manual" | "timer";
export type FocusStatus = "running" | "paused" | "finished" | "abandoned";
export type CareerStatus = "planned" | "in_progress" | "completed" | "paused";

export interface ModulePreferences {
  meals: boolean;
  study: boolean;
  habits: boolean;
  career: boolean;
  aiInsights: boolean;
}

export const DEFAULT_MODULES: ModulePreferences = {
  meals: false,
  study: true,
  habits: true,
  career: true,
  aiInsights: false,
};

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  date_format: DateFormat;
  week_start: 0 | 1;
  theme: ThemePreference;
  modules: ModulePreferences;
  reminder_enabled: boolean;
  reminder_time: string | null;
  onboarded: boolean;
  ai_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: DateKey;
  checkin_status: Exclude<CheckinStatus, "none">;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionEntry {
  id: string;
  user_id: string;
  log_date: DateKey;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  notes: string | null;
  source: "manual" | "meals";
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  user_id: string;
  log_date: DateKey;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  quantity: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  created_at: string;
  updated_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  log_date: DateKey;
  total_ml: number;
  updated_at: string;
}

export interface WaterEvent {
  id: string;
  user_id: string;
  log_date: DateKey;
  amount_ml: number;
  result_ml: number;
  kind: WaterEventKind;
  created_at: string;
}

export interface DailyTask {
  id: string;
  user_id: string;
  log_date: DateKey;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  position: number;
  due_at: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  position: number;
  archived: boolean;
  created_at: string;
}

export interface DailyReflection {
  id: string;
  user_id: string;
  log_date: DateKey;
  rating: number | null;
  win: string | null;
  mistake: string | null;
  improvement: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  schedule_days: number[];
  target_per_week: number | null;
  active: boolean;
  created_at: string;
  archived_at: string | null;
}

export interface HabitCompletion {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: DateKey;
  completed: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  log_date: DateKey;
  subject: string;
  topic: string | null;
  minutes: number;
  planned_minutes: number | null;
  distractions: string | null;
  notes: string | null;
  source: StudySource;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  log_date: DateKey;
  subject: string;
  topic: string | null;
  planned_minutes: number;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  accumulated_seconds: number;
  status: FocusStatus;
  created_at: string;
}

export interface CareerGoal {
  id: string;
  user_id: string;
  title: string;
  category: string | null;
  status: CareerStatus;
  target_date: DateKey | null;
  progress: number;
  notes: string | null;
  resource_url: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareerMilestone {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  due_date: DateKey | null;
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export interface TargetVersion {
  id: string;
  user_id: string;
  effective_from: DateKey;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  water_ml: number | null;
  study_minutes: number | null;
  created_at: string;
}

export interface MonthlyRecapStats {
  month: MonthKey;
  start_date: DateKey;
  end_date: DateKey;
  total_days: number;
  elapsed_days: number;
  checkin_days: number;
  partial_days: number;
  nutrition_days: number;
  water_days: number;
  task_days: number;
  planned_tasks: number;
  completed_tasks: number;
  task_completion_rate: number | null;
  avg_calories: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
  avg_fiber_g: number | null;
  avg_water_ml: number | null;
  target_met: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    water: number | null;
    study: number | null;
    tasks: number | null;
  };
  eligible_target_days: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    water: number;
    study: number;
    tasks: number;
  };
  longest_streak: number;
  current_streak_at_end: number;
  study_minutes: number;
  study_sessions: number;
  study_days: number;
  habit_scheduled: number;
  habit_completed: number;
  habit_missed: number;
  habit_no_record: number;
  habit_completion_rate: number | null;
  strongest_week: { start: DateKey; checkins: number; label: string } | null;
  weakest_week: { start: DateKey; checkins: number; label: string } | null;
  best_day: { date: DateKey; score: number; reason: string } | null;
  hardest_day: { date: DateKey; score: number; reason: string } | null;
  frequent_tasks: { title: string; completed: number; total: number }[];
  incomplete_tasks: { title: string; missed: number; total: number }[];
  notes: {
    wins: string[];
    mistakes: string[];
    improvements: string[];
    ratings: number[];
  };
  previous: {
    month: MonthKey;
    checkin_days: number | null;
    avg_calories: number | null;
    avg_protein_g: number | null;
    avg_water_ml: number | null;
    task_completion_rate: number | null;
    study_minutes: number | null;
    habit_completion_rate: number | null;
  } | null;
  warnings: string[];
}

export interface RecapObstacle {
  observed: string;
  possible?: string;
}

export interface MonthlyNarrative {
  summary: string;
  wins: string[];
  obstacles: RecapObstacle[];
  plan: {
    continue: string[];
    improve: string[];
    simplify: string[];
    consistency_target: string;
    focus: string;
  };
  generated_by: "deterministic" | "ai";
}

export interface MonthlyRecap {
  id: string;
  user_id: string;
  month: MonthKey;
  stats: MonthlyRecapStats;
  narrative: MonthlyNarrative;
  reflection_answers: Record<string, string>;
  generated_at: string;
  updated_at: string;
  ai_generated: boolean;
}

export interface MonthlyRecapRevision {
  id: string;
  user_id: string;
  month: MonthKey;
  stats: MonthlyRecapStats;
  narrative: MonthlyNarrative;
  reflection_answers: Record<string, string>;
  generated_at: string;
  archived_at: string;
}

export const TASK_CATEGORIES: { value: TaskCategory; label: string; color: string }[] = [
  { value: "study", label: "Study", color: "#82B7FF" },
  { value: "fitness", label: "Fitness", color: "#C5F467" },
  { value: "nutrition", label: "Nutrition", color: "#7EE7C1" },
  { value: "personal", label: "Personal", color: "#B6A5FF" },
  { value: "career", label: "Career", color: "#F5CE73" },
  { value: "projects", label: "Projects", color: "#FF9E9E" },
  { value: "other", label: "Other", color: "#9299A8" },
];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<TaskCategory, string>;

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const RECAP_QUESTIONS = [
  { key: "biggest_win", label: "What was my biggest win?" },
  { key: "wasted_time", label: "What wasted the most time?" },
  { key: "helpful_habits", label: "Which habits helped me most?" },
  { key: "repeating_mistake", label: "What mistake kept repeating?" },
  { key: "stop_doing", label: "What should I stop doing?" },
  { key: "do_differently", label: "What will I do differently next month?" },
] as const;

export interface AppContext {
  userId: string;
  email: string;
  profile: Profile;
  today: DateKey;
}
