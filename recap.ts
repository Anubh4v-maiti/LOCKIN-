"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { recapAnswersSchema, recapGenerateSchema } from "@/lib/validation";
import { generateRecap } from "@/lib/recap-service";
import { monthKey, startOfMonthKey } from "@/lib/date";
import { RECAP_QUESTIONS } from "@/lib/types";

export async function generateRecapAction(input: {
  month: string;
  regenerate: boolean;
}): Promise<ActionResult<{ generated: boolean }>> {
  const parsed = recapGenerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId, profile, today } = await requireUser();
    if (parsed.data.month > monthKey(today)) {
      return { ok: false, error: "You can only recap the current or a past month." };
    }
    const result = await generateRecap({
      supabase,
      userId,
      profile,
      month: parsed.data.month,
      regenerate: parsed.data.regenerate,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/recap");
    revalidatePath("/dashboard");
    return {
      ok: true,
      generated: !result.existed,
      message: result.existed ? "Recap regenerated." : "Recap generated.",
    };
  } catch (error) {
    return fail(error, "The recap could not be generated.");
  }
}

export async function saveRecapAnswers(input: {
  month: string;
  answers: Record<string, string>;
}): Promise<ActionResult> {
  const parsed = recapAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const allowed = new Set(RECAP_QUESTIONS.map((q) => q.key));
    const answers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data.answers)) {
      if (allowed.has(key as (typeof RECAP_QUESTIONS)[number]["key"])) {
        answers[key] = String(value).trim().slice(0, 4000);
      }
    }
    const { data, error } = await supabase
      .from("monthly_recaps")
      .update({ reflection_answers: answers, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("month", startOfMonthKey(parsed.data.month))
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Generate the recap before saving reflection answers." };
    revalidatePath("/recap");
    return { ok: true, message: "Reflection answers saved." };
  } catch (error) {
    return fail(error, "Reflection answers could not be saved.");
  }
}
