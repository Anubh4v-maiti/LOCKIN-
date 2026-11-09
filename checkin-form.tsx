"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Loader2,
  Save,
  Sparkles,
  Star,
  Timer,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { saveCheckin } from "@/app/actions/checkin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/forms/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyLog, DailyReflection, NutritionEntry, WaterLog } from "@/lib/types";
import { cn, formatMl } from "@/lib/utils";

const EMPTY_FORM = {
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  water_ml: "",
  rating: 0,
  win: "",
  mistake: "",
  improvement: "",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

function toForm(
  nutrition: NutritionEntry | null,
  water: WaterLog | null,
  reflection: DailyReflection | null,
  dailyLog: DailyLog | null,
): FormState {
  const value = (input: number | null | undefined) => (input === null || input === undefined ? "" : String(input));
  return {
    calories: value(nutrition?.calories),
    protein_g: value(nutrition?.protein_g),
    carbs_g: value(nutrition?.carbs_g),
    fat_g: value(nutrition?.fat_g),
    fiber_g: value(nutrition?.fiber_g),
    water_ml: value(water?.total_ml),
    rating: reflection?.rating ?? 0,
    win: reflection?.win ?? "",
    mistake: reflection?.mistake ?? "",
    improvement: reflection?.improvement ?? "",
    notes: dailyLog?.notes ?? "",
  };
}

function RatingPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const labels = ["", "Rough", "Below par", "Okay", "Good", "Strong"];
  return (
    <div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Day rating from 1 to 5">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} out of 5, ${labels[rating]}`}
            onClick={() => onChange(value === rating ? 0 : rating)}
            className={cn(
              "rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value >= rating ? "text-[var(--chart-amber)]" : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          >
            <Star className={cn("size-5", value >= rating && "fill-current")} />
          </button>
        ))}
        <span className="ml-2 text-[11px] text-muted-foreground">
          {value ? labels[value] : "Optional"}
        </span>
      </div>
    </div>
  );
}

