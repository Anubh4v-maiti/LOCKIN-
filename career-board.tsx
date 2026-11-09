"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteCareerGoal,
  deleteMilestone,
  saveCareerGoal,
  saveMilestone,
  toggleMilestone,
} from "@/app/actions/career";
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
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { NumberField } from "@/components/forms/fields";
import { formatDate } from "@/lib/date";
import type { CareerGoal, CareerMilestone, CareerStatus } from "@/lib/types";
import { cn, pct } from "@/lib/utils";

const STATUS_LABELS: Record<CareerStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  paused: "Paused",
};

const STATUS_VARIANT: Record<CareerStatus, "default" | "secondary" | "success" | "muted"> = {
  planned: "muted",
  in_progress: "secondary",
  completed: "success",
  paused: "muted",
};

type GoalForm = {
  title: string;
  category: string;
  status: CareerStatus;
  target_date: string;
  progress: string;
  notes: string;
  resource_url: string;
};

const EMPTY_GOAL: GoalForm = {
  title: "",
  category: "",
  status: "planned",
  target_date: "",
  progress: "0",
  notes: "",
  resource_url: "",
};

export function CareerBoard({
  goals,
  milestones,
  today,
}: {
  goals: CareerGoal[];
  milestones: CareerMilestone[];
  today: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | CareerStatus>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CareerGoal | null>(null);
  const [form, setForm] = React.useState<GoalForm>(EMPTY_GOAL);
  const [savePending, setSavePending] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CareerGoal | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [milestoneGoal, setMilestoneGoal] = React.useState<CareerGoal | null>(null);
  const [milestoneTitle, setMilestoneTitle] = React.useState("");
  const [milestoneDue, setMilestoneDue] = React.useState("");
  const [milestonePending, setMilestonePending] = React.useState(false);
  const [togglePending, setTogglePending] = React.useState<string | null>(null);
  const [milestoneDeletePending, setMilestoneDeletePending] = React.useState<string | null>(null);

  const filtered = filter === "all" ? goals : goals.filter((goal) => goal.status === filter);
  const active = goals.filter((goal) => ["planned", "in_progress"].includes(goal.status)).length;
  const completed = goals.filter((goal) => goal.status === "completed").length;
  const averageProgress = goals.length
    ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
    : null;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_GOAL);
    setDialogOpen(true);
  };

  const openEdit = (goal: CareerGoal) => {
    setEditing(goal);
    setForm({
      title: goal.title,
      category: goal.category ?? "",
      status: goal.status,
      target_date: goal.target_date ?? "",
      progress: String(goal.progress),
      notes: goal.notes ?? "",
      resource_url: goal.resource_url ?? "",
    });
    setDialogOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || savePending) return;
    setSavePending(true);
    try {
      const result = await saveCareerGoal({
        id: editing?.id,
        title: form.title,
        category: form.category,
        status: form.status,
        target_date: form.target_date || null,
        progress: form.progress,
        notes: form.notes,
        resource_url: form.resource_url,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(editing ? "Goal updated." : "Goal created.");
        setDialogOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("The goal could not be saved.");
    } finally {
      setSavePending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    try {
      const result = await deleteCareerGoal(deleteTarget.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Goal deleted.");
        setDeleteTarget(null);
        router.refresh();
      }
    } catch {
      toast.error("The goal could not be deleted.");
    } finally {
      setDeletePending(false);
    }
  };

  const addMilestone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!milestoneGoal || !milestoneTitle.trim() || milestonePending) return;
    setMilestonePending(true);
    try {
      const result = await saveMilestone({
        goal_id: milestoneGoal.id,
        title: milestoneTitle,
        due_date: milestoneDue || null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Milestone added.");
        setMilestoneGoal(null);
        setMilestoneTitle("");
        setMilestoneDue("");
        router.refresh();
      }
    } catch {
      toast.error("The milestone could not be added.");
    } finally {
      setMilestonePending(false);
    }
  };

  const toggle = async (milestone: CareerMilestone) => {
    if (togglePending) return;
    setTogglePending(milestone.id);
    try {
      const result = await toggleMilestone({ id: milestone.id, completed: !milestone.completed });
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    } catch {
      toast.error("The milestone could not be updated.");
    } finally {
      setTogglePending(null);
    }
  };

  const removeMilestone = async (milestone: CareerMilestone) => {
    if (milestoneDeletePending) return;
    setMilestoneDeletePending(milestone.id);
    try {
      const result = await deleteMilestone(milestone.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Milestone deleted.");
        router.refresh();
      }
    } catch {
      toast.error("The milestone could not be deleted.");
    } finally {
      setMilestoneDeletePending(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Goals</p>
            <p className="metric mt-1 text-2xl font-semibold">{goals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</p>
            <p className="metric mt-1 text-2xl font-semibold">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
            <p className="metric mt-1 text-2xl font-semibold">{completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Average progress</p>
            <p className="metric mt-1 text-2xl font-semibold">{averageProgress === null ? "—" : `${averageProgress}%`}</p>
            <p className="text-[10px] text-muted-foreground">Across all goals</p>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "planned", "in_progress", "paused", "completed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-medium capitalize transition-colors",
                filter === value
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "All goals" : STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="size-3.5" /> New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="empty-illustration">
              <BriefcaseBusiness className="size-5" />
            </div>
            <p className="mt-4 font-display text-sm font-semibold">No career goals recorded.</p>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Add a goal only if it is real to you. Milestones break it into visible next actions.
            </p>
            <Button type="button" className="mt-4" onClick={openCreate}>
              <Plus className="size-4" /> Create a goal
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No goals in this status.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((goal) => {
            const goalMilestones = milestones.filter((milestone) => milestone.goal_id === goal.id);
            const done = goalMilestones.filter((milestone) => milestone.completed).length;
            return (
              <Card key={goal.id} className={cn(goal.status === "completed" && "border-primary/20")}>
                <CardHeader className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[goal.status]}>{STATUS_LABELS[goal.status]}</Badge>
                        {goal.category ? <Badge variant="outline">{goal.category}</Badge> : null}
                      </div>
                      <CardTitle className="mt-2 text-lg">{goal.title}</CardTitle>
                    </div>
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(goal)} aria-label={`Edit ${goal.title}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(goal)}
                        aria-label={`Delete ${goal.title}`}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-semibold text-foreground">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} label={`${goal.title} progress`} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                    {goal.target_date ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" /> Target {formatDate(goal.target_date, "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span>No target date</span>
                    )}
                    {goal.resource_url ? (
                      <a
                        href={goal.resource_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Resource <ExternalLink className="size-2.5" />
                      </a>
                    ) : null}
                  </div>

                  {goal.notes ? (
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{goal.notes}</p>
                  ) : null}

                  <div className="rounded-xl border border-border/60 bg-surface-2/25 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Milestones · {done}/{goalMilestones.length}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMilestoneGoal(goal);
                          setMilestoneTitle("");
                          setMilestoneDue("");
                        }}
                      >
                        <Plus className="size-3" /> Add
                      </Button>
                    </div>
                    {goalMilestones.length === 0 ? (
                      <p className="py-2 text-[10px] text-muted-foreground">No milestones yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {goalMilestones.map((milestone) => (
                          <li key={milestone.id} className="group flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-surface/60">
                            <button
                              type="button"
                              onClick={() => void toggle(milestone)}
                              disabled={togglePending !== null}
                              aria-label={`${milestone.completed ? "Mark incomplete" : "Mark complete"}: ${milestone.title}`}
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                                milestone.completed ? "border-primary bg-primary text-primary-foreground" : "border-input",
                              )}
                            >
                              {togglePending === milestone.id ? (
                                <Loader2 className="size-2.5 animate-spin" />
                              ) : milestone.completed ? (
                                <Check className="size-2.5" />
                              ) : null}
                            </button>
                            <span className={cn("min-w-0 flex-1 text-[11px]", milestone.completed && "text-muted-foreground line-through")}>
                              {milestone.title}
                              {milestone.due_date ? (
                                <span className="ml-1.5 text-[9px] text-muted-foreground">· {formatDate(milestone.due_date, "MMM d")}</span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              onClick={() => void removeMilestone(milestone)}
                              disabled={milestoneDeletePending !== null}
                              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                              aria-label={`Delete milestone ${milestone.title}`}
                            >
                              {milestoneDeletePending === milestone.id ? (
                                <Loader2 className="size-2.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-2.5" />
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {goal.status === "completed" ? (
                    <p className="flex items-center gap-1.5 text-[10px] text-primary">
                      <CheckCircle2 className="size-3" /> Goal completed
                      {goal.completed_at ? ` on ${formatDate(goal.completed_at.slice(0, 10), "MMM d, yyyy")}` : ""}.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit goal" : "New career goal"}</DialogTitle>
            <DialogDescription>Keep goals concrete and progress honest.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">Goal</Label>
              <Input
                id="goal-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="e.g. Complete a cloud certification"
                maxLength={200}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="goal-category">Category (optional)</Label>
                <Input
                  id="goal-category"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="e.g. Skills"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-status">Status</Label>
                <Select
                  id="goal-status"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CareerStatus }))}
                  options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target date (optional)</Label>
                <Input
                  id="goal-target"
                  type="date"
                  value={form.target_date}
                  onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))}
                />
              </div>
              <NumberField
                id="goal-progress"
                label="Progress"
                value={form.progress}
                onChange={(value) => setForm((current) => ({ ...current, progress: value }))}
                unit="%"
                min={0}
                max={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-notes">Notes (optional)</Label>
              <Textarea
                id="goal-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                maxLength={4000}
                className="min-h-[80px]"
                placeholder="Why this matters, constraints, next step…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-resource">Resource link (optional)</Label>
              <Input
                id="goal-resource"
                type="url"
                value={form.resource_url}
                onChange={(event) => setForm((current) => ({ ...current, resource_url: event.target.value }))}
                placeholder="https://…"
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={savePending}>
                Cancel
              </Button>
              <Button type="submit" disabled={savePending || !form.title.trim()}>
                {savePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Save changes" : "Create goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneGoal !== null} onOpenChange={(open) => { if (!open) setMilestoneGoal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a milestone</DialogTitle>
            <DialogDescription>For “{milestoneGoal?.title}”. Keep it small enough to finish.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addMilestone} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-title">Milestone</Label>
              <Input
                id="milestone-title"
                value={milestoneTitle}
                onChange={(event) => setMilestoneTitle(event.target.value)}
                maxLength={200}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-due">Due date (optional)</Label>
              <Input
                id="milestone-due"
                type="date"
                value={milestoneDue}
                onChange={(event) => setMilestoneDue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMilestoneGoal(null)} disabled={milestonePending}>
                Cancel
              </Button>
              <Button type="submit" disabled={milestonePending || !milestoneTitle.trim()}>
                {milestonePending ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                Add milestone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this goal?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” and all its milestones will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
              Keep goal
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deletePending}>
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Target className="size-3" />
        Progress is self-reported. Milestones are the concrete evidence.
      </p>
    </div>
  );
}
