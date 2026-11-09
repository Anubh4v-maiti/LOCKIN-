"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Clock,
  Download,
  Globe2,
  Loader2,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { resetWorkspace } from "@/app/actions/account";
import { saveSettings, saveTargets } from "@/app/actions/settings";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/forms/fields";
import { useTheme } from "@/components/theme-provider";
import { DATE_FORMATS, formatDate } from "@/lib/date";
import type { Profile, TargetVersion, ThemePreference } from "@/lib/types";
import { cn } from "@/lib/utils";

type SettingsForm = {
  display_name: string;
  timezone: string;
  date_format: string;
  week_start: number;
  theme: ThemePreference;
  modules: { meals: boolean; study: boolean; habits: boolean; career: boolean; aiInsights: boolean };
  reminder_enabled: boolean;
  reminder_time: string;
  ai_consent: boolean;
};

type TargetForm = {
  effective_from: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  water_ml: string;
  study_minutes: string;
};

function valueOf(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  id,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" /> {title}
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-surface-2/25 p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

export function SettingsPanels({
  profile,
  targetVersions,
  today,
}: {
  profile: Profile;
  targetVersions: TargetVersion[];
  today: string;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const latest = targetVersions[0] ?? null;
  const timezones = React.useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [
        "UTC",
        "Europe/London",
        "Europe/Paris",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Asia/Kolkata",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
      ];
    }
  }, []);

  const [form, setForm] = React.useState<SettingsForm>({
    display_name: profile.display_name ?? "",
    timezone: profile.timezone,
    date_format: profile.date_format,
    week_start: profile.week_start,
    theme: profile.theme,
    modules: { ...profile.modules },
    reminder_enabled: profile.reminder_enabled,
    reminder_time: profile.reminder_time ?? "",
    ai_consent: profile.ai_consent,
  });
  const [settingsPending, setSettingsPending] = React.useState(false);
  const [settingsDirty, setSettingsDirty] = React.useState(false);

  const [targetForm, setTargetForm] = React.useState<TargetForm>({
    effective_from: today,
    calories: valueOf(latest?.calories),
    protein_g: valueOf(latest?.protein_g),
    carbs_g: valueOf(latest?.carbs_g),
    fat_g: valueOf(latest?.fat_g),
    fiber_g: valueOf(latest?.fiber_g),
    water_ml: valueOf(latest?.water_ml),
    study_minutes: valueOf(latest?.study_minutes),
  });
  const [targetPending, setTargetPending] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteText, setDeleteText] = React.useState("");
  const [deletePending, setDeletePending] = React.useState(false);

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSettingsDirty(true);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (settingsPending) return;
    setSettingsPending(true);
    try {
      const result = await saveSettings({
        ...form,
        reminder_time: form.reminder_enabled ? form.reminder_time || null : null,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Settings saved.");
        setSettingsDirty(false);
        router.refresh();
      }
    } catch {
      toast.error("Settings could not be saved.");
    } finally {
      setSettingsPending(false);
    }
  };

  const saveTargetForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (targetPending) return;
    setTargetPending(true);
    try {
      const result = await saveTargets({
        effective_from: targetForm.effective_from,
        calories: targetForm.calories,
        protein_g: targetForm.protein_g,
        carbs_g: targetForm.carbs_g,
        fat_g: targetForm.fat_g,
        fiber_g: targetForm.fiber_g,
        water_ml: targetForm.water_ml,
        study_minutes: targetForm.study_minutes,
      });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Targets saved as a new version.");
        router.refresh();
      }
    } catch {
      toast.error("Targets could not be saved.");
    } finally {
      setTargetPending(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteText !== "RESET LOCAL DATA" || deletePending) return;
    setDeletePending(true);
    try {
      const result = await resetWorkspace({ confirmation: deleteText });
      if (!result.ok) {
        toast.error(result.error);
        setDeletePending(false);
      }
    } catch {
      toast.error("Account deletion failed. Check your connection.");
      setDeletePending(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <form onSubmit={saveProfile} className="space-y-4">
          <Section
            icon={UserRound}
            title="Profile"
            description="Your name and local preferences. No account, email or cloud database is required."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={form.display_name}
                  onChange={(event) => update("display_name", event.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-email">Storage</Label>
                <Input id="account-email" value="This device only" readOnly disabled />
              </div>
            </div>
          </Section>

          <Section
            icon={Globe2}
            title="Time, dates and week"
            description="Your timezone determines today's date, check-ins and streaks. No UTC date slicing is used."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="timezone">IANA timezone</Label>
                <Input
                  id="timezone"
                  list="timezone-options"
                  value={form.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                  placeholder="e.g. Europe/London"
                  required
                />
                <datalist id="timezone-options">
                  {timezones.map((timezone) => (
                    <option key={timezone} value={timezone} />
                  ))}
                </datalist>
                <p className="text-[10px] text-muted-foreground">
                  Example: {formatDate(today, form.date_format as (typeof DATE_FORMATS)[number])} in {form.timezone || "your timezone"}.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date-format">Date format</Label>
                <Select
                  id="date-format"
                  value={form.date_format}
                  onChange={(event) => update("date_format", event.target.value)}
                  options={DATE_FORMATS.map((format) => ({ value: format, label: format }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="week-start">Week starts on</Label>
                <Select
                  id="week-start"
                  value={String(form.week_start)}
                  onChange={(event) => update("week_start", Number(event.target.value))}
                  options={[
                    { value: "1", label: "Monday" },
                    { value: "0", label: "Sunday" },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section
            icon={MonitorSmartphone}
            title="Appearance"
            description="The visual theme is also applied instantly in this browser."
          >
            <div className="flex flex-wrap gap-2">
              {(["dark", "light", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => {
                    update("theme", theme);
                    setTheme(theme);
                  }}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-xs font-medium capitalize transition-colors",
                    form.theme === theme
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </Section>

          <Section
            icon={Target}
            title="Modules"
            description="Hide what you do not use. Turning a module off does not delete its saved data."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleRow
                label="Meal logging"
                description="Optional meal-level detail in addition to daily nutrition totals."
                checked={form.modules.meals}
                onCheckedChange={(checked) => {
                  update("modules", { ...form.modules, meals: checked });
                }}
              />
              <ToggleRow
                label="Study & focus"
                description="Timer, study sessions and study targets."
                checked={form.modules.study}
                onCheckedChange={(checked) => update("modules", { ...form.modules, study: checked })}
              />
              <ToggleRow
                label="Habits & routines"
                description="Scheduled habits and weekly consistency."
                checked={form.modules.habits}
                onCheckedChange={(checked) => update("modules", { ...form.modules, habits: checked })}
              />
              <ToggleRow
                label="Career & skills"
                description="Long-horizon goals and milestones."
                checked={form.modules.career}
                onCheckedChange={(checked) => update("modules", { ...form.modules, career: checked })}
              />
              <ToggleRow
                label="AI narration"
                description="Allow optional AI to rephrase monthly recap statistics. Requires explicit consent below."
                checked={form.modules.aiInsights}
                onCheckedChange={(checked) => update("modules", { ...form.modules, aiInsights: checked })}
              />
            </div>
          </Section>

          <Section
            icon={Clock}
            title="Reminder preference"
            description="LOCKIN stores your preference. This app does not send push notifications by itself."
          >
            <div className="space-y-3">
              <ToggleRow
                label="I want a nightly reminder preference"
                description="A time preference only; it does not schedule browser or email notifications."
                checked={form.reminder_enabled}
                onCheckedChange={(checked) => update("reminder_enabled", checked)}
              />
              {form.reminder_enabled ? (
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-time">Preferred time (24-hour)</Label>
                  <Input
                    id="reminder-time"
                    type="time"
                    value={form.reminder_time}
                    onChange={(event) => update("reminder_time", event.target.value)}
                    required
                    className="w-40"
                  />
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            icon={Bot}
            title="AI consent"
            description="AI is off by default. Statistics are always computed deterministically from saved records."
          >
            <ToggleRow
              label="Allow AI-assisted recap narration"
              description="When both this consent and the AI module are on, the server may send recap statistics and your own recap notes to the configured AI provider. It never receives your email or credentials."
              checked={form.ai_consent}
              onCheckedChange={(checked) => update("ai_consent", checked)}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              The AI provider is configured server-side with an environment variable. If no provider
              is configured, LOCKIN silently uses deterministic narration even with consent on.
            </p>
          </Section>

          <div className="sticky bottom-[76px] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/95 p-3 shadow-xl backdrop-blur lg:bottom-4">
            <p className="text-[10px] text-muted-foreground">
              {settingsDirty ? "You have unsaved settings." : "Settings are up to date."}
            </p>
            <Button type="submit" disabled={settingsPending || !settingsDirty}>
              {settingsPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save settings
            </Button>
          </div>
        </form>

        <Section
          icon={Target}
          title="Targets"
          description="Targets are versioned by effective date. Saving today creates a new version; older dates keep their original target."
          id="targets"
        >
          <form onSubmit={saveTargetForm} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="effective-from">Effective from</Label>
              <Input
                id="effective-from"
                type="date"
                value={targetForm.effective_from}
                onChange={(event) => setTargetForm((current) => ({ ...current, effective_from: event.target.value }))}
                max={today}
                required
                className="w-48"
              />
              <p className="text-[10px] text-muted-foreground">
                Historical dates use the latest target version on or before that date.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <NumberField id="target-calories" label="Calories" value={targetForm.calories} onChange={(value) => setTargetForm((current) => ({ ...current, calories: value }))} unit="kcal" max={20000} />
              <NumberField id="target-protein" label="Protein" value={targetForm.protein_g} onChange={(value) => setTargetForm((current) => ({ ...current, protein_g: value }))} unit="g" max={1000} />
              <NumberField id="target-carbs" label="Carbs" value={targetForm.carbs_g} onChange={(value) => setTargetForm((current) => ({ ...current, carbs_g: value }))} unit="g" max={2000} />
              <NumberField id="target-fat" label="Fat" value={targetForm.fat_g} onChange={(value) => setTargetForm((current) => ({ ...current, fat_g: value }))} unit="g" max={1000} />
              <NumberField id="target-fiber" label="Fiber" value={targetForm.fiber_g} onChange={(value) => setTargetForm((current) => ({ ...current, fiber_g: value }))} unit="g" max={500} />
              <NumberField id="target-water" label="Water" value={targetForm.water_ml} onChange={(value) => setTargetForm((current) => ({ ...current, water_ml: value }))} unit="ml" max={20000} />
              <NumberField id="target-study" label="Study" value={targetForm.study_minutes} onChange={(value) => setTargetForm((current) => ({ ...current, study_minutes: value }))} unit="min" max={1440} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={targetPending}>
                {targetPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save target version
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Leave a field blank to keep that target unconfigured. Blank never becomes zero.
              </p>
            </div>
          </form>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Version history</p>
            {targetVersions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No target versions saved yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {targetVersions.slice(0, 8).map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-2/25 px-3 py-2 text-[10px]">
                    <Badge variant="outline">From {formatDate(version.effective_from, "MMM d, yyyy")}</Badge>
                    <span className="text-muted-foreground">
                      {[
                        version.calories !== null ? `${version.calories} kcal` : null,
                        version.protein_g !== null ? `${version.protein_g}g protein` : null,
                        version.water_ml !== null ? `${(version.water_ml / 1000).toFixed(1)}L water` : null,
                        version.study_minutes !== null ? `${version.study_minutes} min study` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No targets configured"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      </div>

      <aside className="space-y-4">
        <Section
          icon={ShieldCheck}
          title="Privacy & security"
          description="Your data stays on this machine."
        >
          <div className="space-y-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <p>LOCKIN local edition has no account system and makes no database requests to a cloud provider.</p>
            <p>Records are saved in a local JSON file beside the app. Nothing is sent to a cloud database or analytics service.</p>
            <p>The file is readable by your operating-system user only. Keep it private and export a backup regularly.</p>
            <p>Resetting the workspace permanently deletes every local record. Export first if you need a copy.</p>
          </div>
        </Section>

        <Section
          icon={Download}
          title="Your data"
          description="Export everything at any time. No lock-in."
        >
          <div className="flex flex-col gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/export?format=json" download>
                <Download className="size-3.5" /> Download JSON export
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/export?format=csv" download>
                <Download className="size-3.5" /> Download daily CSV
              </a>
            </Button>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              The JSON file includes every table, including habits, career goals, target versions and
              recap revisions.
            </p>
          </div>
        </Section>

        <Section
          icon={Clock}
          title="Local workspace"
          description="This workspace lives only on this machine."
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium">No login required</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                There is no account to sign out of. Keep the project folder and its local data file private.
              </p>
            </div>
            <div className="hairline" />
            <div>
              <p className="text-xs font-medium text-destructive">Reset local data</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Permanently removes every record and returns the workspace to a blank setup. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" /> Reset local data
              </Button>
            </div>
          </div>
        </Section>

        <Section
          icon={Bot}
          title="How AI is used"
          description="Optional, explicit, and limited."
        >
          <ul className="space-y-2 text-[10px] leading-relaxed text-muted-foreground">
            <li>• Off unless both consent and the AI module are enabled.</li>
            <li>• Only deterministic recap statistics and your own recap reflection text are sent.</li>
            <li>• No email, password, session token or raw account identifier is included.</li>
            <li>• Output is validated; any failure falls back to deterministic narration.</li>
            <li>• You can turn it off at any time without affecting saved recaps.</li>
          </ul>
        </Section>

        <div className="rounded-xl border border-border/60 bg-surface-2/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
          LOCKIN is not a medical device. Nutrition, water and study targets are personal
          preferences, not clinical advice.
        </div>

      </aside>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently reset this workspace?</DialogTitle>
            <DialogDescription>
              This deletes your profile and every local record, including saved monthly recaps.
              Export your data first if you want a copy. Type RESET LOCAL DATA to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">Confirmation</Label>
            <Input
              id="delete-confirmation"
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              placeholder="RESET LOCAL DATA"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deletePending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deletePending || deleteText !== "RESET LOCAL DATA"}
            >
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
