"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleTask } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";
import type { DailyTask } from "@/lib/types";

export function TaskCheckButton({
  task,
  onToggled,
  size = "default",
}: {
  task: DailyTask;
  onToggled?: (completed: boolean) => void;
  size?: "default" | "sm";
}) {
  const [completed, setCompleted] = React.useState(task.completed);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setCompleted(task.completed);
  }, [task.completed]);

  const toggle = async () => {
    if (pending) return;
    const next = !completed;
    setCompleted(next);
    setPending(true);
    try {
      const result = await toggleTask({ id: task.id, completed: next });
      if (!result.ok) {
        setCompleted(!next);
        toast.error(result.error);
      } else {
        onToggled?.(next);
        router.refresh();
      }
    } catch {
      setCompleted(!next);
      toast.error("Could not save the task. Check your connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="checkbox"
      aria-checked={completed}
      aria-label={completed ? `Mark "${task.title}" incomplete` : `Mark "${task.title}" complete`}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-md border transition-all",
        size === "sm" ? "size-4.5" : "size-5",
        completed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-surface hover:border-primary/50",
        pending && "opacity-70",
      )}
      style={{ width: size === "sm" ? 18 : 20, height: size === "sm" ? 18 : 20 }}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : completed ? (
        <Check className="size-3.5 animate-check-burst" />
      ) : null}
    </button>
  );
}

export function TaskQuickRow({ task }: { task: DailyTask }) {
  const [completed, setCompleted] = React.useState(task.completed);
  React.useEffect(() => setCompleted(task.completed), [task.completed]);
  return (
    <div className="flex items-start gap-3 py-2">
      <TaskCheckButton task={task} onToggled={setCompleted} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm transition-colors",
            completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="text-[10px] capitalize text-muted-foreground">
          {task.category} · {task.priority} priority
        </p>
      </div>
    </div>
  );
}
