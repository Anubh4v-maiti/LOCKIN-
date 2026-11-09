"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { waterAddSchema, waterSetSchema } from "@/lib/validation";
import { todayInTimeZone } from "@/lib/date";
import { isValidDateKey } from "@/lib/date";

const PATHS = ["/water", "/dashboard", "/check-in", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

function notFuture(date: string, timezone: string): boolean {
  return isValidDateKey(date) && date <= todayInTimeZone(timezone);
}

export async function addWater(input: { log_date: string; amount_ml: unknown }): Promise<ActionResult<{ total: number }>> {
  const parsed = waterAddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, profile } = await requireUser();
    if (!notFuture(parsed.data.log_date, profile.timezone)) {
      return { ok: false, error: "Water can only be logged for today or a past date." };
    }
    const { data, error } = await supabase.rpc("add_water", {
      p_log_date: parsed.data.log_date,
      p_amount_ml: parsed.data.amount_ml,
    });
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, total: Number(data), message: `Added ${parsed.data.amount_ml} ml.` };
  } catch (error) {
    return fail(error, "Water could not be added.");
  }
}

export async function setWater(input: { log_date: string; total_ml: unknown }): Promise<ActionResult<{ total: number }>> {
  const parsed = waterSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, profile } = await requireUser();
    if (!notFuture(parsed.data.log_date, profile.timezone)) {
      return { ok: false, error: "Water can only be logged for today or a past date." };
    }
    const { data, error } = await supabase.rpc("set_water", {
      p_log_date: parsed.data.log_date,
      p_total_ml: parsed.data.total_ml,
    });
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, total: Number(data), message: "Water total updated." };
  } catch (error) {
    return fail(error, "The water total could not be updated.");
  }
}

export async function undoWater(logDate: string): Promise<ActionResult<{ total: number }>> {
  if (!isValidDateKey(logDate)) return { ok: false, error: "Invalid date." };
  try {
    const { supabase, profile } = await requireUser();
    if (!notFuture(logDate, profile.timezone)) {
      return { ok: false, error: "Water can only be undone for today or a past date." };
    }
    const { data, error } = await supabase.rpc("undo_water", { p_log_date: logDate });
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, total: Number(data), message: "Last water entry undone." };
  } catch (error) {
    return fail(error, "The last water entry could not be undone.");
  }
}
