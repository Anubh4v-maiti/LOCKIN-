import { requireUser } from "@/lib/auth";
import { fetchCareer } from "@/lib/queries";
import { PageHeader } from "@/components/ui/page-header";
import { CareerBoard } from "@/components/career/career-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career & skills" };

export default async function CareerPage() {
  const { supabase, userId, today } = await requireUser();
  const { goals, milestones } = await fetchCareer(supabase, userId);

  return (
    <div>
      <PageHeader
        eyebrow="Career & skills"
        title="Build direction, not just motion."
        description="Long-horizon goals with concrete milestones. Nothing here is auto-completed — progress is yours to record."
      />
      <CareerBoard goals={goals} milestones={milestones} today={today} />
    </div>
  );
}
