"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { deleteNutrition, saveNutrition } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { NumberField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { NutritionEntry, TargetVersion } from "@/lib/types";

interface FormValues {
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  notes: string;
}

function toValues(entry: NutritionEntry | null): FormValues {
  return {
    calories: entry?.calories != null ? String(entry.calories) : "",
    protein_g: entry?.protein_g != null ? String(entry.protein_g) : "",
    carbs_g: entry?.carbs_g != null ? String(entry.carbs_g) : "",
    fat_g: entry?.fat_g != null ? String(entry.fat_g) : "",
    fiber_g: entry?.fiber_g != null ? String(entry.fiber_g) : "",
    notes: entry?.notes ?? "",
  };
}

function targetLabel(value: number | null, unit: string) {
  return value === null ? "No target set" : `Target ${formatNumber(value)} ${unit}`;
}

export function NutritionForm({
  logDate,
  entry,
  targets,
}: {
  logDate: string;
  entry: NutritionEntry | null;
  targets: TargetVersion | null;
}) {
  const [values, setValues] = React.useState<FormValues>(() => toValues(entry));
  const [baseline, setBaseline] = React.useState<FormValues>(() => toValues(entry));
  const [pending, setPending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setValues(toValues(entry));
    setBaseline(toValues(entry));
  }, [entry, logDate]);

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baseline),
    [values, baseline],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = (key: keyof FormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (confirmed: boolean) => {
    if (pending) return;
    setPending(true);
    try {
      const result = await saveNutrition({
        log_date: logDate,
        calories: values.calories,
        protein_g: values.protein_g,
        carbs_g: values.carbs_g,
        fat_g: values.fat_g,
        fiber_g: values.fiber_g,
        notes: values.notes,
        confirmed,
      });
      if (!result.ok) {
        if (result.requiresConfirmation) {
          setConfirmOpen(true);
        } else {
          toast.error(result.error);
        }
        return;
      }
      setBaseline(values);
      setConfirmOpen(false);
      toast.success(result.message ?? "Nutrition saved.");
      router.refresh();
    } catch {
      toast.error("Nutrition could not be saved. Check your connection.");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await deleteNutrition(logDate);
      if (!result.ok) toast.error(result.error);
      else {
        const blank = toValues(null);
        setValues(blank);
        setBaseline(blank);
        setDeleteOpen(false);
        toast.success(result.message ?? "Record deleted.");
        router.refresh();
      }
    } catch {
      toast.error("The record could not be deleted.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>End-of-day totals</CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enter final totals once. Empty fields stay missing — they are never treated as zero.
          </p>
        </div>
        <Badge variant={entry ? "default" : "outline"}>{entry ? "Saved" : "No record"}</Badge>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              id="calories"
              label="Calories"
              unit="kcal"
              value={values.calories}
              onChange={set("calories")}
              placeholder="e.g. 2150"
              hint={targetLabel(targets?.calories ?? null, "kcal")}
            />
            <NumberField
              id="protein_g"
              label="Protein"
              unit="g"
              value={values.protein_g}
              onChange={set("protein_g")}
              placeholder="e.g. 105"
              hint={targetLabel(targets?.protein_g ?? null, "g")}
            />
            <NumberField
              id="carbs_g"
              label="Carbohydrates"
              unit="g"
              value={values.carbs_g}
              onChange={set("carbs_g")}
              placeholder="e.g. 250"
              hint={targetLabel(targets?.carbs_g ?? null, "g")}
            />
            <NumberField
              id="fat_g"
              label="Fat"
              unit="g"
              value={values.fat_g}
              onChange={set("fat_g")}
              placeholder="e.g. 65"
              hint={targetLabel(targets?.fat_g ?? null, "g")}
            />
            <NumberField
              id="fiber_g"
              label="Fiber (optional)"
              unit="g"
              value={values.fiber_g}
              onChange={set("fiber_g")}
              placeholder="Optional"
              hint={targetLabel(targets?.fiber_g ?? null, "g")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nutrition-notes">Notes (optional)</Label>
            <Textarea
              id="nutrition-notes"
              value={values.notes}
              onChange={(event) => set("notes")(event.target.value)}
              placeholder="Context, estimates, eating out, anything worth remembering."
              maxLength={2000}
            />
          </div>

          {entry?.source === "meals" ? (
            <p className="rounded-lg border border-secondary/20 bg-secondary/[0.06] px-3 py-2 text-[11px] text-secondary">
              These totals were copied from logged meals. Editing them will mark the record as manual.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {pending ? "Saving…" : "Save nutrition"}
            </Button>
            {entry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> Delete record
              </Button>
            ) : null}
            {dirty ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-warning">
                <TriangleAlert className="size-3" /> Unsaved changes
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace the saved record?</DialogTitle>
            <DialogDescription>
              A nutrition record already exists for this date. Saving will replace its values.
              This is never done silently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void submit(true)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Replace record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this nutrition record?</DialogTitle>
            <DialogDescription>
              This removes all nutrition values for the selected date. Other days are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Keep record
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
