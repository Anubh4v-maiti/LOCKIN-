"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatMl, formatNumber } from "@/lib/utils";

export interface Series {
  key: string;
  label: string;
  color: string;
  type?: "area" | "line";
}

export interface ChartPoint {
  label: string;
  [key: string]: string | number | null;
}

export type ChartValueFormat = "percent" | "score" | "kcal" | "water";
export type ChartTickFormat = "percent" | "liters";

function formatChartValue(value: number, format: ChartValueFormat | undefined, unit?: string) {
  switch (format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "score":
      return `${Math.round(value)}/100`;
    case "kcal":
      return `${formatNumber(value)} kcal`;
    case "water":
      return formatMl(value);
    default:
      return `${formatNumber(value)}${unit ?? ""}`;
  }
}

function formatChartTick(value: number, format: ChartTickFormat | undefined) {
  switch (format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "liters":
      return `${Math.round(value / 1000)}L`;
    default:
      return `${value}`;
  }
}

const AXIS_STYLE = {
  fontSize: 10,
  fill: "hsl(var(--muted-foreground))",
  fontFamily: "var(--font-manrope)",
};

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  valueFormat,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string;
  unit?: string;
  valueFormat?: ChartValueFormat;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-2xl">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <div className="space-y-0.5">
        {payload.map((entry, index) => {
          const value = typeof entry.value === "number" ? entry.value : Number(entry.value);
          return (
            <div key={`${entry.dataKey}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: entry.color }} />
                {entry.name}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {Number.isFinite(value)
                  ? formatChartValue(value, valueFormat, unit)
                  : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendContent({
  payload,
}: {
  payload?: { value?: string; color?: string }[];
}) {
  if (!payload?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
      {payload.map((entry, index) => (
        <span key={`${entry.value}-${index}`} className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

export function TrendChart({
  data,
  series,
  height = 220,
  unit,
  variant = "area",
  valueFormat,
  ariaLabel,
  yTickFormat,
  className,
}: {
  data: ChartPoint[];
  series: Series[];
  height?: number;
  unit?: string;
  variant?: "area" | "line";
  valueFormat?: ChartValueFormat;
  ariaLabel: string;
  yTickFormat?: ChartTickFormat;
  className?: string;
}) {
  const Chart = variant === "line" ? LineChart : AreaChart;
  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
            dy={6}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={yTickFormat ? (value: number) => formatChartTick(value, yTickFormat) : undefined}
          />
          <Tooltip
            content={<ChartTooltip unit={unit} valueFormat={valueFormat} />}
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
          />
          <Legend content={<LegendContent />} />
          {series.map((s) =>
            variant === "line" ? (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 2, strokeWidth: 0, fill: s.color }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ) : (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                connectNulls={false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrendChart({
  data,
  series,
  height = 220,
  unit,
  valueFormat,
  ariaLabel,
  yTickFormat,
  className,
}: {
  data: ChartPoint[];
  series: Series[];
  height?: number;
  unit?: string;
  valueFormat?: ChartValueFormat;
  ariaLabel: string;
  yTickFormat?: ChartTickFormat;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
            dy={6}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={yTickFormat ? (value: number) => formatChartTick(value, yTickFormat) : undefined}
          />
          <Tooltip
            content={<ChartTooltip unit={unit} valueFormat={valueFormat} />}
            cursor={{ fill: "hsl(var(--surface-2))", opacity: 0.5 }}
          />
          <Legend content={<LegendContent />} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={34}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
