import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceNarrativeWithAi } from "@/lib/ai";
import { buildNarrative, computeMonthlyStats } from "@/lib/recap";
import type { RangeData } from "@/lib/queries";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function fallbackNarrative() {
  const empty: RangeData = {
    logs: [],
    reflections: [],
    nutrition: [],
    water: [],
    tasks: [],
    study: [],
    habitCompletions: [],
    meals: [],
  };
  const stats = computeMonthlyStats({
    month: "2026-09",
    today: "2026-10-23",
    weekStartsOn: 1,
    targets: [],
    data: empty,
    habits: [],
  });
  return { stats, fallback: buildNarrative(stats) };
}

function aiResponse(content: unknown) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("optional AI narrative", () => {
  it("does not call a provider without consent", async () => {
    vi.stubEnv("ENABLE_AI_INSIGHTS", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { stats, fallback } = fallbackNarrative();
    const result = await enhanceNarrativeWithAi({
      stats,
      fallback,
      reflections: stats.notes,
      consent: false,
    });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back when the provider is not configured", async () => {
    vi.stubEnv("ENABLE_AI_INSIGHTS", "false");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { stats, fallback } = fallbackNarrative();
    expect(
      await enhanceNarrativeWithAi({ stats, fallback, reflections: stats.notes, consent: true }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed output and sends no account identity", async () => {
    vi.stubEnv("ENABLE_AI_INSIGHTS", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(aiResponse({ summary: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const { stats, fallback } = fallbackNarrative();
    const result = await enhanceNarrativeWithAi({
      stats,
      fallback,
      reflections: stats.notes,
      consent: true,
    });
    expect(result).toBeNull();
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = String(request.body);
    expect(body).not.toContain("@");
    expect(body).not.toContain("password");
    expect(body).not.toContain("token");
  });

  it("fills short AI plans from the deterministic plan and marks the source", async () => {
    vi.stubEnv("ENABLE_AI_INSIGHTS", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      aiResponse({
        summary: "A grounded summary.",
        wins: ["Showed up"],
        obstacles: [{ observed: "No completed check-ins on some days." }],
        plan: {
          continue: ["Keep the check-in"],
          improve: [],
          simplify: ["Keep the routine small"],
          consistency_target: "Aim for eight check-ins.",
          focus: "Make the evening check-in reliable.",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { stats, fallback } = fallbackNarrative();
    const result = await enhanceNarrativeWithAi({
      stats,
      fallback,
      reflections: stats.notes,
      consent: true,
    });
    expect(result?.generated_by).toBe("ai");
    expect(result?.plan.continue).toHaveLength(3);
    expect(result?.plan.improve).toHaveLength(3);
    expect(result?.plan.simplify).toHaveLength(2);
    expect(result?.plan.continue[0]).toBe("Keep the check-in");
    expect(result?.plan.improve).toEqual(fallback.plan.improve.slice(0, 3));
  });
});
