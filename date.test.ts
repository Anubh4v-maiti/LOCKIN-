import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayOfWeek,
  eachDate,
  endOfMonthKey,
  formatDate,
  formatMonth,
  hourInTimeZone,
  isValidDateKey,
  isValidMonthKey,
  monthMatrix,
  startOfWeek,
  todayInTimeZone,
} from "@/lib/date";

describe("date keys", () => {
  it("accepts real dates and rejects impossible or malformed dates", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-04-31")).toBe(false);
    expect(isValidDateKey("2026-1-01")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  it("resolves today in the user's IANA timezone rather than UTC", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");
    expect(todayInTimeZone("America/Los_Angeles", instant)).toBe("2025-12-31");
    expect(todayInTimeZone("Asia/Tokyo", instant)).toBe("2026-01-01");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-01-01");
  });

  it("resolves hours in a timezone", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");
    expect(hourInTimeZone("UTC", instant)).toBe(0);
    expect(hourInTimeZone("Asia/Kolkata", instant)).toBe(6);
  });

  it("does calendar math across month and year boundaries", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2025-12", 2)).toBe("2026-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(endOfMonthKey("2024-02")).toBe("2024-02-29");
    expect(endOfMonthKey("2026-02")).toBe("2026-02-28");
  });

  it("starts weeks on the configured day", () => {
    // 2026-10-23 is a Friday.
    expect(dayOfWeek("2026-10-23")).toBe(5);
    expect(startOfWeek("2026-10-23", 1)).toBe("2026-10-19");
    expect(startOfWeek("2026-10-23", 0)).toBe("2026-10-18");
  });

  it("fills complete calendar weeks with seven dates per row", () => {
    const matrix = monthMatrix("2026-02", 1);
    expect(matrix).toHaveLength(5);
    expect(matrix.every((week) => week.length === 7)).toBe(true);
    expect(matrix[0][0]).toBe("2026-01-26");
    expect(matrix.flat()).toContain("2026-02-01");
    expect(matrix.flat()).toContain("2026-02-28");
  });

  it("formats dates without timezone drift", () => {
    expect(formatDate("2026-10-23", "MMM d, yyyy")).toBe("Oct 23, 2026");
    expect(formatDate("2026-10-23", "MMM d")).toBe("Oct 23");
    expect(formatDate("2026-01-01", "dd/MM/yyyy")).toBe("01/01/2026");
    expect(formatMonth("2026-10")).toBe("October 2026");
  });

  it("validates month keys and guards huge ranges", () => {
    expect(isValidMonthKey("2026-10")).toBe(true);
    expect(isValidMonthKey("2026-00")).toBe(false);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(eachDate("2026-10-01", "2026-10-05")).toHaveLength(5);
    expect(eachDate("2026-10-01", "2026-10-05", 2)).toEqual([]);
  });
});
