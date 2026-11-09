import { z } from "zod";
import { DATE_FORMATS, isValidDateKey } from "@/lib/date";
import { TASK_CATEGORIES } from "@/lib/types";

export const dateKeySchema = z
  .string()
  .refine((v) => isValidDateKey(v), "Enter a valid calendar date (YYYY-MM-DD).");

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Enter a valid month (YYYY-MM).");

const emptyToNull = (value: unknown) => {
  if (value === "" || value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const nullableNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (value) => {
      const v = emptyToNull(value);
      if (v === null) return null;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      return v;
    },
    z
      .number({ invalid_type_error: `${label} must be a number.` })
      .min(min, `${label} cannot be below ${min}.`)
      .max(max, `${label} cannot exceed ${max}.`)
      .nullable(),
  );

export const textOrNull = (max: number, label = "Text") =>
  z.preprocess(
    (value) => emptyToNull(value),
    z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).nullable(),
  );


export const dateTimeOrNull = (label = "Date and time") =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .max(40, `${label} is too long.`)
      .refine(
        (value) =>
          isValidDateKey(value) ||
          (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))),
        `${label} must be a valid date or date-time.`,
      )
      .nullable(),
  );

export const taskCategorySchema = z.enum(
  TASK_CATEGORIES.map((c) => c.value) as [string, ...string[]],
);

export const themeSchema = z.enum(["dark", "light", "system"]);
export const dateFormatSchema = z.enum(DATE_FORMATS as unknown as [string, ...string[]]);

export const settingsSchema = z.object({
  display_name: z.string().trim().min(1, "Add a display name.").max(80),
  timezone: z.string().min(1),
  date_format: dateFormatSchema,
  week_start: z.coerce.number().int().min(0).max(1),
  theme: themeSchema,
  modules: z.object({
    meals: z.boolean(),
    study: z.boolean(),
    habits: z.boolean(),
    career: z.boolean(),
    aiInsights: z.boolean(),
  }),
  reminder_enabled: z.boolean(),
  reminder_time: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 20:30.")
      .nullable(),
  ),
  ai_consent: z.boolean(),
});

export const targetSchema = z.object({
  effective_from: dateKeySchema,
  calories: nullableNumber(0, 20000, "Calories"),
  protein_g: nullableNumber(0, 1000, "Protein"),
  carbs_g: nullableNumber(0, 2000, "Carbohydrates"),
  fat_g: nullableNumber(0, 1000, "Fat"),
  fiber_g: nullableNumber(0, 500, "Fiber"),
  water_ml: nullableNumber(0, 20000, "Water"),
  study_minutes: nullableNumber(0, 1440, "Study time"),
});

export const nutritionSchema = z
  .object({
    log_date: dateKeySchema,
    calories: nullableNumber(0, 20000, "Calories"),
    protein_g: nullableNumber(0, 1000, "Protein"),
    carbs_g: nullableNumber(0, 2000, "Carbohydrates"),
    fat_g: nullableNumber(0, 1000, "Fat"),
    fiber_g: nullableNumber(0, 500, "Fiber"),
    notes: textOrNull(2000, "Notes"),
  })
  .refine(
    (v) =>
      v.calories !== null ||
      v.protein_g !== null ||
      v.carbs_g !== null ||
      v.fat_g !== null ||
      v.fiber_g !== null ||
      (v.notes?.length ?? 0) > 0,
    { message: "Enter at least one nutrition value or note.", path: ["calories"] },
  );

export const mealSchema = z.object({
  id: z.string().uuid().optional(),
  log_date: dateKeySchema,
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  name: z.string().trim().min(1, "Add a food name.").max(160),
  quantity: textOrNull(80, "Quantity"),
  calories: nullableNumber(0, 20000, "Calories"),
  protein_g: nullableNumber(0, 2000, "Protein"),
  carbs_g: nullableNumber(0, 4000, "Carbohydrates"),
  fat_g: nullableNumber(0, 2000, "Fat"),
  fiber_g: nullableNumber(0, 500, "Fiber"),
});

export const waterAddSchema = z.object({
  log_date: dateKeySchema,
  amount_ml: z.coerce.number().int().min(1, "Add at least 1 ml.").max(20000, "That is too much for one entry."),
});

export const waterSetSchema = z.object({
  log_date: dateKeySchema,
  total_ml: z.coerce.number().int().min(0, "Total cannot be negative.").max(30000, "That is too much water."),
});

