import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} {...props} />;
}

export function Stat({
  label,
  value,
  suffix,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="metric mt-1 flex items-baseline gap-1 text-2xl font-semibold">
        {value}
        {suffix ? <span className="text-xs font-medium text-muted-foreground">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("hairline my-5", className)} role="separator" />;
}
