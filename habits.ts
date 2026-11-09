"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { habitSchema, habitToggleSchema } from "@/lib/validation";
import { todayInTimeZone } from "@/lib/date";

const PATHS = ["/habits", "/dashboard", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export async function saveHabit(input: {
  id?: string;
  name: string;
  description: unknown;
  color: string;
  schedule_days: number[];
  target_per_week: unknown;
  active: boolean;
}): Promise<ActionResult> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const schedule = Array.from(new Set(parsed.data.schedule_days)).sort((a, b) => a - b);
    const payload = {
      user_id: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color,
      schedule_days: schedule,
      target_per_week: parsed.data.target_per_week,
      active: parsed.data.active,
    };
    const { error } = parsed.data.id
      ? await supabase.from("habits").update(payload).eq("id", parsed.data.id).eq("user_id", userId)
      : await supabase.from("habits").insert(payload);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: parsed.data.id ? "Habit updated." : "Habit created." };
  } catch (error) {
    return fail(error, "The habit could not be saved.");
  }
}

export async function archiveHabit(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("habits")
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Habit archived. Its history is preserved." };
  } catch (error) {
    return fail(error, "The habit could not be archived.");
  }
}

export async function toggleHabit(input: {
  habit_id: string;
  log_date: string;
  completed: boolean;
}): Promise<ActionResult> {
  const parsed = habitToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId, profile } = await requireUser();
    if (parsed.data.log_date > todayInTimeZone(profile.timezone)) {
      return { ok: false, error: "A habit cannot be completed for a future date." };
    }
    if (parsed.data.completed) {
      const { error } = await supabase.from("habit_completions").upsert(
        {
          user_id: userId,
          habit_id: parsed.data.habit_id,
          log_date: parsed.data.log_date,
          completed: true,
        },
        { onConflict: "habit_id,log_date" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", parsed.data.habit_id)
        .eq("user_id", userId)
        .eq("log_date", parsed.data.log_date);
      if (error) throw new Error(error.message);
    }
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return fail(error, "The habit completion could not be saved.");
  }
}
