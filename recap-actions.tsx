"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Printer, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateRecapAction, saveRecapAnswers } from "@/app/actions/recap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { RECAP_QUESTIONS } from "@/lib/types";
import type { MonthKey } from "@/lib/date";

export function RecapActions({
  month,
  hasRecap,
  initialAnswers,
  aiEnabled,
  hasData,
}: {
  month: MonthKey;
  hasRecap: boolean;
  initialAnswers: Record<string, string>;
  aiEnabled: boolean;
  hasData: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const question of RECAP_QUESTIONS) initial[question.key] = initialAnswers[question.key] ?? "";
    return initial;
  });
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [answersDirty, setAnswersDirty] = React.useState(false);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generateRecapAction({ month, regenerate: hasRecap });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Recap generated.");
        setGenerateOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("The recap could not be generated.");
    } finally {
      setGenerating(false);
    }
  };

  const saveAnswers = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveRecapAnswers({ month, answers });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Reflection answers saved.");
        setAnswersDirty(false);
        router.refresh();
      }
    } catch {
      toast.error("The answers could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => setGenerateOpen(true)} disabled={generating}>
          {generating ? <Loader2 className="size-3.5 animate-spin" /> : hasRecap ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
          {hasRecap ? "Regenerate recap" : "Generate recap"}
        </Button>
        {hasRecap ? (
          <>
            <Button asChild type="button" size="sm" variant="outline">
              <a href={`/api/recap/${month}/csv`} download>
                <Download className="size-3.5" /> CSV
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print / PDF
            </Button>
          </>
        ) : null}
        <p className="text-[10px] text-muted-foreground">
          {aiEnabled ? "AI narration consent is on." : "Deterministic narration — no AI call."}
        </p>
      </div>

      {!hasRecap ? (
        <div className="rounded-2xl border border-border/70 bg-surface-2/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-primary" /> No saved recap for this month yet.
          </p>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {hasData
              ? "Generate a deterministic recap from the records you already saved. It will be stored and can be regenerated later; previous versions are archived."
              : "There are no saved records for this month. You can still generate a recap, but it will say there is not enough evidence — no values will be invented."}
          </p>
        </div>
      ) : null}

      {hasRecap ? (
        <div className="no-print surface-card p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Optional recap reflection</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                These answers are saved with the recap and used by future recaps only as your own
                notes. They never become statistics.
              </p>
            </div>
            {answersDirty ? <span className="text-[10px] text-warning">Unsaved</span> : null}
          </div>
          <form onSubmit={saveAnswers} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {RECAP_QUESTIONS.map((question) => (
                <div key={question.key} className="space-y-1.5">
                  <Label htmlFor={`recap-${question.key}`}>{question.label}</Label>
                  <Textarea
                    id={`recap-${question.key}`}
                    value={answers[question.key] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAnswers((current) => ({ ...current, [question.key]: value }));
                      setAnswersDirty(true);
                    }}
                    className="min-h-[76px]"
                    maxLength={4000}
                  />
                </div>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={saving || !answersDirty}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save answers
            </Button>
          </form>
        </div>
      ) : null}

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasRecap ? "Regenerate this recap?" : "Generate this recap?"}</DialogTitle>
            <DialogDescription>
              {hasRecap
                ? "The current version will be archived first. Reflection answers you wrote are preserved on the new version."
                : "The recap uses only saved records. Missing data is described as missing, never as zero."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void generate()} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {hasRecap ? "Regenerate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
