"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { settingsSchema, targetSchema } from "@/lib/validation";
import { isValidTimeZone } from "@/lib/date";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function saveSettings(input: {
  display_name: string;
  timezone: string;
  date_format: string;
  week_start: number;
  theme: string;
  modules: Record<string, boolean>;
  reminder_enabled: boolean;
  reminder_time: unknown;
  ai_consent: boolean;
}): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  if (!isValidTimeZone(parsed.data.timezone)) {
    return { ok: false, error: "Choose a valid IANA timezone." };
  }
  if (parsed.data.reminder_enabled && !parsed.data.reminder_time) {
    return { ok: false, error: "Set a reminder time or turn the reminder off." };
  }
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        timezone: parsed.data.timezone,
        date_format: parsed.data.date_format,
        week_start: parsed.data.week_start,
        theme: parsed.data.theme,
        modules: parsed.data.modules,
        reminder_enabled: parsed.data.reminder_enabled,
        reminder_time: parsed.data.reminder_enabled ? parsed.data.reminder_time : null,
        ai_consent: parsed.data.ai_consent,
        onboarded: true,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return fail(error, "Settings could not be saved.");
  }
}

export async function saveTargets(input: {
  effective_from: string;
  calories: unknown;
  protein_g: unknown;
  carbs_g: unknown;
  fat_g: unknown;
  fiber_g: unknown;
  water_ml: unknown;
  study_minutes: unknown;
}): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("target_history").upsert(
      {
        user_id: userId,
        effective_from: parsed.data.effective_from,
        calories: parsed.data.calories,
        protein_g: parsed.data.protein_g,
        carbs_g: parsed.data.carbs_g,
        fat_g: parsed.data.fat_g,
        fiber_g: parsed.data.fiber_g,
        water_ml: parsed.data.water_ml,
        study_minutes: parsed.data.study_minutes,
      },
      { onConflict: "user_id,effective_from" },
    );
    if (error) throw new Error(error.message);

    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    revalidateAll();
    return { ok: true, message: "Targets saved as a new version." };
  } catch (error) {
    return fail(error, "Targets could not be saved.");
  }
}

export async function markOnboarded(): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return fail(error, "Could not update your profile.");
  }
}
