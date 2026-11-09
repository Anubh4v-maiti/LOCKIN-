"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDate, relativeDateLabel } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DateNavigator({
  date,
  today,
  basePath,
  allowFuture = false,
  className,
}: {
  date: string;
  today: string;
  basePath: string;
  allowFuture?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const go = (next: string) => {
    if (!allowFuture && next > today) return;
    router.push(`${basePath}?date=${next}`);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => go(addDays(date, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/60 px-3 py-1.5">
        <CalendarDays className="size-3.5 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {relativeDateLabel(date, today)}
          </p>
          <input
            type="date"
            value={date}
            max={allowFuture ? undefined : today}
            onChange={(event) => {
              if (event.target.value) go(event.target.value);
            }}
            className="w-[122px] border-0 bg-transparent p-0 text-xs font-semibold tabular-nums text-foreground focus:outline-none [color-scheme:dark]"
            aria-label="Choose a date"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => go(addDays(date, 1))}
        disabled={!allowFuture && date >= today}
        aria-label="Next day"
      >
        <ChevronRight className="size-4" />
      </Button>
      {date !== today ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => go(today)}>
          Today
        </Button>
      ) : null}
    </div>
  );
}
