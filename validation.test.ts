import { describe, expect, it } from "vitest";
import {
  checkinSchema,
  dateKeySchema,
  resetLocalSchema,
  habitSchema,
  mealSchema,
  monthKeySchema,
  nullableNumber,
  nutritionSchema,
  settingsSchema,
  targetSchema,
  taskSchema,
  waterAddSchema,
} from "@/lib/validation";

describe("date validation", () => {
  it("accepts only real calendar dates and months", () => {
    expect(dateKeySchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateKeySchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateKeySchema.safeParse("2026-10-23T00:00:00Z").success).toBe(false);
    expect(monthKeySchema.safeParse("2026-10").success).toBe(true);
    expect(monthKeySchema.safeParse("2026-13").success).toBe(false);
    expect(monthKeySchema.safeParse("2026-1").success).toBe(false);
  });
});

describe("number and text normalization", () => {
  it("turns blank inputs into null rather than zero", () => {
    const schema = nullableNumber(0, 100, "Value");
    expect(schema.parse("")).toBeNull();
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse(null)).toBeNull();
    expect(schema.parse(undefined)).toBeNull();
    expect(schema.parse("0")).toBe(0);
    expect(schema.parse("12.5")).toBe(12.5);
    expect(schema.safeParse("abc").success).toBe(false);
    expect(schema.safeParse(-1).success).toBe(false);
    expect(schema.safeParse(101).success).toBe(false);
  });
});

describe("action schemas", () => {
  it("validates a quick check-in whose optional fields are blank", () => {
    const parsed = checkinSchema.parse({
      log_date: "2026-10-23",
      mode: "quick",
      complete: true,
      calories: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
      fiber_g: "",
      water_ml: "",
      rating: "",
      win: "",
      mistake: "",
      improvement: "",
      notes: "  ",
      update_nutrition: true,
      update_water: true,
    });
    expect(parsed.calories).toBeNull();
    expect(parsed.rating).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("rejects invalid nutrition only when it is completely empty", () => {
    const base = {
      log_date: "2026-10-23",
      calories: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
      fiber_g: "",
      notes: "",
    };
    expect(nutritionSchema.safeParse(base).success).toBe(false);
    expect(nutritionSchema.safeParse({ ...base, notes: "Ate out" }).success).toBe(true);
    expect(nutritionSchema.safeParse({ ...base, protein_g: "0" }).success).toBe(true);
  });

  it("requires a balanced target row and valid settings enums", () => {
    const parsed = targetSchema.parse({
      effective_from: "2026-10-23",
      calories: "",
      protein_g: "150",
      carbs_g: "",
      fat_g: "",
      fiber_g: "",
      water_ml: "2500",
      study_minutes: "",
    });
    expect(parsed.protein_g).toBe(150);
    expect(parsed.calories).toBeNull();

    const settings = settingsSchema.parse({
      display_name: "Anubhav",
      timezone: "Asia/Kolkata",
      date_format: "MMM d",
      week_start: "1",
      theme: "system",
      modules: { meals: false, study: true, habits: true, career: true, aiInsights: false },
      reminder_enabled: true,
      reminder_time: "20:30",
      ai_consent: false,
    });
    expect(settings.week_start).toBe(1);
    expect(settings.date_format).toBe("MMM d");
    expect(
      settingsSchema.safeParse({
        ...settings,
        date_format: "YYYY/MM/DD",
        reminder_time: "9pm",
      }).success,
    ).toBe(false);
  });

  it("validates task dates and reminder timestamps instead of trusting free text", () => {
    const base = {
      log_date: "2026-10-23",
      title: "Read",
      description: "",
      category: "study",
      priority: "medium",
    };
    expect(taskSchema.safeParse({ ...base, due_at: "2026-10-24", reminder_at: "2026-10-24T19:30" }).success).toBe(true);
    expect(taskSchema.safeParse(base).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, due_at: "tomorrow" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, reminder_at: "2026-02-31" }).success).toBe(false);
  });

  it("limits water and habit input ranges", () => {
    expect(waterAddSchema.safeParse({ log_date: "2026-10-23", amount_ml: "250" }).success).toBe(true);
    expect(waterAddSchema.safeParse({ log_date: "2026-10-23", amount_ml: 0 }).success).toBe(false);
    const habit = {
      name: "Walk",
      description: "",
      color: "#AABBCC",
      schedule_days: ["1", "3"],
      target_per_week: "",
      active: true,
    };
    expect(habitSchema.safeParse(habit).success).toBe(true);
    expect(habitSchema.safeParse({ ...habit, schedule_days: [] }).success).toBe(false);
    expect(habitSchema.safeParse({ ...habit, color: "green" }).success).toBe(false);
  });

  it("requires an exact local-reset confirmation", () => {
    expect(resetLocalSchema.safeParse({ confirmation: "RESET LOCAL DATA" }).success).toBe(true);
    expect(resetLocalSchema.safeParse({ confirmation: "reset local data" }).success).toBe(false);
  });

  it("accepts meal rows with missing macros but a food name", () => {
    const meal = {
      log_date: "2026-10-23",
      meal_type: "lunch",
      name: "Dal and rice",
      quantity: "",
      calories: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
      fiber_g: "",
    };
    expect(mealSchema.safeParse(meal).success).toBe(true);
    expect(mealSchema.safeParse({ ...meal, name: " " }).success).toBe(false);
  });
});
