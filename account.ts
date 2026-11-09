"use server";

import { redirect } from "next/navigation";
import { fail, type ActionResult } from "@/lib/actions";
import { resetLocalData } from "@/lib/local/db";
import { resetLocalSchema } from "@/lib/validation";

export async function resetWorkspace(input: { confirmation: string }): Promise<ActionResult> {
  const parsed = resetLocalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Type "RESET LOCAL DATA" exactly to confirm.' };
  }
  try {
    await resetLocalData();
  } catch {
    return fail(
      new Error("reset failed"),
      "The local workspace could not be reset. Close other LOCKIN windows and try again.",
    );
  }
  redirect("/dashboard?reset=1");
}
