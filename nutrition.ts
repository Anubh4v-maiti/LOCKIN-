"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { mealSchema, nutritionSchema } from "@/lib/validation";
import { sumNullable } from "@/lib/metrics";
import { todayInTimeZone } from "@/lib/date";
import type { Meal, NutritionEntry } from "@/lib/types";

const PATHS = ["/nutrition", "/dashboard", "/check-in", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveNutrition(input: {
  log_date: string;
  calories: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  fiber_g: unknown;
  notes: unknown;
  confirmed?: boolean;
}): Promise<ActionResult> {
  const parsed = nutritionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };

  try {
    const { supabase, userId, profile } = await requireUser();
    if (parsed.data.log_date > todayInTimeZone(profile.timezone)) {
      return { ok: false, error: "Nutrition can only be saved for today or a past date." };
    }
    const { data: existing } = await supabase
      .from("nutrition_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", parsed.data.log_date)
      .maybeSingle();

    if (existing) {
      const prior = existing as NutritionEntry;
      const fields = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;
      const changed =
        fields.some((field) => numeric(prior[field]) !== numeric(parsed.data[field])) ||
        (prior.notes ?? "") !== (parsed.data.notes ?? "");
      if (changed && !input.confirmed) {
        return {
          ok: false,
          requiresConfirmation: true,
          error: "A nutrition record already exists for this date. Confirm to replace it.",
        };
      }
    }

    const { error } = await supabase.from("nutrition_entries").upsert(
      {
        user_id: userId,
        log_date: parsed.data.log_date,
        calories: parsed.data.calories,
        protein_g: parsed.data.protein_g,
        carbs_g: parsed.data.carbs_g,
        fat_g: parsed.data.fat_g,
        fiber_g: parsed.data.fiber_g,
        notes: parsed.data.notes,
        source: "manual",
      },
      { onConflict: "user_id,log_date" },
    );
    if (error) throw new Error(error.message);

    revalidateAll();
    return { ok: true, message: "Nutrition saved." };
  } catch (error) {
    return fail(error, "Nutrition could not be saved.");
  }
}

export async function deleteNutrition(logDate: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("nutrition_entries")
      .delete()
      .eq("user_id", userId)
      .eq("log_date", logDate);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Nutrition record deleted." };
  } catch (error) {
    return fail(error, "The nutrition record could not be deleted.");
  }
}

export async function saveMeal(input: {
  id?: string;
  log_date: string;
  meal_type: string;
  name: string;
  quantity: unknown;
  calories: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  fiber_g: unknown;
}): Promise<ActionResult> {
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId, profile } = await requireUser();
    if (parsed.data.log_date > todayInTimeZone(profile.timezone)) {
      return { ok: false, error: "Meals can only be saved for today or a past date." };
    }
    const payload = {
      user_id: userId,
      log_date: parsed.data.log_date,
      meal_type: parsed.data.meal_type,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      calories: parsed.data.calories,
      protein_g: parsed.data.protein_g,
      carbs_g: parsed.data.carbs_g,
      fat_g: parsed.data.fat_g,
      fiber_g: parsed.data.fiber_g,
    };
    const { error } = parsed.data.id
      ? await supabase
          .from("meals")
          .update(payload)
          .eq("id", parsed.data.id)
          .eq("user_id", userId)
      : await supabase.from("meals").insert(payload);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: parsed.data.id ? "Meal updated." : "Meal added." };
  } catch (error) {
    return fail(error, "The meal could not be saved.");
  }
}

export async function deleteMeal(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("meals").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Meal deleted." };
  } catch (error) {
    return fail(error, "The meal could not be deleted.");
  }
}

export async function mealTotals(logDate: string): Promise<ActionResult<{ totals: Record<string, number | null> }>> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", logDate);
    if (error) throw new Error(error.message);
    const meals = (data ?? []) as Meal[];
    return {
      ok: true,
      totals: {
        calories: sumNullable(meals.map((m) => m.calories)),
        protein_g: sumNullable(meals.map((m) => m.protein_g)),
        carbs_g: sumNullable(meals.map((m) => m.carbs_g)),
        fat_g: sumNullable(meals.map((m) => m.fat_g)),
        fiber_g: sumNullable(meals.map((m) => m.fiber_g)),
      },
    };
  } catch (error) {
    return fail(error, "Meal totals could not be calculated.");
  }
}

export async function copyMealTotals(logDate: string): Promise<ActionResult> {
  try {
    const { supabase, userId, profile } = await requireUser();
    if (logDate > todayInTimeZone(profile.timezone)) {
      return { ok: false, error: "Meal totals can only be copied for today or a past date." };
    }
    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", logDate);
    if (error) throw new Error(error.message);
    const meals = (data ?? []) as Meal[];
    if (!meals.length) return { ok: false, error: "No meals are logged for this date." };

    const totals = {
      calories: sumNullable(meals.map((m) => m.calories)),
      protein_g: sumNullable(meals.map((m) => m.protein_g)),
      carbs_g: sumNullable(meals.map((m) => m.carbs_g)),
      fat_g: sumNullable(meals.map((m) => m.fat_g)),
      fiber_g: sumNullable(meals.map((m) => m.fiber_g)),
    };
    const { error: upsertError } = await supabase.from("nutrition_entries").upsert(
      {
        user_id: userId,
        log_date: logDate,
        ...totals,
        source: "meals",
      },
      { onConflict: "user_id,log_date" },
    );
    if (upsertError) throw new Error(upsertError.message);
    revalidateAll();
    return { ok: true, message: "Meal totals copied into the daily total." };
  } catch (error) {
    return fail(error, "Meal totals could not be copied.");
  }
}
