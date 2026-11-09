"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Coffee, Cookie, Loader2, Moon, Plus, Sun, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { copyMealTotals, deleteMeal, saveMeal } from "@/app/actions/nutrition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { NumberField } from "@/components/forms/fields";
import { sumNullable } from "@/lib/metrics";
import { formatNumber } from "@/lib/utils";
import type { Meal, NutritionEntry } from "@/lib/types";

const MEAL_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Sun },
  dinner: { label: "Dinner", icon: Moon },
  snack: { label: "Snack", icon: Cookie },
} as const;

type MealType = keyof typeof MEAL_META;
type MealForm = {
  meal_type: MealType;
  name: string;
  quantity: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
};

const BLANK: MealForm = {
  meal_type: "breakfast",
  name: "",
  quantity: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
};

function mealToForm(meal: Meal): MealForm {
  return {
    meal_type: meal.meal_type,
    name: meal.name,
    quantity: meal.quantity ?? "",
    calories: meal.calories != null ? String(meal.calories) : "",
    protein_g: meal.protein_g != null ? String(meal.protein_g) : "",
    carbs_g: meal.carbs_g != null ? String(meal.carbs_g) : "",
    fat_g: meal.fat_g != null ? String(meal.fat_g) : "",
    fiber_g: meal.fiber_g != null ? String(meal.fiber_g) : "",
  };
}

export function MealLogger({
  logDate,
  meals,
  entry,
}: {
  logDate: string;
  meals: Meal[];
  entry: NutritionEntry | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Meal | null>(null);
  const [form, setForm] = React.useState<MealForm>(BLANK);
  const [pending, setPending] = React.useState(false);
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Meal | null>(null);
  const router = useRouter();

  const totals = {
    calories: sumNullable(meals.map((m) => m.calories)),
    protein_g: sumNullable(meals.map((m) => m.protein_g)),
    carbs_g: sumNullable(meals.map((m) => m.carbs_g)),
    fat_g: sumNullable(meals.map((m) => m.fat_g)),
    fiber_g: sumNullable(meals.map((m) => m.fiber_g)),
  };

  const set = (key: keyof MealForm) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm(BLANK);
    setOpen(true);
  };

  const openEdit = (meal: Meal) => {
    setEditing(meal);
    setForm(mealToForm(meal));
    setOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const result = await saveMeal({
        id: editing?.id,
        log_date: logDate,
        ...form,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Meal saved.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("The meal could not be saved.");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!deleting || pending) return;
    setPending(true);
    try {
      const result = await deleteMeal(deleting.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Meal deleted.");
        setDeleting(null);
        router.refresh();
      }
    } catch {
      toast.error("The meal could not be deleted.");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await copyMealTotals(logDate);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Meal totals copied.");
        setCopyOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Meal totals could not be copied.");
    } finally {
      setPending(false);
    }
  };

  const grouped = (Object.keys(MEAL_META) as MealType[]).map((type) => ({
    type,
    meals: meals.filter((m) => m.meal_type === type),
  }));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="size-4 text-secondary" /> Optional meal log
          </CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Meal totals are calculated separately and never silently added to your manual totals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meals.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setCopyOpen(true)} disabled={pending}>
              Use meal totals
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={openNew} disabled={pending}>
            <Plus className="size-3.5" /> Add meal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
            No meals logged. This is optional — end-of-day totals are enough.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ type, meals: group }) =>
              group.length ? (
                <div key={type}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {React.createElement(MEAL_META[type].icon, { className: "size-3" })}
                    {MEAL_META[type].label}
                  </p>
                  <div className="divide-y divide-border/50 rounded-xl border border-border/60">
                    {group.map((meal) => (
                      <div key={meal.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{meal.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {meal.quantity ? `${meal.quantity} · ` : ""}
                            {meal.calories != null ? `${formatNumber(meal.calories)} kcal` : "kcal not set"}
                            {meal.protein_g != null ? ` · ${formatNumber(meal.protein_g)}g protein` : ""}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(meal)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(meal)}
                          aria-label={`Delete ${meal.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
              <p className="text-[11px] font-semibold">Meal totals (not automatically added)</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {totals.calories === null ? "—" : `${formatNumber(totals.calories)} kcal`}
                {totals.protein_g !== null ? ` · ${formatNumber(totals.protein_g)}g P` : ""}
                {totals.carbs_g !== null ? ` · ${formatNumber(totals.carbs_g)}g C` : ""}
                {totals.fat_g !== null ? ` · ${formatNumber(totals.fat_g)}g F` : ""}
              </p>
            </div>
            {entry?.source === "manual" ? (
              <p className="text-[10px] text-muted-foreground">
                Your daily record currently uses manually entered totals. Copying meals will replace them
                only after you confirm.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit meal" : "Add a meal"}</DialogTitle>
            <DialogDescription>Meal values are estimates you provide. They are never invented.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="meal-type">Meal</Label>
                <Select
                  id="meal-type"
                  value={form.meal_type}
                  onChange={(event) => set("meal_type")(event.target.value)}
                  options={Object.entries(MEAL_META).map(([value, meta]) => ({ value, label: meta.label }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meal-quantity">Quantity (optional)</Label>
                <Input
                  id="meal-quantity"
                  value={form.quantity}
                  onChange={(event) => set("quantity")(event.target.value)}
                  placeholder="e.g. 1 bowl, 200 g"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meal-name">Food or meal name</Label>
              <Input
                id="meal-name"
                value={form.name}
                onChange={(event) => set("name")(event.target.value)}
                placeholder="e.g. Chicken rice bowl"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField id="meal-calories" label="Calories" unit="kcal" value={form.calories} onChange={set("calories")} />
              <NumberField id="meal-protein" label="Protein" unit="g" value={form.protein_g} onChange={set("protein_g")} />
              <NumberField id="meal-carbs" label="Carbs" unit="g" value={form.carbs_g} onChange={set("carbs_g")} />
              <NumberField id="meal-fat" label="Fat" unit="g" value={form.fat_g} onChange={set("fat_g")} />
              <NumberField id="meal-fiber" label="Fiber" unit="g" value={form.fiber_g} onChange={set("fiber_g")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {editing ? "Save changes" : "Add meal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy meal totals into the daily record?</DialogTitle>
            <DialogDescription>
              The daily total will be replaced with the sum of the logged meals. This is the only
              rule LOCKIN uses — meals are never added on top of manual totals automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void copy()} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Copy totals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>This meal will be removed from this date.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
