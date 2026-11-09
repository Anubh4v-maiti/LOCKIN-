import { requireUser } from "@/lib/auth";
import { fetchTargetVersions } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsPanels } from "@/components/settings/settings-panels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, userId, profile, today } = await requireUser();
  const targetVersions = await fetchTargetVersions(supabase, userId);

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Make LOCKIN fit your life."
        description="Time zone, targets and modules are personal. Nothing is assumed on your behalf."
      />
      <SettingsPanels profile={profile} targetVersions={targetVersions} today={today} />
    </div>
  );
}