export const taskSchema = z.object({
  id: z.string().uuid().optional(),
  log_date: dateKeySchema,
  title: z.string().trim().min(1, "Add a task title.").max(200),
  description: textOrNull(2000, "Description"),
  category: taskCategorySchema,
  priority: z.enum(["low", "medium", "high"]),
  due_at: dateTimeOrNull("Due date"),
  reminder_at: dateTimeOrNull("Reminder"),
});

export const taskToggleSchema = z.object({
  id: z.string().uuid(),
  completed: z.boolean(),
});

export const taskPositionsSchema = z.object({
  log_date: dateKeySchema,
  ordered_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const copyTasksSchema = z.object({
  from_date: dateKeySchema,
  to_date: dateKeySchema,
  include_completed: z.boolean().default(false),
});

export const templateSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Add a template title.").max(200),
  description: textOrNull(2000, "Description"),
  category: taskCategorySchema,
  priority: z.enum(["low", "medium", "high"]),
});

export const applyTemplateSchema = z.object({
  log_date: dateKeySchema,
  template_ids: z.array(z.string().uuid()).min(1, "Choose at least one template."),
});

export const checkinSchema = z.object({
  log_date: dateKeySchema,
  mode: z.enum(["quick", "full"]).default("full"),
  complete: z.boolean(),
  calories: nullableNumber(0, 20000, "Calories"),
  protein_g: nullableNumber(0, 1000, "Protein"),
  carbs_g: nullableNumber(0, 2000, "Carbohydrates"),
  fat_g: nullableNumber(0, 1000, "Fat"),
  fiber_g: nullableNumber(0, 500, "Fiber"),
  water_ml: nullableNumber(0, 30000, "Water"),
  rating: z.preprocess(
    (value) => emptyToNull(value),
    z.coerce.number().int().min(1).max(5).nullable(),
  ),
  win: textOrNull(2000, "Win"),
  mistake: textOrNull(2000, "Mistake"),
  improvement: textOrNull(2000, "Improvement"),
  notes: textOrNull(4000, "Notes"),
  update_nutrition: z.boolean().default(true),
  update_water: z.boolean().default(true),
});

export const habitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Add a habit name.").max(120),
  description: textOrNull(500, "Description"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color."),
  schedule_days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7),
  target_per_week: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(7).nullable()),
  active: z.boolean().default(true),
});

export const habitToggleSchema = z.object({
  habit_id: z.string().uuid(),
  log_date: dateKeySchema,
  completed: z.boolean(),
});

export const studySessionSchema = z.object({
  id: z.string().uuid().optional(),
  log_date: dateKeySchema,
  subject: z.string().trim().min(1, "Add a subject.").max(120),
  topic: textOrNull(500, "Topic"),
  minutes: z.coerce.number().int().min(1, "Add at least one minute.").max(1440, "A day only has 1440 minutes."),
  planned_minutes: nullableNumber(0, 1440, "Planned minutes"),
  distractions: textOrNull(1000, "Distractions"),
  notes: textOrNull(2000, "Notes"),
});

export const focusStartSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  planned_minutes: z.coerce.number().int().min(1).max(240),
  topic: textOrNull(500, "Topic"),
});

export const focusStopSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["save", "discard"]),
});

export const careerGoalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Add a title.").max(200),
  category: textOrNull(80, "Category"),
  status: z.enum(["planned", "in_progress", "completed", "paused"]),
  target_date: z.preprocess(emptyToNull, dateKeySchema.nullable()),
  progress: z.coerce.number().int().min(0).max(100),
  notes: textOrNull(4000, "Notes"),
  resource_url: z
    .preprocess(
      emptyToNull,
      z
        .string()
        .url("Enter a valid URL beginning with https://.")
        .max(1000)
        .refine((v) => v.startsWith("http://") || v.startsWith("https://"), "Use an http(s) link.")
        .nullable(),
    ),
});

export const milestoneSchema = z.object({
  id: z.string().uuid().optional(),
  goal_id: z.string().uuid(),
  title: z.string().trim().min(1, "Add a milestone.").max(200),
  due_date: z.preprocess(emptyToNull, dateKeySchema.nullable()),
});

export const recapGenerateSchema = z.object({
  month: monthKeySchema,
  regenerate: z.boolean().default(false),
});

export const recapAnswersSchema = z.object({
  month: monthKeySchema,
  answers: z.record(z.string().max(40), z.string().max(4000)),
});

export const resetLocalSchema = z.object({
  confirmation: z.literal("RESET LOCAL DATA"),
});
