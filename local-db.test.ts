import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let db: typeof import("@/lib/local/db");
let client: ReturnType<typeof db.createLocalClient>;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "lockin-local-test-"));
  process.env.LOCKIN_DATA_DIR = tempDir;
  db = await import("@/lib/local/db");
  client = db.createLocalClient();
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("local workspace database", () => {
  it("starts with one profile and no login", async () => {
    const { data: user } = await client.auth.getUser();
    expect(user.user.id).toBe(db.LOCAL_USER_ID);
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", db.LOCAL_USER_ID)
      .maybeSingle();
    expect(profile).toMatchObject({ id: db.LOCAL_USER_ID, onboarded: false });
  });

  it("inserts, filters, orders and updates records", async () => {
    const { data: task, error } = await client
      .from("daily_tasks")
      .insert({
        log_date: "2026-10-23",
        title: "First task",
        category: "study",
        priority: "medium",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(task.id).toBeTruthy();
    expect(task.completed).toBe(false);
    expect(task.user_id).toBe(db.LOCAL_USER_ID);

    await client.from("daily_tasks").insert({
      log_date: "2026-10-23",
      title: "Second task",
      category: "personal",
      priority: "low",
      position: 2,
    });

    const { data: tasks } = await client
      .from("daily_tasks")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID)
      .eq("log_date", "2026-10-23")
      .order("position")
      .order("created_at");
    expect(tasks).toHaveLength(2);

    await client
      .from("daily_tasks")
      .update({ completed: true, completed_at: "2026-10-23T10:00:00.000Z" })
      .eq("id", task.id);
    const { data: updated } = await client
      .from("daily_tasks")
      .select("*")
      .eq("id", task.id)
      .maybeSingle();
    expect(updated.completed).toBe(true);
  });

  it("counts rows without loading them", async () => {
    const { data, count } = await client
      .from("daily_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", db.LOCAL_USER_ID);
    expect(data).toBeNull();
    expect(count).toBe(2);
  });

  it("upserts target history instead of making duplicate rows", async () => {
    await client.from("target_history").upsert(
      {
        user_id: db.LOCAL_USER_ID,
        effective_from: "2026-10-01",
        calories: 2200,
        protein_g: 150,
      },
      { onConflict: "user_id,effective_from" },
    );
    await client.from("target_history").upsert(
      {
        user_id: db.LOCAL_USER_ID,
        effective_from: "2026-10-01",
        calories: 2300,
        protein_g: 160,
      },
      { onConflict: "user_id,effective_from" },
    );
    const { data } = await client
      .from("target_history")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ calories: 2300, protein_g: 160 });
  });

  it("handles water add, set and undo without treating missing as zero", async () => {
    const add = await client.rpc("add_water", {
      p_log_date: "2026-10-23",
      p_amount_ml: 250,
    });
    expect(add.error).toBeNull();
    expect(add.data).toBe(250);

    const set = await client.rpc("set_water", {
      p_log_date: "2026-10-23",
      p_total_ml: 1000,
    });
    expect(set.data).toBe(1000);

    const undo = await client.rpc("undo_water", { p_log_date: "2026-10-23" });
    expect(undo.data).toBe(250);

    const { data: log } = await client
      .from("water_logs")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID)
      .eq("log_date", "2026-10-23")
      .maybeSingle();
    expect(log.total_ml).toBe(250);
  });

  it("saves a complete check-in with only the supplied nutrition values", async () => {
    const result = await client.rpc("save_checkin", {
      p_log_date: "2026-10-24",
      p_complete: true,
      p_use_reflection: true,
      p_rating: 4,
      p_win: "Walked",
      p_mistake: null,
      p_improvement: "Sleep earlier",
      p_notes: "Solid day",
      p_update_nutrition: true,
      p_calories: 1800,
      p_protein: null,
      p_carbs: null,
      p_fat: null,
      p_fiber: null,
      p_update_water: true,
      p_water_ml: 1500,
    });
    expect(result.error).toBeNull();

    const { data: log } = await client
      .from("daily_logs")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID)
      .eq("log_date", "2026-10-24")
      .maybeSingle();
    expect(log.checkin_status).toBe("complete");
    expect(log.completed_at).toBeTruthy();

    const { data: nutrition } = await client
      .from("nutrition_entries")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID)
      .eq("log_date", "2026-10-24")
      .maybeSingle();
    expect(nutrition.calories).toBe(1800);
    expect(nutrition.protein_g).toBeNull();
    expect(nutrition.source).toBe("manual");

    const { data: reflection } = await client
      .from("daily_reflections")
      .select("*")
      .eq("user_id", db.LOCAL_USER_ID)
      .eq("log_date", "2026-10-24")
      .maybeSingle();
    expect(reflection.rating).toBe(4);
    expect(reflection.win).toBe("Walked");
  });

  it("cascades habit completions when a habit is deleted", async () => {
    const { data: habit } = await client
      .from("habits")
      .insert({ name: "Walk", schedule_days: [0, 1, 2, 3, 4, 5, 6] })
      .select("*")
      .single();
    await client.from("habit_completions").insert({
      habit_id: habit.id,
      log_date: "2026-10-23",
      completed: true,
    });
    await client.from("habits").delete().eq("id", habit.id);
    const { data: completions } = await client
      .from("habit_completions")
      .select("*")
      .eq("habit_id", habit.id);
    expect(completions).toHaveLength(0);
  });

  it("persists to the local JSON file", async () => {
    const raw = await readFile(path.join(tempDir, "data.json"), "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.tables.daily_tasks.length).toBe(2);
  });

  it("can reset the workspace without deleting the local profile", async () => {
    await db.resetLocalData();
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", db.LOCAL_USER_ID)
      .maybeSingle();
    expect(profile).toBeTruthy();
    const { count } = await client
      .from("daily_tasks")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });
});
