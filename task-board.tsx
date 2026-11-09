"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Copy,
  Filter,
  Layers,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyTemplates,
  copyTasks,
  deleteTask,
  deleteTemplate,
  reorderTasks,
  saveTask,
  saveTemplate,
} from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TaskCheckButton } from "@/components/tasks/task-toggle";
import {
  PRIORITY_LABELS,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  type DailyTask,
  type TaskCategory,
  type TaskPriority,
  type TaskTemplate,
} from "@/lib/types";
import { addDays, formatDate, isValidDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";

type TaskFormState = {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string;
};

const EMPTY_FORM: TaskFormState = {
  title: "",
  description: "",
  category: "personal",
  priority: "medium",
  due_date: "",
};

const CATEGORY_OPTIONS = TASK_CATEGORIES.map((category) => ({
  value: category.value,
  label: category.label,
}));

function categoryColor(category: TaskCategory) {
  return TASK_CATEGORIES.find((item) => item.value === category)?.color ?? "#9299A8";
}

function TaskForm({
  state,
  setState,
  idPrefix,
  onSubmit,
  pending,
  submitLabel,
}: {
  state: TaskFormState;
  setState: React.Dispatch<React.SetStateAction<TaskFormState>>;
  idPrefix: string;
  onSubmit: (event: React.FormEvent) => void;
  pending: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Task</Label>
        <Input
          id={`${idPrefix}-title`}
          value={state.title}
          onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
          placeholder="What needs to happen?"
          maxLength={200}
          required
          autoFocus
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Category</Label>
          <Select
            id={`${idPrefix}-category`}
            value={state.category}
            onChange={(event) =>
              setState((current) => ({ ...current, category: event.target.value as TaskCategory }))
            }
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            id={`${idPrefix}-priority`}
            value={state.priority}
            onChange={(event) =>
              setState((current) => ({ ...current, priority: event.target.value as TaskPriority }))
            }
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={state.description}
          onChange={(event) => setState((current) => ({ ...current, description: event.target.value }))}
          placeholder="Context, definition of done, or a link."
          maxLength={2000}
          className="min-h-[76px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-due`}>Due date (optional)</Label>
        <Input
          id={`${idPrefix}-due`}
          type="date"
          value={state.due_date}
          onChange={(event) => setState((current) => ({ ...current, due_date: event.target.value }))}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending || !state.title.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TaskBoard({
  logDate,
  today,
  initialTasks,
  templates,
}: {
  logDate: string;
  today: string;
  initialTasks: DailyTask[];
  templates: TaskTemplate[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(initialTasks);
  const [filter, setFilter] = React.useState<"all" | "pending" | "completed">("all");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | TaskCategory>("all");
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickCategory, setQuickCategory] = React.useState<TaskCategory>("personal");
  const [quickPriority, setQuickPriority] = React.useState<TaskPriority>("medium");
  const [addPending, setAddPending] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DailyTask | null>(null);
  const [detailForm, setDetailForm] = React.useState<TaskFormState>(EMPTY_FORM);
  const [detailPending, setDetailPending] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DailyTask | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [templatePending, setTemplatePending] = React.useState(false);
  const [selectedTemplates, setSelectedTemplates] = React.useState<string[]>([]);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [copyFrom, setCopyFrom] = React.useState(addDays(logDate, -1));
  const [copyCompleted, setCopyCompleted] = React.useState(false);
  const [copyPending, setCopyPending] = React.useState(false);
  const [reorderPending, setReorderPending] = React.useState<string | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = React.useState(false);
  const [templateTitle, setTemplateTitle] = React.useState("");
  const [templateCategory, setTemplateCategory] = React.useState<TaskCategory>("personal");
  const [templatePriority, setTemplatePriority] = React.useState<TaskPriority>("medium");
  const [templateCreatePending, setTemplateCreatePending] = React.useState(false);

  React.useEffect(() => setTasks(initialTasks), [initialTasks]);

  const stats = React.useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    return {
      total,
      completed,
      pending: total - completed,
      percent: total ? (completed / total) * 100 : null,
      allDone: total > 0 && total === completed,
    };
  }, [tasks]);

  const visible = tasks.filter((task) => {
    if (filter === "pending" && task.completed) return false;
    if (filter === "completed" && !task.completed) return false;
    if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
    return true;
  });

  const resetDetail = () => {
    setEditing(null);
    setDetailForm(EMPTY_FORM);
  };

  const openCreate = () => {
    resetDetail();
    setDetailOpen(true);
  };

  const openEdit = (task: DailyTask) => {
    setEditing(task);
    setDetailForm({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.priority,
      due_date: task.due_at ? task.due_at.slice(0, 10) : "",
    });
    setDetailOpen(true);
  };

  const addQuick = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quickTitle.trim() || addPending) return;
    setAddPending(true);
    try {
      const result = await saveTask({
        log_date: logDate,
        title: quickTitle,
        description: "",
        category: quickCategory,
        priority: quickPriority,
        due_at: "",
        reminder_at: "",
      });
      if (!result.ok) toast.error(result.error);
      else {
        setQuickTitle("");
        toast.success("Task added.");
        router.refresh();
      }
    } catch {
      toast.error("The task could not be saved. Check your connection.");
    } finally {
      setAddPending(false);
    }
  };

  const saveDetailed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailForm.title.trim() || detailPending) return;
    setDetailPending(true);
    try {
      const result = await saveTask({
        id: editing?.id,
        log_date: logDate,
        title: detailForm.title,
        description: detailForm.description,
        category: detailForm.category,
        priority: detailForm.priority,
        due_at: detailForm.due_date || "",
        reminder_at: editing?.reminder_at ?? "",
      });
      if (!result.ok) toast.error(result.error);
      else {
        setDetailOpen(false);
        resetDetail();
        toast.success(editing ? "Task updated." : "Task added.");
        router.refresh();
      }
    } catch {
      toast.error("The task could not be saved.");
    } finally {
      setDetailPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    try {
      const result = await deleteTask(deleteTarget.id);
      if (!result.ok) toast.error(result.error);
      else {
        setTasks((current) => current.filter((task) => task.id !== deleteTarget.id));
        setDeleteTarget(null);
        toast.success("Task deleted.");
        router.refresh();
      }
    } catch {
      toast.error("The task could not be deleted.");
    } finally {
      setDeletePending(false);
    }
  };

  const move = async (task: DailyTask, direction: -1 | 1) => {
    if (reorderPending) return;
    const index = tasks.findIndex((item) => item.id === task.id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= tasks.length) return;
    const next = [...tasks];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setTasks(next);
    setReorderPending(task.id);
    try {
      const result = await reorderTasks({
        log_date: logDate,
        ordered_ids: next.map((item) => item.id),
      });
      if (!result.ok) {
        setTasks(tasks);
        toast.error(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setTasks(tasks);
      toast.error("The order could not be saved.");
    } finally {
      setReorderPending(null);
    }
  };

  const handleCopy = async () => {
    if (!isValidDateKey(copyFrom) || copyPending) return;
    setCopyPending(true);
    try {
      const result = await copyTasks({
        from_date: copyFrom,
        to_date: logDate,
        include_completed: copyCompleted,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? `${result.copied} tasks copied.`);
        setCopyOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Tasks could not be copied.");
    } finally {
      setCopyPending(false);
    }
  };

  const handleApplyTemplates = async () => {
    if (!selectedTemplates.length || templatePending) return;
    setTemplatePending(true);
    try {
      const result = await applyTemplates({ log_date: logDate, template_ids: selectedTemplates });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Templates added.");
        setSelectedTemplates([]);
        setTemplateOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Templates could not be applied.");
    } finally {
      setTemplatePending(false);
    }
  };

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateTitle.trim() || templateCreatePending) return;
    setTemplateCreatePending(true);
    try {
      const result = await saveTemplate({
        title: templateTitle,
        description: "",
        category: templateCategory,
        priority: templatePriority,
      });
      if (!result.ok) toast.error(result.error);
      else {
        setTemplateTitle("");
        setNewTemplateOpen(false);
        toast.success("Template saved.");
        router.refresh();
      }
    } catch {
      toast.error("The template could not be saved.");
    } finally {
      setTemplateCreatePending(false);
    }
  };

  const saveTaskAsTemplate = async (task: DailyTask) => {
    const result = await saveTemplate({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      priority: task.priority,
    });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Saved as a reusable template.");
      router.refresh();
    }
  };

  const removeTemplate = async (id: string) => {
    const result = await deleteTemplate(id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success("Template removed.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Planned</p>
            <p className="metric mt-1 text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
            <p className="metric mt-1 text-2xl font-semibold">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Open</p>
            <p className="metric mt-1 text-2xl font-semibold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completion</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {stats.percent === null ? "—" : `${Math.round(stats.percent)}%`}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {stats.total ? "of planned tasks" : "No tasks planned"}
            </p>
          </CardContent>
        </Card>
      </section>

      {stats.allDone ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] px-4 py-3">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">Everything planned is complete.</p>
            <p className="text-[11px] text-muted-foreground">
              Close the list here. Extra credit is optional, rest is allowed.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="size-4 text-primary" /> Plan for{" "}
                  {formatDate(logDate, "MMM d")}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each date has its own independent list. Checking a task never edits another day.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
                  <ClipboardCopy className="size-3.5" /> Copy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplateOpen(true)}
                  disabled={!templates.length}
                >
                  <Layers className="size-3.5" /> Templates
                </Button>
              </div>
            </div>

            <form onSubmit={addQuick} id="add-task" className="rounded-xl border border-border/70 bg-surface-2/30 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  placeholder="Add a task and press Enter…"
                  maxLength={200}
                  aria-label="Quick task title"
                  className="flex-1 bg-surface/80"
                />
                <Button type="submit" disabled={addPending || !quickTitle.trim()}>
                  {addPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Quick task category"
                  value={quickCategory}
                  onChange={(event) => setQuickCategory(event.target.value as TaskCategory)}
                  options={CATEGORY_OPTIONS}
                  className="h-8 w-auto min-w-[120px] text-xs"
                />
                <Select
                  aria-label="Quick task priority"
                  value={quickPriority}
                  onChange={(event) => setQuickPriority(event.target.value as TaskPriority)}
                  options={[
                    { value: "low", label: "Low priority" },
                    { value: "medium", label: "Medium priority" },
                    { value: "high", label: "High priority" },
                  ]}
                  className="h-8 w-auto min-w-[130px] text-xs"
                />
                <Button type="button" variant="ghost" size="sm" onClick={openCreate}>
                  More details
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Filter className="size-3" /> Filter
              </span>
              {(["all", "pending", "completed"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize transition-colors",
                    filter === value
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                  categoryFilter === "all"
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground",
                )}
              >
                All categories
              </button>
              {TASK_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setCategoryFilter(category.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                    categoryFilter === category.value
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ background: category.color }} />
                  {category.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="empty-illustration">
                  <ListTodo className="size-5" />
                </div>
                <p className="mt-4 text-sm font-semibold">No tasks planned for this date.</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Zero planned tasks is not a 100% completion rate. Add only what you actually intend
                  to do.
                </p>
                <Button type="button" variant="subtle" size="sm" className="mt-4" onClick={openCreate}>
                  <Plus className="size-3.5" /> Add the first task
                </Button>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No tasks match these filters.</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setFilter("all");
                    setCategoryFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {visible.map((task) => {
                  const fullIndex = tasks.findIndex((item) => item.id === task.id);
                  return (
                    <li
                      key={task.id}
                      className={cn(
                        "group flex items-start gap-3 py-3 transition-opacity",
                        reorderPending === task.id && "opacity-60",
                      )}
                    >
                      <TaskCheckButton task={task} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium transition-colors",
                              task.completed && "text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          {task.completed ? (
                            <CheckCircle2 className="size-3.5 text-primary" aria-label="Completed" />
                          ) : null}
                        </div>
                        {task.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="gap-1">
                            <span className="size-1.5 rounded-full" style={{ background: categoryColor(task.category) }} />
                            {TASK_CATEGORY_LABELS[task.category]}
                          </Badge>
                          <Badge
                            variant={task.priority === "high" ? "warning" : task.priority === "low" ? "muted" : "outline"}
                          >
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                          {task.due_at ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CalendarClock className="size-3" />
                              Due {formatDate(task.due_at.slice(0, 10), "MMM d")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void move(task, -1)}
                          disabled={fullIndex <= 0 || reorderPending !== null}
                          aria-label={`Move ${task.title} up`}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void move(task, 1)}
                          disabled={fullIndex >= tasks.length - 1 || reorderPending !== null}
                          aria-label={`Move ${task.title} down`}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(task)}
                          aria-label={`Edit ${task.title}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void saveTaskAsTemplate(task)}
                          aria-label={`Save ${task.title} as a template`}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(task)}
                          aria-label={`Delete ${task.title}`}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Templates</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Reusable tasks, added on demand.</p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setNewTemplateOpen(true)} aria-label="New template">
                <Plus className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="py-3 text-center text-xs leading-relaxed text-muted-foreground">
                  No templates yet. Save a task with the copy icon, or create one here.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {templates.map((template) => (
                    <li
                      key={template.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-2.5 py-2"
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: categoryColor(template.category) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{template.title}</span>
                      <button
                        type="button"
                        onClick={() => void removeTemplate(template.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove template ${template.title}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {templates.length ? (
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => setTemplateOpen(true)}>
                  <Layers className="size-3.5" /> Add from templates
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Keyboard-friendly workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p><strong className="text-foreground">Enter</strong> adds a quick task.</p>
              <p><strong className="text-foreground">Tab</strong> reaches every action; nothing requires drag-and-drop.</p>
              <p><strong className="text-foreground">Copy</strong> brings forward unfinished tasks from another date without duplicates.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) resetDetail(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "Add task with details"}</DialogTitle>
            <DialogDescription>
              This task belongs only to {formatDate(logDate, "MMM d, yyyy")}.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            state={detailForm}
            setState={setDetailForm}
            idPrefix="detail-task"
            onSubmit={saveDetailed}
            pending={detailPending}
            submitLabel={editing ? "Save changes" : "Add task"}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” will be removed from {formatDate(logDate, "MMM d")}. Other dates are unaffected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deletePending}>
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy tasks to this date</DialogTitle>
            <DialogDescription>
              Duplicate titles are skipped. Copied tasks start incomplete, even if the source was completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="copy-from">Copy from</Label>
              <Input
                id="copy-from"
                type="date"
                value={copyFrom}
                max={today}
                onChange={(event) => setCopyFrom(event.target.value)}
              />
            </div>
            <Checkbox
              checked={copyCompleted}
              onChange={(event) => setCopyCompleted(event.target.checked)}
              label="Also copy tasks that were completed on the source date"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyOpen(false)} disabled={copyPending}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCopy()} disabled={copyPending || !isValidDateKey(copyFrom)}>
              {copyPending ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCopy className="size-4" />}
              Copy tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add from templates</DialogTitle>
            <DialogDescription>Select any reusable tasks to add to this date.</DialogDescription>
          </DialogHeader>
          {templates.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No templates available.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const checked = selectedTemplates.includes(template.id);
                return (
                  <label
                    key={template.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2.5"
                  >
                    <Checkbox
                      checked={checked}
                      onChange={(event) =>
                        setSelectedTemplates((current) =>
                          event.target.checked ? [...current, template.id] : current.filter((id) => id !== template.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{template.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {TASK_CATEGORY_LABELS[template.category]} · {PRIORITY_LABELS[template.priority]}
                      </span>
                    </span>
                    <ChevronDown className="size-3 -rotate-90 text-muted-foreground" />
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)} disabled={templatePending}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleApplyTemplates()} disabled={!selectedTemplates.length || templatePending}>
              {templatePending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New reusable template</DialogTitle>
            <DialogDescription>Templates are only added when you choose them.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTemplate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-title">Template task</Label>
              <Input
                id="template-title"
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="e.g. 30 minutes of revision"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-category">Category</Label>
                <Select
                  id="template-category"
                  value={templateCategory}
                  onChange={(event) => setTemplateCategory(event.target.value as TaskCategory)}
                  options={CATEGORY_OPTIONS}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-priority">Priority</Label>
                <Select
                  id="template-priority"
                  value={templatePriority}
                  onChange={(event) => setTemplatePriority(event.target.value as TaskPriority)}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewTemplateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={templateCreatePending || !templateTitle.trim()}>
                {templateCreatePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
