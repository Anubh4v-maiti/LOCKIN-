"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { checkinSchema } from "@/lib/validation";
import { todayInTimeZone } from "@/lib/date";
import { checkinStreaks } from "@/lib/metrics";
import { fetchCompletedDates } from "@/lib/queries";

const PATHS = ["/check-in", "/dashboard", "/nutrition", "/water", "/tasks", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export async function saveCheckin(input: {
  log_date: string;
  mode: "quick" | "full";
  complete: boolean;
  calories: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  fiber_g: unknown;
  water_ml: unknown;
  rating: unknown;
  win: unknown;
  mistake: unknown;
  improvement: unknown;
  notes: unknown;
  update_nutrition: boolean;
  update_water: boolean;
}): Promise<ActionResult<{ streak?: number; completed?: boolean }>> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };

  try {
    const { supabase, userId, profile } = await requireUser();
    const today = todayInTimeZone(profile.timezone);
    if (parsed.data.log_date > today) {
      return { ok: false, error: "You cannot complete a check-in for a future date." };
    }

    const hasAny =
      parsed.data.calories !== null ||
      parsed.data.protein_g !== null ||
      parsed.data.carbs_g !== null ||
      parsed.data.fat_g !== null ||
      parsed.data.fiber_g !== null ||
      parsed.data.water_ml !== null ||
      parsed.data.rating !== null ||
      Boolean(parsed.data.win?.trim()) ||
      Boolean(parsed.data.mistake?.trim()) ||
      Boolean(parsed.data.improvement?.trim()) ||
      Boolean(parsed.data.notes?.trim());

    if (parsed.data.complete && !hasAny) {
      return {
        ok: false,
        error: "Add at least one real value or reflection before completing the check-in.",
      };
    }

    const { error } = await supabase.rpc("save_checkin", {
      p_log_date: parsed.data.log_date,
      p_complete: parsed.data.complete,
      // The client preserves any hidden reflection fields in quick mode, so
      // writing the reflection is safe and prevents quick-mode ratings/notes
      // from being silently discarded.
      p_use_reflection: true,
      p_rating: parsed.data.rating,
      p_win: parsed.data.win,
      p_mistake: parsed.data.mistake,
      p_improvement: parsed.data.improvement,
      p_notes: parsed.data.notes,
      p_update_nutrition: parsed.data.update_nutrition,
      p_calories: parsed.data.calories,
      p_protein: parsed.data.protein_g,
      p_carbs: parsed.data.carbs_g,
      p_fat: parsed.data.fat_g,
      p_fiber: parsed.data.fiber_g,
      p_update_water: parsed.data.update_water,
      p_water_ml: parsed.data.water_ml,
    });
    if (error) throw new Error(error.message);

    revalidateAll();

    if (parsed.data.complete) {
      const dates = await fetchCompletedDates(supabase, userId, today);
      const streaks = checkinStreaks(dates, today);
      return {
        ok: true,
        completed: true,
        streak: streaks.current,
        message: streaks.current > 1 ? `Check-in saved. ${streaks.current}-day streak.` : "Check-in saved.",
      };
    }

    return { ok: true, completed: false, message: "Draft saved. You can finish it later." };
  } catch (error) {
    return fail(error, "The check-in could not be saved.");
  }
}
