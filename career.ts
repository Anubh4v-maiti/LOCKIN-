"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { careerGoalSchema, milestoneSchema } from "@/lib/validation";

const PATHS = ["/career", "/dashboard", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export async function saveCareerGoal(input: {
  id?: string;
  title: string;
  category: unknown;
  status: string;
  target_date: unknown;
  progress: unknown;
  notes: unknown;
  resource_url: unknown;
}): Promise<ActionResult> {
  const parsed = careerGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const completed = parsed.data.status === "completed";
    const payload = {
      user_id: userId,
      title: parsed.data.title,
      category: parsed.data.category,
      status: parsed.data.status,
      target_date: parsed.data.target_date,
      progress: completed ? 100 : parsed.data.progress,
      notes: parsed.data.notes,
      resource_url: parsed.data.resource_url,
      completed_at: completed ? new Date().toISOString() : null,
    };
    const { error } = parsed.data.id
      ? await supabase
          .from("career_goals")
          .update(payload)
          .eq("id", parsed.data.id)
          .eq("user_id", userId)
      : await supabase.from("career_goals").insert(payload);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: parsed.data.id ? "Goal updated." : "Goal created." };
  } catch (error) {
    return fail(error, "The goal could not be saved.");
  }
}

export async function deleteCareerGoal(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("career_goals").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Goal and its milestones deleted." };
  } catch (error) {
    return fail(error, "The goal could not be deleted.");
  }
}

export async function saveMilestone(input: {
  id?: string;
  goal_id: string;
  title: string;
  due_date: unknown;
}): Promise<ActionResult> {
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const payload = {
      user_id: userId,
      goal_id: parsed.data.goal_id,
      title: parsed.data.title,
      due_date: parsed.data.due_date,
    };
    if (!parsed.data.id) {
      const { data: last } = await supabase
        .from("career_milestones")
        .select("position")
        .eq("user_id", userId)
        .eq("goal_id", parsed.data.goal_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const position = ((last?.position as number | undefined) ?? -1) + 1;
      const { error } = await supabase.from("career_milestones").insert({ ...payload, position });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("career_milestones")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    revalidateAll();
    return { ok: true, message: "Milestone saved." };
  } catch (error) {
    return fail(error, "The milestone could not be saved.");
  }
}

export async function toggleMilestone(input: { id: string; completed: boolean }): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("career_milestones")
      .update({
        completed: input.completed,
        completed_at: input.completed ? new Date().toISOString() : null,
      })
      .eq("id", input.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return fail(error, "The milestone could not be updated.");
  }
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("career_milestones").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Milestone deleted." };
  } catch (error) {
    return fail(error, "The milestone could not be deleted.");
  }
}