export function CheckinForm({
  logDate,
  today,
  dailyLog,
  reflection,
  nutrition,
  water,
  targets,
  streak,
}: {
  logDate: string;
  today: string;
  dailyLog: DailyLog | null;
  reflection: DailyReflection | null;
  nutrition: NutritionEntry | null;
  water: WaterLog | null;
  targets: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    water_ml: number | null;
  };
  streak: number;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"quick" | "full">(
    dailyLog?.checkin_status === "complete" ? "full" : "quick",
  );
  const [form, setForm] = React.useState<FormState>(() =>
    toForm(nutrition, water, reflection, dailyLog),
  );
  const [updateNutrition, setUpdateNutrition] = React.useState(true);
  const [updateWater, setUpdateWater] = React.useState(true);
  const [pending, setPending] = React.useState<"draft" | "complete" | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [justCompleted, setJustCompleted] = React.useState(false);
  const initial = React.useRef("");

  React.useEffect(() => {
    const next = toForm(nutrition, water, reflection, dailyLog);
    setForm(next);
    setMode(dailyLog?.checkin_status === "complete" ? "full" : "quick");
    setDirty(false);
    setJustCompleted(false);
    initial.current = JSON.stringify(next);
  }, [logDate, nutrition, water, reflection, dailyLog]);

  React.useEffect(() => {
    setDirty(initial.current !== "" && JSON.stringify(form) !== initial.current);
  }, [form]);

  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const completed = dailyLog?.checkin_status === "complete";
  const hasExisting = Boolean(
    nutrition ||
      water ||
      reflection ||
      form.rating ||
      form.win ||
      form.mistake ||
      form.improvement ||
      form.notes,
  );

  const submit = async (complete: boolean) => {
    if (pending) return;
    setPending(complete ? "complete" : "draft");
    try {
      const result = await saveCheckin({
        log_date: logDate,
        mode,
        complete,
        calories: form.calories,
        protein_g: form.protein_g,
        carbs_g: form.carbs_g,
        fat_g: form.fat_g,
        fiber_g: form.fiber_g,
        water_ml: form.water_ml,
        // Preserve hidden reflection fields when saving in quick mode. The
        // action writes the complete reflection, so sending blanks here would
        // erase existing full-mode answers.
        rating: form.rating || null,
        win: form.win,
        mistake: form.mistake,
        improvement: form.improvement,
        notes: form.notes,
        update_nutrition: updateNutrition,
        update_water: updateWater,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      initial.current = JSON.stringify(form);
      if (complete) {
        setJustCompleted(true);
        toast.success(result.message ?? "Check-in complete.");
      } else {
        toast.success(result.message ?? "Draft saved.");
      }
      router.refresh();
    } catch {
      toast.error("The check-in could not be saved. Check your connection.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="space-y-4">
        {justCompleted || completed ? (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.07] p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">
                {justCompleted ? "Check-in completed." : "This day is already complete."}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                You can correct any value below. A completed day stays completed; edits do not reset
                your streak.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/dashboard">
                Dashboard <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value as "quick" | "full")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="quick" className="gap-1.5">
                <Timer className="size-3" /> Quick · 2 minutes
              </TabsTrigger>
              <TabsTrigger value="full" className="gap-1.5">
                <Sparkles className="size-3" /> Full · with reflection
              </TabsTrigger>
            </TabsList>
            {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
          </div>

          <TabsContent value="quick" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="size-4 text-primary" /> Nutrition totals
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Leave anything unknown blank. Blank is stored as missing, not zero.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField
                    id="checkin-calories"
                    label="Calories"
                    value={form.calories}
                    onChange={(value) => set("calories", value)}
                    unit="kcal"
                    hint={targets.calories ? `Target ${targets.calories}` : "No target"}
                    max={20000}
                  />
                  <NumberField
                    id="checkin-protein"
                    label="Protein"
                    value={form.protein_g}
                    onChange={(value) => set("protein_g", value)}
                    unit="g"
                    hint={targets.protein_g ? `Target ${targets.protein_g}g` : "No target"}
                    max={1000}
                  />
                  <NumberField
                    id="checkin-carbs"
                    label="Carbs"
                    value={form.carbs_g}
                    onChange={(value) => set("carbs_g", value)}
                    unit="g"
                    hint={targets.carbs_g ? `Target ${targets.carbs_g}g` : "No target"}
                    max={2000}
                  />
                  <NumberField
                    id="checkin-fat"
                    label="Fat"
                    value={form.fat_g}
                    onChange={(value) => set("fat_g", value)}
                    unit="g"
                    hint={targets.fat_g ? `Target ${targets.fat_g}g` : "No target"}
                    max={1000}
                  />
                  <NumberField
                    id="checkin-fiber"
                    label="Fiber"
                    value={form.fiber_g}
                    onChange={(value) => set("fiber_g", value)}
                    unit="g"
                    hint={targets.fiber_g ? `Target ${targets.fiber_g}g` : "No target"}
                    max={500}
                  />
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-2/30 p-3">
                  <p className="text-[11px] font-medium">Update the saved nutrition entry?</p>
                  <Checkbox
                    checked={updateNutrition}
                    onChange={(event) => setUpdateNutrition(event.target.checked)}
                    label="Yes, replace this date's nutrition totals with the values above"
                  />
                  {nutrition?.source === "meals" ? (
                    <p className="text-[10px] leading-relaxed text-warning">
                      This entry currently comes from meal logging. Replacing it switches the source
                      to manual. Your meals stay saved.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="size-4 text-[var(--chart-blue)]" /> Water total
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {water ? `Currently saved: ${formatMl(water.total_ml)}.` : "No water saved for this date yet."}
                  {targets.water_ml ? ` Personal target: ${formatMl(targets.water_ml)}.` : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    id="checkin-water"
                    label="Total water"
                    value={form.water_ml}
                    onChange={(value) => set("water_ml", value)}
                    unit="ml"
                    hint={targets.water_ml ? `Target ${formatMl(targets.water_ml)}` : "No target set"}
                    max={30000}
                  />
                  <div className="flex items-end pb-1">
                    <Checkbox
                      checked={updateWater}
                      onChange={(event) => setUpdateWater(event.target.checked)}
                      label="Save this water total"
                    />
                  </div>
                </div>
                {updateWater && form.water_ml !== "" ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Saving replaces the total and records the difference as a water correction, which
                    can be reviewed on the Water page.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How did the day feel?</CardTitle>
                <p className="text-xs text-muted-foreground">Optional and private. Ratings are never used against you.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <RatingPicker value={form.rating} onChange={(value) => set("rating", value)} />
                <div className="space-y-1.5">
                  <Label htmlFor="quick-notes">Anything worth remembering? (optional)</Label>
                  <Textarea
                    id="quick-notes"
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    placeholder="A short note about the day…"
                    maxLength={4000}
                    className="min-h-[76px]"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="full" className="mt-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nutrition and water</CardTitle>
                <p className="text-xs text-muted-foreground">The same saved totals, with room to reflect.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField id="full-calories" label="Calories" value={form.calories} onChange={(v) => set("calories", v)} unit="kcal" max={20000} />
                  <NumberField id="full-protein" label="Protein" value={form.protein_g} onChange={(v) => set("protein_g", v)} unit="g" max={1000} />
                  <NumberField id="full-carbs" label="Carbs" value={form.carbs_g} onChange={(v) => set("carbs_g", v)} unit="g" max={2000} />
                  <NumberField id="full-fat" label="Fat" value={form.fat_g} onChange={(v) => set("fat_g", v)} unit="g" max={1000} />
                  <NumberField id="full-fiber" label="Fiber" value={form.fiber_g} onChange={(v) => set("fiber_g", v)} unit="g" max={500} />
                  <NumberField id="full-water" label="Water" value={form.water_ml} onChange={(v) => set("water_ml", v)} unit="ml" max={30000} />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Checkbox checked={updateNutrition} onChange={(e) => setUpdateNutrition(e.target.checked)} label="Update nutrition totals" />
                  <Checkbox checked={updateWater} onChange={(e) => setUpdateWater(e.target.checked)} label="Update water total" />
                </div>
              </CardContent>
            </Card>

            <Card id="reflection">
              <CardHeader>
                <CardTitle>Reflection</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Write only what is useful. Empty prompts are stored as empty, not as positive or negative evidence.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <RatingPicker value={form.rating} onChange={(value) => set("rating", value)} />
                <div className="space-y-1.5">
                  <Label htmlFor="reflection-win">What went well?</Label>
                  <Textarea
                    id="reflection-win"
                    value={form.win}
                    onChange={(event) => set("win", event.target.value)}
                    placeholder="A win, however small."
                    maxLength={2000}
                    className="min-h-[72px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reflection-mistake">What got in the way?</Label>
                  <Textarea
                    id="reflection-mistake"
                    value={form.mistake}
                    onChange={(event) => set("mistake", event.target.value)}
                    placeholder="Describe the obstacle without judging yourself."
                    maxLength={2000}
                    className="min-h-[72px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reflection-improvement">What would make tomorrow easier?</Label>
                  <Textarea
                    id="reflection-improvement"
                    value={form.improvement}
                    onChange={(event) => set("improvement", event.target.value)}
                    placeholder="One realistic adjustment."
                    maxLength={2000}
                    className="min-h-[72px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reflection-notes">Additional notes</Label>
                  <Textarea
                    id="reflection-notes"
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    placeholder="Anything else you want your future self to know."
                    maxLength={4000}
                    className="min-h-[76px]"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-[72px] z-20 rounded-2xl border border-border/80 bg-surface/95 p-3 shadow-xl backdrop-blur lg:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {completed
                ? "Completed. Saving edits preserves completion."
                : "Save a draft anytime. Complete only when today's record is honest enough."}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void submit(false)}
                disabled={pending !== null || !dirty}
              >
                {pending === "draft" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save draft
              </Button>
              <Button
                type="button"
                onClick={() => void submit(true)}
                disabled={pending !== null || !hasExisting}
              >
                {pending === "complete" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {completed ? "Save completed check-in" : "Complete check-in"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" /> Check-in status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant={completed ? "success" : dailyLog?.checkin_status === "partial" ? "secondary" : "outline"}>
                {completed ? "Complete" : dailyLog?.checkin_status === "partial" ? "Draft saved" : "Not started"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Current streak</span>
              <span className="text-sm font-semibold">{streak} {streak === 1 ? "day" : "days"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-2/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Date</span>
              <span className="text-xs font-medium">{logDate}</span>
            </div>
            {dailyLog?.completed_at ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                First completed at{" "}
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(dailyLog.completed_at))}
                .
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>No guilt scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p>A missed day is a data point, not a failure.</p>
            <p>You can edit past days without losing the original completion time.</p>
            <p>
              A check-in counts only when you explicitly complete it — opening this page alone does
              not count.
            </p>
          </CardContent>
        </Card>

        {logDate !== today ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/check-in`}>Go to today&apos;s check-in</Link>
          </Button>
        ) : null}
      </aside>
    </div>
  );
}
