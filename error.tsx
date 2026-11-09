"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[lockin] route error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">That page could not load.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your saved data has not been changed. This is usually temporary. Try again, or return
          to the dashboard.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" onClick={reset}>
            <RotateCcw className="size-4" /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
