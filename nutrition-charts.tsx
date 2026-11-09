"use client";

import * as React from "react";
import { TrendChart, type ChartPoint } from "@/components/charts/charts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ChartSpline } from "lucide-react";

export function NutritionCharts({
  daily,
  weekly,
}: {
  daily: ChartPoint[];
  weekly: ChartPoint[];
}) {
  const [view, setView] = React.useState<"daily" | "weekly">("daily");
  const data = view === "daily" ? daily : weekly;

  if (data.length === 0) {
    return (
      <EmptyState
        icon={ChartSpline}
        title="No nutrition records in this window"
        description="Charts appear only when saved records exist. Missing days are not plotted as zero."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Tabs value={view} onValueChange={(v) => setView(v as "daily" | "weekly")}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <TrendChart
        data={data}
        series={[
          { key: "calories", label: "Calories (kcal)", color: "hsl(var(--chart-lime))" },
          { key: "protein", label: "Protein (g)", color: "hsl(var(--chart-blue))" },
          { key: "carbs", label: "Carbs (g)", color: "hsl(var(--chart-lavender))" },
          { key: "fat", label: "Fat (g)", color: "hsl(var(--chart-amber))" },
        ]}
        height={260}
        ariaLabel={`${view} nutrition trend chart`}
      />
      <p className="mt-2 text-[10px] text-muted-foreground">
        {view === "daily"
          ? "Each point is a saved day. Gaps mean no record — not zero intake."
          : "Weekly points average only the days recorded inside that week."}
      </p>
    </div>
  );
}
