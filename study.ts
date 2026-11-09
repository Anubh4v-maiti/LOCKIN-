"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fail, fieldErrors, type ActionResult } from "@/lib/actions";
import { focusStartSchema, focusStopSchema, studySessionSchema } from "@/lib/validation";
import { todayInTimeZone } from "@/lib/date";
import type { FocusSession } from "@/lib/types";

const PATHS = ["/study", "/dashboard", "/calendar", "/analytics", "/recap"];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

export async function saveStudySession(input: {
  id?: string;
  log_date: string;
  subject: string;
  topic: unknown;
  minutes: unknown;
  planned_minutes: unknown;
  distractions: unknown;
  notes: unknown;
}): Promise<ActionResult> {
  const parsed = studySessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId, profile } = await requireUser();
    if (parsed.data.log_date > todayInTimeZone(profile.timezone)) {
      return { ok: false, error: "Study can only be saved for today or a past date." };
    }
    const payload = {
      user_id: userId,
      log_date: parsed.data.log_date,
      subject: parsed.data.subject,
      topic: parsed.data.topic,
      minutes: parsed.data.minutes,
      planned_minutes: parsed.data.planned_minutes,
      distractions: parsed.data.distractions,
      notes: parsed.data.notes,
    };
    const { error } = parsed.data.id
      ? await supabase
          .from("study_sessions")
          .update(payload)
          .eq("id", parsed.data.id)
          .eq("user_id", userId)
      : await supabase.from("study_sessions").insert(payload);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: parsed.data.id ? "Study session updated." : "Study session saved." };
  } catch (error) {
    return fail(error, "The study session could not be saved.");
  }
}

export async function deleteStudySession(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase.from("study_sessions").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Study session deleted." };
  } catch (error) {
    return fail(error, "The study session could not be deleted.");
  }
}

export async function startFocus(input: {
  subject: string;
  planned_minutes: unknown;
  topic: unknown;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = focusStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId, profile } = await requireUser();
    const { data: existing } = await supabase
      .from("focus_sessions")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["running", "paused"])
      .maybeSingle();
    if (existing) return { ok: false, error: "A focus session is already active. Finish it first." };

    const { data, error } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userId,
        log_date: todayInTimeZone(profile.timezone),
        subject: parsed.data.subject,
        topic: parsed.data.topic,
        planned_minutes: parsed.data.planned_minutes,
        started_at: new Date().toISOString(),
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, id: data.id as string, message: "Focus session started." };
  } catch (error) {
    return fail(error, "The focus session could not be started.");
  }
}

function elapsedSeconds(session: FocusSession): number {
  const accumulated = session.accumulated_seconds ?? 0;
  if (session.status === "running") {
    return accumulated + Math.max(0, Math.floor((Date.now() - Date.parse(session.started_at)) / 1000));
  }
  return accumulated;
}

export async function pauseFocus(id: string): Promise<ActionResult<{ elapsedSeconds: number }>> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const session = data as FocusSession | null;
    if (!session) return { ok: false, error: "Focus session not found." };
    if (session.status !== "running") return { ok: false, error: "This session is not running." };

    const elapsed = elapsedSeconds(session);
    const { error: updateError } = await supabase
      .from("focus_sessions")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
        accumulated_seconds: elapsed,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);
    revalidateAll();
    return { ok: true, elapsedSeconds: elapsed, message: "Session paused." };
  } catch (error) {
    return fail(error, "The session could not be paused.");
  }
}

export async function resumeFocus(id: string): Promise<ActionResult> {
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("focus_sessions")
      .update({ status: "running", started_at: new Date().toISOString(), paused_at: null })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "paused");
    if (error) throw new Error(error.message);
    revalidateAll();
    return { ok: true, message: "Session resumed." };
  } catch (error) {
    return fail(error, "The session could not be resumed.");
  }
}

export async function stopFocus(input: { id: string; action: "save" | "discard" }): Promise<ActionResult<{ minutes?: number }>> {
  const parsed = focusStopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error) };
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("id", parsed.data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const session = data as FocusSession | null;
    if (!session) return { ok: false, error: "Focus session not found." };
    if (!["running", "paused"].includes(session.status)) {
      return { ok: false, error: "This session has already ended." };
    }

    const seconds = elapsedSeconds(session);
    const minutes = Math.max(1, Math.round(seconds / 60));

    if (parsed.data.action === "save" && seconds < 60) {
      return {
        ok: false,
        error: "Sessions under one minute are not saved. Pause or discard instead.",
      };
    }

    if (parsed.data.action === "save") {
      const { error: insertError } = await supabase.from("study_sessions").insert({
        user_id: userId,
        log_date: session.log_date,
        subject: session.subject,
        topic: session.topic,
        minutes,
        planned_minutes: session.planned_minutes,
        source: "timer",
        started_at: session.started_at,
        ended_at: new Date().toISOString(),
      });
      if (insertError) throw new Error(insertError.message);
    }

    const { error: updateError } = await supabase
      .from("focus_sessions")
      .update({
        status: parsed.data.action === "save" ? "finished" : "abandoned",
        ended_at: new Date().toISOString(),
        accumulated_seconds: seconds,
        paused_at: null,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);

    revalidateAll();
    return {
      ok: true,
      minutes: parsed.data.action === "save" ? minutes : undefined,
      message: parsed.data.action === "save" ? `Saved ${minutes} focused minutes.` : "Session discarded.",
    };
  } catch (error) {
    return fail(error, "The focus session could not be finished.");
  }
}
