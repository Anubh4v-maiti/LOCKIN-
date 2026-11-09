export type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; error: string; requiresConfirmation?: boolean };

export function fail(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): { ok: false; error: string; requiresConfirmation?: boolean } {
  if (error instanceof Error && error.message) {
    console.error("[lockin]", error.message);
    if (error.message.toLowerCase().includes("not authenticated")) {
      return { ok: false, error: "Your session expired. Sign in again." };
    }
    if (error.message.toLowerCase().includes("duplicate key")) {
      return { ok: false, error: "That record already exists. Refresh and try again." };
    }
  }
  return { ok: false, error: fallback };
}

export function fieldErrors(error: { issues: { path: (string | number)[]; message: string }[] }) {
  const first = error.issues[0];
  return first?.message ?? "Check the form values and try again.";
}
