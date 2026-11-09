import { aiConfigured } from "@/lib/env";
import type { MonthlyNarrative, MonthlyRecapStats } from "@/lib/types";

interface AiInput {
  stats: MonthlyRecapStats;
  fallback: MonthlyNarrative;
  reflections: {
    wins: string[];
    mistakes: string[];
    improvements: string[];
  };
  consent: boolean;
}

const SYSTEM_PROMPT = `You are the evidence-bound analyst inside LOCKIN, a private personal tracking app.
Write a monthly reflection using ONLY the supplied statistics and reflection text.
Rules:
- Never invent a cause, diagnosis, calorie recommendation, medical claim, or event that is not in the data.
- Distinguish observed facts from possible explanations. Label possibilities as "Possible".
- Use calm, direct, non-judgemental language. No shame, no hype.
- Treat missing data as missing, never as zero.
- Denominate averages by recorded days when relevant.
- Keep the plan practical and modest.
Return strict JSON with this shape:
{
  "summary": string,
  "wins": string[] (max 5),
  "obstacles": [{"observed": string, "possible"?: string}] (max 5),
  "plan": {
    "continue": string[] (exactly 3),
    "improve": string[] (exactly 3),
    "simplify": string[] (1-2),
    "consistency_target": string,
    "focus": string
  }
}`;

export async function enhanceNarrativeWithAi(input: AiInput): Promise<MonthlyNarrative | null> {
  if (!input.consent || !aiConfigured()) return null;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const payload = {
    stats: {
      month: input.stats.month,
      elapsed_days: input.stats.elapsed_days,
      total_days: input.stats.total_days,
      checkin_days: input.stats.checkin_days,
      partial_days: input.stats.partial_days,
      nutrition_days: input.stats.nutrition_days,
      water_days: input.stats.water_days,
      planned_tasks: input.stats.planned_tasks,
      completed_tasks: input.stats.completed_tasks,
      task_completion_rate: input.stats.task_completion_rate,
      avg_calories: input.stats.avg_calories,
      avg_protein_g: input.stats.avg_protein_g,
      avg_carbs_g: input.stats.avg_carbs_g,
      avg_fat_g: input.stats.avg_fat_g,
      avg_water_ml: input.stats.avg_water_ml,
      target_met: input.stats.target_met,
      eligible_target_days: input.stats.eligible_target_days,
      longest_streak: input.stats.longest_streak,
      study_minutes: input.stats.study_minutes,
      habit_completion_rate: input.stats.habit_completion_rate,
      strongest_week: input.stats.strongest_week,
      weakest_week: input.stats.weakest_week,
      incomplete_tasks: input.stats.incomplete_tasks,
      previous: input.stats.previous,
      warnings: input.stats.warnings,
    },
    reflections: {
      wins: input.reflections.wins.slice(0, 10),
      mistakes: input.reflections.mistakes.slice(0, 10),
      improvements: input.reflections.improvements.slice(0, 10),
    },
    deterministic_draft: input.fallback,
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!response.ok) {
      console.error("[lockin] AI request failed", response.status);
      return null;
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Partial<MonthlyNarrative>;
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.wins) ||
      !parsed.plan ||
      !Array.isArray(parsed.plan.continue) ||
      !Array.isArray(parsed.plan.improve)
    ) {
      return null;
    }
    const clean = (values: unknown, max: number) =>
      (Array.isArray(values) ? values : [])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .slice(0, max);
    const fill = (values: string[], fallback: string[], target: number): string[] => {
      const merged = [...values];
      for (const item of fallback) {
        if (merged.length >= target) break;
        if (!merged.includes(item)) merged.push(item);
      }
      return merged.slice(0, target);
    };
    const continuePlan = fill(
      clean(parsed.plan.continue, 3),
      input.fallback.plan.continue,
      3,
    );
    const improvePlan = fill(
      clean(parsed.plan.improve, 3),
      input.fallback.plan.improve,
      3,
    );
    const simplifyPlan = fill(
      clean(parsed.plan.simplify, 2),
      input.fallback.plan.simplify,
      2,
    );
    return {
      summary: parsed.summary.slice(0, 4000),
      wins: clean(parsed.wins, 5),
      obstacles: Array.isArray(parsed.obstacles)
        ? parsed.obstacles
            .filter((o) => o && typeof o.observed === "string")
            .slice(0, 5)
            .map((o) => ({
              observed: String(o.observed).slice(0, 1000),
              possible: o.possible ? String(o.possible).slice(0, 1000) : undefined,
            }))
        : input.fallback.obstacles,
      plan: {
        continue: continuePlan,
        improve: improvePlan,
        simplify: simplifyPlan,
        consistency_target: String(parsed.plan.consistency_target ?? input.fallback.plan.consistency_target).slice(0, 1000),
        focus: String(parsed.plan.focus ?? input.fallback.plan.focus).slice(0, 1000),
      },
      generated_by: "ai",
    };
  } catch (error) {
    console.error("[lockin] AI narrative unavailable", error);
    return null;
  }
}
