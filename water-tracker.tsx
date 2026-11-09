"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Droplets, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { addWater, setWater, undoWater } from "@/app/actions/water";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn, formatMl } from "@/lib/utils";

function WaterVessel({ totalMl, targetMl }: { totalMl: number | null; targetMl: number | null }) {
  const pct = totalMl !== null && targetMl && targetMl > 0 ? Math.min(100, (totalMl / targetMl) * 100) : 0;
  const over = totalMl !== null && targetMl !== null && totalMl > targetMl;
  return (
    <div className="relative mx-auto size-48 shrink-0 sm:size-56" aria-hidden="true">
      <div className="absolute inset-0 rounded-full border border-border/70 bg-surface-2/50" />
      <div className="absolute inset-2 overflow-hidden rounded-full">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--secondary)/0.08),transparent_65%)]" />
        <div
          className={cn("water-fill absolute inset-x-0 bottom-0", over && "bg-gradient-to-t from-[#2f7f66] to-[#7ee7c1]")}
          style={{ height: `${Math.max(pct, totalMl && totalMl > 0 ? 2 : 0)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#23678b] via-[#3b8ca4]/90 to-[#7ee7c1]/70" />
          <svg
            className="water-surface absolute -top-2 left-0 h-4 w-[200%] text-[#7ee7c1]/40"
            viewBox="0 0 800 40"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0 20 Q50 0 100 20 T200 20 T300 20 T400 20 T500 20 T600 20 T700 20 T800 20 V40 H0 Z" />
          </svg>
          <div className="absolute left-[22%] top-[24%] size-1.5 rounded-full bg-white/30" />
          <div className="absolute left-[64%] top-[44%] size-1 rounded-full bg-white/25" />
          <div className="absolute left-[42%] top-[68%] size-1.5 rounded-full bg-white/20" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Droplets className="size-5 text-white/70 drop-shadow" />
          <p className="metric mt-1 text-3xl font-semibold text-white drop-shadow-sm">
            {totalMl === null ? "—" : formatMl(totalMl)}
          </p>
          <p className="text-[10px] font-medium text-white/75">
            {targetMl === null ? "No target set" : `of ${formatMl(targetMl)}`}
          </p>
        </div>
      </div>
      <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/5" />
    </div>
  );
}

export function WaterTracker({
  logDate,
  initialTotal,
  targetMl,
  hasEvents,
  eventCount,
}: {
  logDate: string;
  initialTotal: number | null;
  targetMl: number | null;
  hasEvents: boolean;
  eventCount: number;
}) {
  const [total, setTotal] = React.useState<number | null>(initialTotal);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState("");
  const [setTotalValue, setSetTotalValue] = React.useState(initialTotal !== null ? String(initialTotal) : "");
  const [setOpen, setSetOpen] = React.useState(false);
  const [undoOpen, setUndoOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setTotal(initialTotal);
    setSetTotalValue(initialTotal !== null ? String(initialTotal) : "");
  }, [initialTotal, logDate]);

  const percent = total !== null && targetMl && targetMl > 0 ? (total / targetMl) * 100 : null;
  const remaining = total !== null && targetMl !== null ? targetMl - total : null;

  const runAdd = async (amount: number, label: string) => {
    if (pendingAction) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive amount in millilitres.");
      return;
    }
    setPendingAction(label);
    try {
      const result = await addWater({ log_date: logDate, amount_ml: amount });
      if (!result.ok) toast.error(result.error);
      else {
        setTotal(result.total);
        toast.success(`+${amount} ml · ${formatMl(result.total)} today`);
        router.refresh();
      }
    } catch {
      toast.error("Water could not be saved. Check your connection.");
    } finally {
      setPendingAction(null);
    }
  };

  const runSet = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingAction) return;
    const amount = Number(setTotalValue);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid total.");
      return;
    }
    setPendingAction("set");
    try {
      const result = await setWater({ log_date: logDate, total_ml: Math.round(amount) });
      if (!result.ok) toast.error(result.error);
      else {
        setTotal(result.total);
        setSetOpen(false);
        toast.success("Water total corrected.");
        router.refresh();
      }
    } catch {
      toast.error("The total could not be saved.");
    } finally {
      setPendingAction(null);
    }
  };

  const runUndo = async () => {
    if (pendingAction) return;
    setPendingAction("undo");
    try {
      const result = await undoWater(logDate);
      if (!result.ok) toast.error(result.error);
      else {
        setTotal(result.total);
        setUndoOpen(false);
        toast.success("Last water entry undone.");
        router.refresh();
      }
    } catch {
      toast.error("The last entry could not be undone.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center p-6">
          <WaterVessel totalMl={total} targetMl={targetMl} />
          <div className="mt-5 grid w-full grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Consumed</p>
              <p className="metric mt-0.5 text-sm font-semibold">{total === null ? "—" : formatMl(total)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Target</p>
              <p className="metric mt-0.5 text-sm font-semibold">{targetMl === null ? "—" : formatMl(targetMl)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-2/40 px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Remaining</p>
              <p className="metric mt-0.5 text-sm font-semibold">
                {remaining === null ? "—" : remaining > 0 ? formatMl(remaining) : "Met"}
              </p>
            </div>
          </div>
          {percent !== null ? (
            <div className="mt-4 w-full">
              <Progress value={Math.min(100, percent)} label="Water target progress" />
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                {Math.round(percent)}% of the configured target
                {percent > 100 ? " · above target" : ""}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Set a daily water target in Settings to see progress. No medical target is assumed.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick add</CardTitle>
          <p className="text-xs text-muted-foreground">
            Each tap is one saved, transactional entry. Buttons lock while saving to prevent duplicates.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[150, 250, 500].map((amount) => (
              <Button
                key={amount}
                type="button"
                variant="subtle"
                className="h-14 flex-col gap-0.5"
                disabled={pendingAction !== null}
                onClick={() => void runAdd(amount, String(amount))}
              >
                {pendingAction === String(amount) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <span className="text-base font-semibold tabular-nums">+{amount}</span>
                    <span className="text-[9px] font-normal text-muted-foreground">ml</span>
                  </>
                )}
              </Button>
            ))}
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const amount = Number(custom);
              if (!Number.isFinite(amount) || amount <= 0) {
                toast.error("Enter a custom amount in millilitres.");
                return;
              }
              void runAdd(Math.round(amount), "custom");
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="custom-water">Custom amount (ml)</Label>
              <Input
                id="custom-water"
                type="number"
                min={1}
                max={20000}
                inputMode="numeric"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                placeholder="e.g. 750"
                className="tabular-nums"
                disabled={pendingAction !== null}
              />
            </div>
            <Button type="submit" disabled={pendingAction !== null || !custom}>
              {pendingAction === "custom" ? <Loader2 className="size-4 animate-spin" /> : <Droplets className="size-4" />}
              Add
            </Button>
          </form>

          <div className="hairline" />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSetOpen(true)} disabled={pendingAction !== null}>
              <Save className="size-3.5" /> Correct total
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUndoOpen(true)}
              disabled={pendingAction !== null || !hasEvents}
              title={hasEvents ? "Undo the most recent water entry" : "No water entry to undo"}
            >
              <Undo2 className="size-3.5" /> Undo last
            </Button>
            <span className="ml-auto self-center text-[10px] text-muted-foreground">
              {eventCount} {eventCount === 1 ? "entry" : "entries"} saved for this date
            </span>
          </div>

          <p className="rounded-lg bg-surface-2/50 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
            Water targets are personal preferences, not universal medical recommendations. Adjust
            them with your own circumstances in mind.
          </p>
        </CardContent>
      </Card>

      <Dialog open={setOpen} onOpenChange={setSetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct the daily total</DialogTitle>
            <DialogDescription>
              Enter the final total you want saved for this date. The difference is recorded as a
              correction, not a new addition.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={runSet} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="water-total">Total consumed (ml)</Label>
              <Input
                id="water-total"
                type="number"
                min={0}
                max={30000}
                value={setTotalValue}
                onChange={(event) => setSetTotalValue(event.target.value)}
                className="tabular-nums"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSetOpen(false)} disabled={pendingAction !== null}>
                Cancel
              </Button>
              <Button type="submit" disabled={pendingAction !== null}>
                {pendingAction === "set" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save total
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={undoOpen} onOpenChange={setUndoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo the last water entry?</DialogTitle>
            <DialogDescription>
              This removes the most recent water event for this date and adjusts the total. It cannot
              be undone, but you can add the amount again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoOpen(false)} disabled={pendingAction !== null}>
              Cancel
            </Button>
            <Button onClick={() => void runUndo()} disabled={pendingAction !== null}>
              {pendingAction === "undo" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Undo entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
