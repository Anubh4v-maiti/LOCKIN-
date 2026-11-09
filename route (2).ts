import { NextResponse, type NextRequest } from "next/server";
import { createLocalClient, LOCAL_USER_ID } from "@/lib/local/db";
import { fetchRecap } from "@/lib/recap-service";
import { recapCsv } from "@/lib/recap";
import { isValidMonthKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const { month } = await params;
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }
  const supabase = createLocalClient();

  try {
    const recap = await fetchRecap(supabase, LOCAL_USER_ID, month);
    if (!recap) return NextResponse.json({ error: "No recap for that month." }, { status: 404 });
    const csv = recapCsv(recap.stats, recap.narrative);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lockin-recap-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
