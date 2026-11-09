"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CircleStop,
  Clock3,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteStudySession,
  pauseFocus,
  resumeFocus,
  saveStudySession,
  startFocus,
  stopFocus,
} from "@/app/actions/study";
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
import { Progress, ProgressRing } from "@/components/ui/progress";
import { NumberField } from "@/components/forms/fields";
import { formatDate } from "@/lib/date";
import type { FocusSession, StudySession } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { percentOf } from "@/lib/metrics";

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function elapsedFor(session: FocusSession) {
  if (session.status === "running") {
    return (
      (session.accumulated_seconds ?? 0) +
      Math.max(0, Math.floor((Date.now() - Date.parse(session.started_at)) / 1000))
    );
  }
  return session.accumulated_seconds ?? 0;
}

type SessionForm = {
  subject: string;
  topic: string;
  minutes: string;
  planned_minutes: string;
  distractions: string;
  notes: string;
};

const EMPTY_SESSION: SessionForm = {
  subject: "",
  topic: "",
  minutes: "",
  planned_minutes: "",
  distractions: "",
  notes: "",
};

export function StudyBoard({
  logDate,
  sessions,
  activeFocus,
  targetMinutes,
}: {
  logDate: string;
  sessions: StudySession[];
  activeFocus: FocusSession | null;
  targetMinutes: number | null;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = React.useState(() => (activeFocus ? elapsedFor(activeFocus) : 0));
  const [timerPending, setTimerPending] = React.useState<string | null>(null);
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [plannedMinutes, setPlannedMinutes] = React.useState("25");
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StudySession | null>(null);
  const [sessionForm, setSessionForm] = React.useState<SessionForm>(EMPTY_SESSION);
  const [sessionPending, setSessionPending] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<StudySession | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  React.useEffect(() => {
    setElapsed(activeFocus ? elapsedFor(activeFocus) : 0);
    if (!activeFocus || activeFocus.status !== "running") return;
    const interval = setInterval(() => setElapsed(elapsedFor(activeFocus)), 1000);
    return () => clearInterval(interval);
  }, [activeFocus]);

  const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const hasSessions = sessions.length > 0;
  const targetPercent = hasSessions ? percentOf(totalMinutes, targetMinutes) : null;
  const plannedSeconds = activeFocus ? activeFocus.planned_minutes * 60 : 0;
  const timerPercent = activeFocus && plannedSeconds > 0 ? (elapsed / plannedSeconds) * 100 : null;

  const begin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || timerPending) return;
    setTimerPending("start");
    try {
      const result = await startFocus({
        subject,
        topic,
        planned_minutes: plannedMinutes,
      });
      if (!result.ok) toast.error(result.error);
      else {
        setSubject("");
        setTopic("");
        toast.success("Focus timer started.");
        router.refresh();
      }
    } catch {
      toast.error("The timer could not start.");
    } finally {
      setTimerPending(null);
    }
  };

  const pause = async () => {
    if (!activeFocus || timerPending) return;
    setTimerPending("pause");
    try {
      const result = await pauseFocus(activeFocus.id);
      if (!result.ok) toast.error(result.error);
      else {
        setElapsed(result.elapsedSeconds);
        toast.success("Timer paused.");
        router.refresh();
      }
    } catch {
      toast.error("The timer could not be paused.");
    } finally {
      setTimerPending(null);
    }
  };

  const resume = async () => {
    if (!activeFocus || timerPending) return;
    setTimerPending("resume");
    try {
      const result = await resumeFocus(activeFocus.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Timer resumed.");
        router.refresh();
      }
    } catch {
      toast.error("The timer could not be resumed.");
    } finally {
      setTimerPending(null);
    }
  };

  const finish = async (action: "save" | "discard") => {
    if (!activeFocus || timerPending) return;
    setTimerPending(action);
    try {
      const result = await stopFocus({ id: activeFocus.id, action });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(action === "save" ? `Saved ${result.minutes ?? 0} focused minutes.` : "Session discarded.");
        router.refresh();
      }
    } catch {
      toast.error("The session could not be finished.");
    } finally {
      setTimerPending(null);
    }
  };

  const openNewSession = () => {
    setEditing(null);
    setSessionForm({ ...EMPTY_SESSION, subject: activeFocus?.subject ?? "" });
    setSessionOpen(true);
  };

  const openEditSession = (session: StudySession) => {
    setEditing(session);
    setSessionForm({
      subject: session.subject,
      topic: session.topic ?? "",
      minutes: String(session.minutes),
      planned_minutes: session.planned_minutes === null ? "" : String(session.planned_minutes),
      distractions: session.distractions ?? "",
      notes: session.notes ?? "",
    });
    setSessionOpen(true);
  };

  const saveSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionForm.subject.trim() || sessionPending) return;
    setSessionPending(true);
    try {
      const result = await saveStudySession({
        id: editing?.id,
        log_date: logDate,
        subject: sessionForm.subject,
        topic: sessionForm.topic,
        minutes: sessionForm.minutes,
        planned_minutes: sessionForm.planned_minutes,
        distractions: sessionForm.distractions,
        notes: sessionForm.notes,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(editing ? "Session updated." : "Session saved.");
        setSessionOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("The session could not be saved.");
    } finally {
      setSessionPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    try {
      const result = await deleteStudySession(deleteTarget.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Session deleted.");
        setDeleteTarget(null);
        router.refresh();
      }
    } catch {
      toast.error("The session could not be deleted.");
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Study today</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {hasSessions ? totalMinutes : "—"}
              <span className="ml-1 text-xs font-medium text-muted-foreground">min</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</p>
            <p className="metric mt-1 text-2xl font-semibold">{sessions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {targetMinutes === null ? "—" : `${targetMinutes} min`}
            </p>
            {targetMinutes && hasSessions ? <Progress value={targetPercent} className="mt-2" label="Study target" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Timer</p>
            <p className="metric mt-1 text-2xl font-semibold">
              {activeFocus ? (activeFocus.status === "running" ? "Running" : "Paused") : "Idle"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeFocus ? activeFocus.subject : "No active session"}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="size-4 text-primary" /> Focus timer
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Real elapsed time. Pause if you step away; only saved minutes count.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeFocus ? (
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
                <ProgressRing
                  value={timerPercent === null ? null : Math.min(100, timerPercent)}
                  size={154}
                  strokeWidth={10}
                  label="Focus timer progress"
                >
                  <div className="text-center">
                    <p className="metric text-3xl font-semibold tabular-nums">{formatClock(elapsed)}</p>
                    <p className="mt-1 max-w-[110px] truncate text-[10px] text-muted-foreground">
                      {activeFocus.subject}
                    </p>
                  </div>
                </ProgressRing>
                <div className="flex flex-wrap justify-center gap-2">
                  {activeFocus.status === "running" ? (
                    <Button type="button" variant="outline" onClick={() => void pause()} disabled={timerPending !== null}>
                      {timerPending === "pause" ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
                      Pause
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void resume()} disabled={timerPending !== null}>
                      {timerPending === "resume" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                      Resume
                    </Button>
                  )}
                  <Button type="button" onClick={() => void finish("save")} disabled={timerPending !== null}>
                    {timerPending === "save" ? <Loader2 className="size-4 animate-spin" /> : <CircleStop className="size-4" />}
                    Stop & save
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void finish("discard")} disabled={timerPending !== null}>
                    Discard
                  </Button>
                </div>
                <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                  {activeFocus.topic ? `${activeFocus.topic} · ` : ""}
                  Planned {activeFocus.planned_minutes} min. Sessions under one minute cannot be saved.
                </p>
              </div>
            ) : (
              <form onSubmit={begin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="focus-subject">Subject</Label>
                  <Input
                    id="focus-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="e.g. Organic chemistry"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="focus-topic">Topic (optional)</Label>
                  <Input
                    id="focus-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="e.g. Reaction mechanisms"
                    maxLength={500}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumberField
                      id="focus-minutes"
                      label="Planned minutes"
                      value={plannedMinutes}
                      onChange={setPlannedMinutes}
                      min={1}
                      max={240}
                    />
                  </div>
                  <Button type="submit" disabled={timerPending !== null || !subject.trim()}>
                    {timerPending === "start" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Start
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Logged sessions</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(logDate, "MMM d, yyyy")} · {hasSessions ? `${totalMinutes} minutes from ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}` : "No sessions recorded"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openNewSession}>
              <Plus className="size-3.5" /> Add manually
            </Button>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="mx-auto size-7 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No study sessions logged.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A day with no recorded study is missing data, not zero hours.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li key={session.id} className="rounded-xl border border-border/60 bg-surface-2/30 p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                        <Clock3 className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{session.subject}</p>
                          <Badge variant={session.source === "timer" ? "secondary" : "outline"}>
                            {session.source === "timer" ? "Timer" : "Manual"}
                          </Badge>
                        </div>
                        {session.topic ? <p className="mt-0.5 text-[11px] text-muted-foreground">{session.topic}</p> : null}
                        <p className="mt-1 text-xs font-semibold tabular-nums">
                          {session.minutes} min
                          {session.planned_minutes ? (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              of {session.planned_minutes} planned
                            </span>
                          ) : null}
                        </p>
                        {session.distractions ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">Distractions: {session.distractions}</p>
                        ) : null}
                        {session.notes ? (
                          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{session.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditSession(session)} aria-label="Edit session">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(session)} aria-label="Delete session" className="hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit study session" : "Log a study session"}</DialogTitle>
            <DialogDescription>
              Only add time you actually studied. Missing sessions are never inferred.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSession} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="session-subject">Subject</Label>
                <Input
                  id="session-subject"
                  value={sessionForm.subject}
                  onChange={(event) => setSessionForm((current) => ({ ...current, subject: event.target.value }))}
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-topic">Topic (optional)</Label>
                <Input
                  id="session-topic"
                  value={sessionForm.topic}
                  onChange={(event) => setSessionForm((current) => ({ ...current, topic: event.target.value }))}
                  maxLength={500}
                />
              </div>
              <NumberField
                id="session-minutes"
                label="Minutes studied"
                value={sessionForm.minutes}
                onChange={(value) => setSessionForm((current) => ({ ...current, minutes: value }))}
                min={1}
                max={1440}
              />
              <NumberField
                id="session-planned"
                label="Planned minutes (optional)"
                value={sessionForm.planned_minutes}
                onChange={(value) => setSessionForm((current) => ({ ...current, planned_minutes: value }))}
                min={0}
                max={1440}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-distractions">Distractions (optional)</Label>
              <Input
                id="session-distractions"
                value={sessionForm.distractions}
                onChange={(event) => setSessionForm((current) => ({ ...current, distractions: event.target.value }))}
                maxLength={1000}
                placeholder="What pulled your attention?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-notes">Notes (optional)</Label>
              <Textarea
                id="session-notes"
                value={sessionForm.notes}
                onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))}
                maxLength={2000}
                className="min-h-[68px]"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSessionOpen(false)} disabled={sessionPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={sessionPending || !sessionForm.subject.trim() || !sessionForm.minutes}>
                {sessionPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {editing ? "Save changes" : "Save session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this study session?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.subject} · {deleteTarget?.minutes} minutes. This removes only this session record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePending}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deletePending}>
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className={cn("text-center text-[10px]", totalMinutes === 0 ? "text-muted-foreground" : "text-muted-foreground")}>
        {hasSessions
          ? `Today's progress: ${formatNumber(totalMinutes)} minutes${targetMinutes === null ? ". No study target is set." : ` of ${formatNumber(targetMinutes)} target minutes.`}`
          : "No study sessions recorded for this date. This is missing data, not a zero-minute result."}
      </p>
    </div>
  );
}
