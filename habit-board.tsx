"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Repeat2,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { archiveHabit, saveHabit, toggleHabit } from "@/app/actions/habits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  habitDayState,
  habitWeekSummary,
  weekCheckinCounts,
} from "@/lib/metrics";
import { addDays, formatDate, formatWeekday } from "@/lib/date";
import type { DateKey } from "@/lib/date";
import type { Habit, HabitCompletion } from "@/lib/types";
import { cn, pct } from "@/lib/utils";

const COLORS = ["#C5F467", "#7EE7C1", "#82B7FF", "#B6A5FF", "#F5CE73", "#FF9E9E", "#FFB48A"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type HabitForm = {
  name: string;
  description: string;
  color: string;
  schedule_days: number[];
  target_per_week: string;
  active: boolean;
};

const EMPTY_HABIT: HabitForm = {
  name: "",
  description: "",
  color: COLORS[0],
  schedule_days: [1, 2, 3, 4, 5],
  target_per_week: "5",
  active: true,
};

export function HabitBoard({
  habits,
  completions: initialCompletions,
  selectedDate,
  today,
  weekStart,
  weekEnd,
  todayRecorded,
  recordedDates,
}: {
  habits: Habit[];
  completions: HabitCompletion[];
  selectedDate: DateKey;
  today: DateKey;
  weekStart: DateKey;
  weekEnd: DateKey;
  todayRecorded: boolean;
  recordedDates: DateKey[];
}) {
  const router = useRouter();
  const [completions, setCompletions] = React.useState(initialCompletions);
  const [pending, setPending] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Habit | null>(null);
  const [form, setForm] = React.useState<HabitForm>(EMPTY_HABIT);
  const [savePending, setSavePending] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Habit | null>(null);
  const [archivePending, setArchivePending] = React.useState(false);

  React.useEffect(() => setCompletions(initialCompletions), [initialCompletions]);

  const week = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const recorded = React.useMemo(() => new Set(recordedDates), [recordedDates]);

  const completionMap = React.useMemo(() => {
    const map = new Map<string, HabitCompletion>();
    for (const completion of completions) {
      map.set(`${completion.habit_id}:${completion.log_date}`, completion);
    }
    return map;
  }, [completions]);

  const summaries = habits.map((habit) =>
    habitWeekSummary({
      habit,
      week,
      today,
      completions: completions.filter((completion) => completion.habit_id === habit.id),
      hasRecordByDate: recorded,
    }),
  );
  const scheduled = summaries.reduce((sum, summary) => sum + summary.scheduled, 0);
  const completed = summaries.reduce((sum, summary) => sum + summary.completed, 0);
  const missed = summaries.reduce((sum, summary) => sum + summary.missed, 0);
  const noRecord = summaries.reduce((sum, summary) => sum + summary.noRecord, 0);
  const recordedScheduled = completed + missed;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_HABIT);
    setDialogOpen(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setForm({
      name: habit.name,
      description: habit.description ?? "",
      color: habit.color,
      schedule_days: habit.schedule_days,
      target_per_week: habit.target_per_week === null ? "" : String(habit.target_per_week),
      active: habit.active,
    });
    setDialogOpen(true);
  };

  const submitHabit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || savePending) return;
    if (!form.schedule_days.length) {
      toast.error("Choose at least one scheduled day.");
      return;
    }
    setSavePending(true);
    try {
      const result = await saveHabit({
        id: editing?.id,
        name: form.name,
        description: form.description,
        color: form.color,
        schedule_days: form.schedule_days,
        target_per_week: form.target_per_week || null,
        active: form.active,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(editing ? "Habit updated." : "Habit created.");
        setDialogOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("The habit could not be saved.");
    } finally {
      setSavePending(false);
    }
  };

  const toggle = async (habit: Habit, date: DateKey, currentlyComplete: boolean) => {
    const key = `${habit.id}:${date}`;
    if (pending) return;
    setPending(key);
    try {
      const result = await toggleHabit({
        habit_id: habit.id,
        log_date: date,
        completed: !currentlyComplete,
      });
      if (!result.ok) toast.error(result.error);
      else {
        setCompletions((current) => {
          const without = current.filter(
            (completion) => !(completion.habit_id === habit.id && completion.log_date === date),
          );
          if (currentlyComplete) return without;
          return [
            ...without,
            {
              id: `optimistic-${key}`,
              user_id: habit.user_id,
              habit_id: habit.id,
              log_date: date,
              completed: true,
              note: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        });
        router.refresh();
      }
    } catch {
      toast.error("The habit could not be updated.");
    } finally {
      setPending(null);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget || archivePending) return;
    setArchivePending(true);
    try {
      const result = await archiveHabit(archiveTarget.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Habit archived. Past records remain.");
        setArchiveTarget(null);
        router.refresh();
      }
    } catch {
      toast.error("The habit could not be archived.");
    } finally {
      setArchivePending(false);
    }
  };

  const toggleDay = (day: number) => {
    setForm((current) => ({
      ...current,
      schedule_days: current.schedule_days.includes(day)
        ? current.schedule_days.filter((value) => value !== day)
        : [...current.schedule_days, day].sort(),
    }));
  };

  const selectedHabits = habits.filter((habit) =>
    habit.schedule_days.includes(new Date(`${selectedDate}T00:00:00Z`).getUTCDay()),
  );

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active habits</p>
            <p className="metric mt-1 text-2xl font-semibold">{habits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Scheduled this week</p>
            <p className="metric mt-1 text-2xl font-semibold">{scheduled}</p>
            <p className="text-[10px] text-muted-foreground">Past and today only</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
            <p className="metric mt-1 text-2xl font-semibold">{completed}</p>
            <p className="text-[10px] text-muted-foreground">
              {recordedScheduled ? `${pct((completed / recordedScheduled) * 100)} of recorded slots` : "No recorded slots"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">No record</p>
            <p className="metric mt-1 text-2xl font-semibold">{noRecord}</p>
            <p className="text-[10px] text-muted-foreground">Excluded from the rate</p>
          </CardContent>
        </Card>
      </section>

      {habits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="empty-illustration">
              <Repeat2 className="size-5" />
            </div>
            <p className="mt-4 font-display text-sm font-semibold">No active habits yet.</p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Start with one routine you want to repeat. Choose only the days it should happen.
              Unscheduled days are rest days, not misses.
            </p>
            <Button type="button" className="mt-4" onClick={openCreate}>
              <Plus className="size-4" /> Create a habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Weekly rhythm</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(weekStart, "MMM d")} – {formatDate(weekEnd, "MMM d")} · no-record cells are not failures
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="outline" size="icon-sm">
                    <a href={`/habits?date=${addDays(weekStart, -7)}`} aria-label="Previous week">
                      <ChevronLeft className="size-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="icon-sm">
                    <a href={`/habits?date=${addDays(weekStart, 7)}`} aria-label="Next week">
                      <ChevronRight className="size-4" />
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/habits?date=${today}`}>This week</a>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_repeat(7,minmax(32px,1fr))_54px] gap-1.5 px-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground">
                <span className="text-left">Habit</span>
                {week.map((date) => (
                  <span key={date} className={cn(date === today && "text-primary")}>
                    {formatWeekday(date, "short").slice(0, 2)}
                    <span className="block text-[10px] font-semibold normal-case tracking-normal text-foreground">
                      {Number(date.slice(8))}
                    </span>
                  </span>
                ))}
                <span>Week</span>
              </div>
              <div className="space-y-2">
                {habits.map((habit, index) => {
                  const summary = summaries[index];
                  return (
                    <div
                      key={habit.id}
                      className="grid grid-cols-[1fr_repeat(7,minmax(32px,1fr))_54px] items-center gap-1.5 rounded-xl border border-border/60 bg-surface-2/25 px-1.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: habit.color }} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{habit.name}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {habit.schedule_days.length} days/week
                          </p>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center">
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(habit)}
                            aria-label={`Edit ${habit.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            onClick={() => setArchiveTarget(habit)}
                            aria-label={`Archive ${habit.name}`}
                          >
                            <Archive className="size-3" />
                          </button>
                        </div>
                      </div>
                      {week.map((date) => {
                        const completion = completionMap.get(`${habit.id}:${date}`) ?? null;
                        const state = habitDayState({
                          habit,
                          date,
                          today,
                          completion,
                          hasAnyRecord: recorded.has(date),
                        });
                        const isComplete = state === "completed";
                        const scheduledDay = habit.schedule_days.includes(
                          new Date(`${date}T00:00:00Z`).getUTCDay(),
                        );
                        const future = date > today;
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={future || !scheduledDay || pending !== null}
                            onClick={() => void toggle(habit, date, isComplete)}
                            aria-label={`${habit.name} on ${formatDate(date, "MMM d")}: ${state}`}
                            title={
                              future
                                ? "Future day"
                                : !scheduledDay
                                  ? "Not scheduled"
                                  : state === "missed"
                                    ? "Missed (daily record exists)"
                                    : state === "no-record"
                                      ? "No daily record for this date"
                                      : isComplete
                                        ? "Completed"
                                        : "Not completed yet"
                            }
                            className={cn(
                              "mx-auto flex size-7 items-center justify-center rounded-md border text-[10px] transition-colors",
                              isComplete && "border-primary/40 bg-primary text-primary-foreground",
                              !isComplete && scheduledDay && !future && "border-border bg-surface/70 hover:border-primary/50",
                              !scheduledDay && "border-dashed border-border/40 bg-transparent text-muted-foreground/30",
                              future && "border-dashed border-border/30 text-muted-foreground/25",
                              pending === `${habit.id}:${date}` && "opacity-60",
                            )}
                          >
                            {pending === `${habit.id}:${date}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : isComplete ? (
                              <Check className="size-3.5" />
                            ) : state === "missed" ? (
                              <X className="size-3 text-muted-foreground/60" />
                            ) : state === "no-record" ? (
                              <span className="size-1 rounded-full bg-muted-foreground/30" />
                            ) : null}
                          </button>
                        );
                      })}
                      <div className="text-center">
                        <p className="text-[10px] font-semibold">
                          {summary.completed}/{summary.scheduled}
                        </p>
                        <p className="text-[8px] text-muted-foreground">{pct(summary.percent)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary" /> Complete</span>
                <span className="inline-flex items-center gap-1"><X className="size-2.5" /> Missed (record exists)</span>
                <span className="inline-flex items-center gap-1"><span className="size-1 rounded-full bg-muted-foreground/40" /> No record</span>
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm border border-dashed border-border" /> Rest day</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={openCreate} className="w-fit">
                <Plus className="size-3.5" /> Add habit
              </Button>
            </CardHeader>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{formatDate(selectedDate, "MMM d")} checklist</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedHabits.length
                    ? `${selectedHabits.filter((habit) => completionMap.get(`${habit.id}:${selectedDate}`)?.completed).length} of ${selectedHabits.length} scheduled complete`
                    : "No habits scheduled for this date."}
                </p>
              </CardHeader>
              <CardContent>
                {selectedHabits.length === 0 ? (
                  <p className="py-3 text-xs leading-relaxed text-muted-foreground">
                    A rest day is allowed. Unscheduled is not missed.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedHabits.map((habit) => {
                      const complete = Boolean(completionMap.get(`${habit.id}:${selectedDate}`)?.completed);
                      return (
                        <li key={habit.id}>
                          <button
                            type="button"
                            disabled={pending !== null || selectedDate > today}
                            onClick={() => void toggle(habit, selectedDate, complete)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                              complete
                                ? "border-primary/25 bg-primary/[0.07]"
                                : "border-border/60 bg-surface-2/30 hover:border-primary/30",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-md border",
                                complete ? "border-primary bg-primary text-primary-foreground" : "border-input",
                              )}
                            >
                              {complete ? <Check className="size-3" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-xs font-medium", complete && "text-muted-foreground")}>
                                {habit.name}
                              </span>
                              {habit.description ? (
                                <span className="block truncate text-[10px] text-muted-foreground">{habit.description}</span>
                              ) : null}
                            </span>
                            <span className="size-1.5 rounded-full" style={{ background: habit.color }} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> This week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                  <strong className="text-foreground">{completed}</strong> completed ·{" "}
                  <strong className="text-foreground">{missed}</strong> missed ·{" "}
                  <strong className="text-foreground">{noRecord}</strong> no record.
                </p>
                <p>
                  Completion rate uses completed divided by scheduled slots that have a daily record.
                  Days with no record are excluded rather than counted as failures.
                </p>
                <p className="rounded-lg border border-border/60 bg-surface-2/30 px-2.5 py-2">
                  {todayRecorded
                    ? "A daily record exists for today, so today's unchecked habits can be assessed honestly at week's end."
                    : "No daily record exists for today yet. Unchecked habits today remain unassessed."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit habit" : "Create a habit"}</DialogTitle>
            <DialogDescription>
              Keep it specific and scheduled. Only scheduled days count toward consistency.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitHabit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="habit-name">Habit name</Label>
              <Input
                id="habit-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Read 10 pages"
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="habit-description">Description (optional)</Label>
              <Textarea
                id="habit-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-[68px]"
                maxLength={500}
                placeholder="Why it matters or what counts."
              />
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color }))}
                    aria-label={`Choose colour ${color}`}
                    aria-pressed={form.color === color}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform",
                      form.color === color ? "scale-110 border-foreground" : "border-transparent",
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days scheduled</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(index)}
                    aria-pressed={form.schedule_days.includes(index)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      form.schedule_days.includes(index)
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/70 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="habit-target">Target per week</Label>
                <Select
                  id="habit-target"
                  value={form.target_per_week}
                  onChange={(event) => setForm((current) => ({ ...current, target_per_week: event.target.value }))}
                  options={[
                    { value: "", label: "No weekly target" },
                    ...Array.from({ length: 7 }, (_, index) => ({
                      value: String(index + 1),
                      label: `${index + 1} ${index === 0 ? "day" : "days"}`,
                    })),
                  ]}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-3 text-sm">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
                  />
                  Active habit
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={savePending}>
                Cancel
              </Button>
              <Button type="submit" disabled={savePending || !form.name.trim() || !form.schedule_days.length}>
                {savePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Save changes" : "Create habit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveTarget !== null} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this habit?</DialogTitle>
            <DialogDescription>
              “{archiveTarget?.name}” will leave the active list. Its completion history stays intact
              and continues to count in past records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setArchiveTarget(null)} disabled={archivePending}>
              Keep active
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmArchive()} disabled={archivePending}>
              {archivePending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Archive habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
