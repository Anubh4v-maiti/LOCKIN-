"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import {
  applyTemplateSchema,
  copyTasksSchema,
  taskPositionsSchema,
  taskSchema,
  taskToggleSchema,
  templateSchema,
} from "@/lib/validation";
import type { DailyTask, TaskTemplate } from "@/lib/types";

const PATHS = ["/tasks", "/dashboard", "/check-in", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export async function saveTask(input: {
  id?: string;
  log_date: string;
  title: string;
  description: unknown;
  category: string;
  priority: string;
  due_at: unknown;
  reminder_at: unknown;
}): Promise<ActionResult<{ id?: string }>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  if (parsed.data.due_at && Number.isNaN(Date.parse(parsed.data.due_at))) {
    return { ok: false, error: "The due date is not valid." };
  }
  if (parsed.data.reminder_at && Number.isNaN(Date.parse(parsed.data.reminder_at))) {
    return { ok: false, error: "The reminder time is not valid." };
  }
  try {
    const { supabase, userId } = await requireUser();
    const payload = {
      user_id: userId,
      log_date: parsed.data.log_date,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      due_at: parsed.data.due_at,
      reminder_at: parsed.data.reminder_at,
    };

    if (parsed.data.id) {
      const { error } = await supabase
        .from("daily_tasks")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      revalidateAll();
      return { ok: true, id: parsed.data.id, message: "Task updated." };
    }

    const { data: last } = await supabase
      .from("daily_tasks")
      .select("position")
      .eq("user_id", userId)
      .eq("log_date", parsed.data.log_date)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = ((last?.position as number | undefined) ?? -1) + 1;

    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({ ...payload, position })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, id: data?.id as string | undefined, message: "Task added." };
  } catch (error) {
    return fail(error, "The task could not be saved.");
  }
}

export async function toggleTask(input: { id: string; completed: boolean }): Promise<ActionResult> {
  const parsed = taskToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("daily_tasks")
      .update({
        completed: parsed.data.completed,
        completed_at: parsed.data.completed ? new Date().toISOString() : null,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return fail(error, "The task could not be updated.");
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("daily_tasks").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Task deleted." };
  } catch (error) {
    return fail(error, "The task could not be deleted.");
  }
}

export async function reorderTasks(input: { log_date: string; ordered_ids: string[] }): Promise<ActionResult> {
  const parsed = taskPositionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("reorder_tasks", {
      p_log_date: parsed.data.log_date,
      p_ids: parsed.data.ordered_ids,
    });
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return fail(error, "The task order could not be saved.");
  }
}

export async function copyTasks(input: {
  from_date: string;
  to_date: string;
  include_completed: boolean;
}): Promise<ActionResult<{ copied: number; skipped: number }>> {
  const parsed = copyTasksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  if (parsed.data.from_date === parsed.data.to_date) {
    return { ok: false, error: "Choose a different source date." };
  }
  try {
    const { supabase, userId } = await requireUser();
    const [sourceResult, targetResult] = await Promise.all([
      supabase
        .from("daily_tasks")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", parsed.data.from_date)
        .order("position"),
      supabase.from("daily_tasks").select("title, position").eq("user_id", userId).eq("log_date", parsed.data.to_date),
    ]);
    if (sourceResult.error) throw new Error(sourceResult.error.message);
    if (targetResult.error) throw new Error(targetResult.error.message);

    const source = ((sourceResult.data ?? []) as DailyTask[]).filter(
      (task) => parsed.data.include_completed || !task.completed,
    );
    if (!source.length) return { ok: true, copied: 0, skipped: 0, message: "Nothing to copy." };

    const existing = new Set(
      ((targetResult.data ?? []) as { title: string }[]).map((t) => t.title.trim().toLowerCase()),
    );
    const nextPosition =
      Math.max(-1, ...((targetResult.data ?? []) as { position: number }[]).map((t) => t.position)) + 1;

    const rows = source
      .filter((task) => !existing.has(task.title.trim().toLowerCase()))
      .map((task, index) => ({
        user_id: userId,
        log_date: parsed.data.to_date,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        position: nextPosition + index,
        completed: false,
      }));

    if (rows.length) {
      const { error } = await supabase.from("daily_tasks").insert(rows);
      if (error) throw new Error(error.message);
    }
    revalidateAll();
    return {
      ok: true,
      copied: rows.length,
      skipped: source.length - rows.length,
      message: `${rows.length} task${rows.length === 1 ? "" : "s"} copied.`,
    };
  } catch (error) {
    return fail(error, "Tasks could not be copied.");
  }
}

export async function saveTemplate(input: {
  id?: string;
  title: string;
  description: unknown;
  category: string;
  priority: string;
}): Promise<ActionResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const payload = {
      user_id: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
    };
    const { error } = parsed.data.id
      ? await supabase
          .from("reusable_task_templates")
          .update(payload)
          .eq("id", parsed.data.id)
          .eq("user_id", userId)
      : await supabase.from("reusable_task_templates").insert(payload);
    if (error) throw new Error(error.message);
    revalidatePath("/tasks");
    return { ok: true, message: "Template saved." };
  } catch (error) {
    return fail(error, "The template could not be saved.");
  }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("reusable_task_templates")
      .update({ archived: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/tasks");
    return { ok: true, message: "Template removed." };
  } catch (error) {
    return fail(error, "The template could not be removed.");
  }
}

export async function applyTemplates(input: {
  log_date: string;
  template_ids: string[];
}): Promise<ActionResult<{ added: number }>> {
  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const [templatesResult, tasksResult] = await Promise.all([
      supabase
        .from("reusable_task_templates")
        .select("*")
        .eq("user_id", userId)
        .in("id", parsed.data.template_ids),
      supabase
        .from("daily_tasks")
        .select("title, position")
        .eq("user_id", userId)
        .eq("log_date", parsed.data.log_date),
    ]);
    if (templatesResult.error) throw new Error(templatesResult.error.message);
    if (tasksResult.error) throw new Error(tasksResult.error.message);
    const templates = (templatesResult.data ?? []) as TaskTemplate[];
    if (!templates.length) return { ok: false, error: "No matching templates." };

    const existing = new Set(
      ((tasksResult.data ?? []) as { title: string }[]).map((t) => t.title.trim().toLowerCase()),
    );
    const nextPosition =
      Math.max(-1, ...((tasksResult.data ?? []) as { position: number }[]).map((t) => t.position)) + 1;
    const rows = templates
      .filter((t) => !existing.has(t.title.trim().toLowerCase()))
      .map((t, index) => ({
        user_id: userId,
        log_date: parsed.data.log_date,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        position: nextPosition + index,
      }));

    if (rows.length) {
      const { error } = await supabase.from("daily_tasks").insert(rows);
      if (error) throw new Error(error.message);
    }
    revalidateAll();
    return {
      ok: true,
      added: rows.length,
      message: `${rows.length} template task${rows.length === 1 ? "" : "s"} added.`,
    };
  } catch (error) {
    return fail(error, "Templates could not be applied.");
  }
}
