import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return formatNumber(value, digits);
}

export function formatMl(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(value / 1000).toFixed(2).replace(/\.?0+$/, "")} L`;
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

export function truncate(value: string, length = 80) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function initials(name: string | null | undefined): string {
  const source = (name || "LOCKIN").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "L";
}
