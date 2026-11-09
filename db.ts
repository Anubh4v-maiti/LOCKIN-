import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_MODULES } from "@/lib/types";

/**
 * LOCKIN local edition.
 *
 * This is deliberately a server-local JSON database rather than a cloud
 * service. It has no accounts, no network database and no service-role key.
 * The file lives beside the running app unless LOCKIN_DATA_DIR is set.
 */

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_EMAIL = "local@lockin.invalid";
export const LOCAL_DATA_DIR =
  process.env.LOCKIN_DATA_DIR?.trim() || path.join(process.cwd(), ".lockin-data");
export const LOCAL_DATA_PATH = path.join(LOCAL_DATA_DIR, "data.json");

type Row = Record<string, any>;
type TableName = string;

interface LocalData {
  version: 1;
  user: { id: string; email: string; created_at: string };
  tables: Record<TableName, Row[]>;
}

const UPDATED_TABLES = new Set([
  "profiles",
  "daily_logs",
  "daily_reflections",
  "nutrition_entries",
  "meals",
  "water_logs",
  "daily_tasks",
  "habits",
  "habit_completions",
  "focus_sessions",
  "career_goals",
  "monthly_recaps",
]);

const UNIQUE_KEYS: Record<string, string[][]> = {
  profiles: [["id"]],
  daily_logs: [["user_id", "log_date"]],
  daily_reflections: [["user_id", "log_date"]],
  nutrition_entries: [["user_id", "log_date"]],
  water_logs: [["user_id", "log_date"]],
  habit_completions: [["habit_id", "log_date"]],
  target_history: [["user_id", "effective_from"]],
  monthly_recaps: [["user_id", "month"]],
};

function now() {
  return new Date().toISOString();
}

function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const NULL_NUTRITION = {
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fiber_g: null,
};

function defaultsFor(table: TableName): Row {
  const stamp = now();
  switch (table) {
    case "profiles":
      return {
        id: LOCAL_USER_ID,
        display_name: "You",
        timezone: systemTimeZone(),
        date_format: "MMM d, yyyy",
        week_start: 1,
        theme: "dark",
        modules: { ...DEFAULT_MODULES },
        reminder_enabled: false,
        reminder_time: null,
        onboarded: false,
        ai_consent: false,
        created_at: stamp,
        updated_at: stamp,
      };
    case "daily_logs":
      return {
        checkin_status: "partial",
        completed_at: null,
        notes: null,
        created_at: stamp,
        updated_at: stamp,
      };
    case "daily_reflections":
      return {
        rating: null,
        win: null,
        mistake: null,
        improvement: null,
        created_at: stamp,
        updated_at: stamp,
      };
    case "nutrition_entries":
      return {
        ...NULL_NUTRITION,
        notes: null,
        source: "manual",
        created_at: stamp,
        updated_at: stamp,
      };
    case "meals":
      return {
        quantity: null,
        ...NULL_NUTRITION,
        created_at: stamp,
        updated_at: stamp,
      };
    case "water_logs":
      return { total_ml: 0, created_at: stamp, updated_at: stamp };
    case "water_events":
      return { created_at: stamp };
    case "daily_tasks":
      return {
        description: null,
        category: "other",
        priority: "medium",
        completed: false,
        position: 0,
        due_at: null,
        reminder_at: null,
        completed_at: null,
        created_at: stamp,
        updated_at: stamp,
      };
    case "reusable_task_templates":
      return {
        description: null,
        category: "other",
        priority: "medium",
        position: 0,
        archived: false,
        created_at: stamp,
      };
    case "habits":
      return {
        description: null,
        color: "#C5F467",
        schedule_days: [0, 1, 2, 3, 4, 5, 6],
        target_per_week: null,
        active: true,
        created_at: stamp,
        archived_at: null,
      };
    case "habit_completions":
      return { completed: true, note: null, created_at: stamp, updated_at: stamp };
    case "study_sessions":
      return {
        topic: null,
        planned_minutes: null,
        distractions: null,
        notes: null,
        source: "manual",
        started_at: null,
        ended_at: null,
        created_at: stamp,
      };
    case "focus_sessions":
      return {
        topic: null,
        ended_at: null,
        paused_at: null,
        accumulated_seconds: 0,
        status: "running",
        created_at: stamp,
        updated_at: stamp,
      };
    case "career_goals":
      return {
        category: null,
        status: "planned",
        target_date: null,
        progress: 0,
        notes: null,
        resource_url: null,
        completed_at: null,
        created_at: stamp,
        updated_at: stamp,
      };
    case "career_milestones":
      return {
        due_date: null,
        completed: false,
        completed_at: null,
        position: 0,
        created_at: stamp,
      };
    case "target_history":
      return {
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        fiber_g: null,
        water_ml: null,
        study_minutes: null,
        created_at: stamp,
      };
    case "monthly_recaps":
      return {
        stats: {},
        narrative: {},
        reflection_answers: {},
        ai_generated: false,
        generated_at: stamp,
        updated_at: stamp,
      };
    case "monthly_recap_revisions":
      return {
        stats: {},
        narrative: {},
        reflection_answers: {},
        generated_at: stamp,
        archived_at: stamp,
      };
    default:
      return {};
  }
}

const TABLE_NAMES: TableName[] = [
  "profiles",
  "daily_logs",
  "daily_reflections",
  "nutrition_entries",
  "meals",
  "water_logs",
  "water_events",
  "daily_tasks",
  "reusable_task_templates",
  "habits",
  "habit_completions",
  "study_sessions",
  "focus_sessions",
  "career_goals",
  "career_milestones",
  "target_history",
  "monthly_recaps",
  "monthly_recap_revisions",
];

function initialData(): LocalData {
  const stamp = now();
  const tables: Record<TableName, Row[]> = {};
  for (const table of TABLE_NAMES) tables[table] = [];
  tables.profiles.push(defaultsFor("profiles"));
  return {
    version: 1,
    user: { id: LOCAL_USER_ID, email: LOCAL_EMAIL, created_at: stamp },
    tables,
  };
}

let state: LocalData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function persist() {
  if (!state) return;
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await mkdir(LOCAL_DATA_DIR, { recursive: true });
      const temp = `${LOCAL_DATA_PATH}.${process.pid}.tmp`;
      await writeFile(temp, snapshot, { encoding: "utf8", mode: 0o600 });
      await rename(temp, LOCAL_DATA_PATH);
    });
  return writeQueue;
}

function ensureShape(input: unknown): LocalData {
  const value = input as Partial<LocalData> | null;
  if (!value || value.version !== 1 || !value.tables || typeof value.tables !== "object") {
    throw new Error("The local data file has an unsupported shape.");
  }
  const base = initialData();
  const tables: Record<TableName, Row[]> = { ...base.tables };
  for (const table of TABLE_NAMES) {
    tables[table] = Array.isArray(value.tables[table]) ? value.tables[table] : [];
  }
  if (!tables.profiles.length) {
    tables.profiles.push(defaultsFor("profiles"));
  }
  return {
    version: 1,
    user: value.user?.id ? value.user : base.user,
    tables,
  };
}

async function ensureState(): Promise<LocalData> {
  if (state) return state;
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(LOCAL_DATA_PATH, "utf8");
    state = ensureShape(JSON.parse(raw));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      // Never silently discard unreadable data. Keep a copy next to the file.
      try {
        const raw = await readFile(LOCAL_DATA_PATH, "utf8");
        await writeFile(`${LOCAL_DATA_PATH}.corrupt-${Date.now()}`, raw, { encoding: "utf8", mode: 0o600 });
      } catch {
        // The original could not be read; the fresh file below is the fallback.
      }
      console.error("[lockin] local data could not be read; starting a fresh workspace", error);
    }
    state = initialData();
    await persist();
  }
  return state;
}

async function read<T>(fn: (data: LocalData) => T): Promise<T> {
  return fn(await ensureState());
}

async function mutate<T>(fn: (data: LocalData) => T): Promise<T> {
  const data = await ensureState();
  const backup = structuredClone(data);
  try {
    const result = fn(data);
    await persist();
    return result;
  } catch (error) {
    state = backup;
    throw error;
  }
}

function cleanObject(input: Row): Row {
  return Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value !== undefined));
}

function makeRow(table: TableName, input: Row): Row {
  const row = { ...defaultsFor(table), ...cleanObject(input) };
  if (!row.id) row.id = table === "profiles" ? LOCAL_USER_ID : randomUUID();
  if (table !== "profiles" && !row.user_id) row.user_id = LOCAL_USER_ID;
  if (table === "profiles" && !row.id) row.id = LOCAL_USER_ID;
  return row;
}

function sameValue(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.column];
    switch (filter.op) {
      case "eq":
        return sameValue(value, filter.value);
      case "in":
        return Array.isArray(filter.value) && filter.value.some((item) => sameValue(value, item));
      case "gte":
        return value !== null && value !== undefined && value >= filter.value;
      case "lte":
        return value !== null && value !== undefined && value <= filter.value;
      default:
        return true;
    }
  });
}

function checkUnique(table: TableName, rows: Row[], candidate: Row, ignoreId?: string) {
  for (const keySet of UNIQUE_KEYS[table] ?? []) {
    if (keySet.every((key) => candidate[key] === undefined || candidate[key] === null)) continue;
    const duplicate = rows.find(
      (row) =>
        row.id !== ignoreId &&
        keySet.every((key) => sameValue(row[key], candidate[key])),
    );
    if (duplicate) {
      throw new Error(`A record with this ${keySet.join(" + ")} already exists.`);
    }
  }
}

function sortRows(rows: Row[], orders: Order[]): Row[] {
  if (!orders.length) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const av = a[order.column];
      const bv = b[order.column];
      if (sameValue(av, bv)) continue;
      if (av === null || av === undefined) return order.ascending ? -1 : 1;
      if (bv === null || bv === undefined) return order.ascending ? 1 : -1;
      if (av < bv) return order.ascending ? -1 : 1;
      if (av > bv) return order.ascending ? 1 : -1;
    }
    return 0;
  });
}

type Filter = { op: "eq" | "in" | "gte" | "lte"; column: string; value: any };
type Order = { column: string; ascending: boolean };
type Mode = "select" | "insert" | "update" | "upsert" | "delete";

interface QueryOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

class LocalQuery implements PromiseLike<{ data: any; error: { message: string } | null; count?: number | null }> {
  private mode: Mode = "select";
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private payload: Row | Row[] | null = null;
  private returning = false;
  private conflict: string | null = null;
  private options: QueryOptions = {};

  constructor(private readonly table: TableName) {}

  select(_columns = "*", options: QueryOptions = {}) {
    if (this.mode === "select") {
      this.options = options;
    } else {
      this.returning = true;
    }
    return this;
  }

  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options: { onConflict?: string } = {}) {
    this.mode = "upsert";
    this.payload = payload;
    this.conflict = options.onConflict ?? null;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: { message: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      return await mutate((data) => {
        const rows = data.tables[this.table] ?? (data.tables[this.table] = []);
        if (this.mode === "select") {
          return this.runSelect(rows);
        }
        if (this.mode === "insert") {
          const inserted = this.runInsert(rows);
          return this.shape(inserted, null);
        }
        if (this.mode === "update") {
          const updated = this.runUpdate(rows);
          return this.shape(updated, null);
        }
        if (this.mode === "upsert") {
          const upserted = this.runUpsert(rows);
          return this.shape(upserted, null);
        }
        this.runDelete(data, rows);
        return this.shape([], null);
      });
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  }

  private runSelect(rows: Row[]) {
    const filtered = sortRows(rows.filter((row) => matches(row, this.filters)), this.orders);
    const count = filtered.length;
    let selected = filtered;
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      selected = selected.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.limitCount !== null) selected = selected.slice(0, this.limitCount);
    const data = this.options.head ? null : this.narrow(selected);
    return this.finish(data, count);
  }

  private runInsert(rows: Row[]) {
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const inserted: Row[] = [];
    for (const input of inputs) {
      const row = makeRow(this.table, input);
      checkUnique(this.table, rows, row);
      rows.push(row);
      inserted.push(row);
    }
    return inserted;
  }

  private runUpdate(rows: Row[]) {
    const patch = cleanObject((this.payload ?? {}) as Row);
    const updated: Row[] = [];
    for (const row of rows) {
      if (!matches(row, this.filters)) continue;
      Object.assign(row, patch);
      if (UPDATED_TABLES.has(this.table)) row.updated_at = now();
      updated.push(row);
    }
    return updated;
  }

  private runUpsert(rows: Row[]) {
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const result: Row[] = [];
    for (const input of inputs) {
      const candidate = makeRow(this.table, input);
      const keys = this.conflict
        ? this.conflict.split(",").map((key) => key.trim())
        : ["id"];
      const existing = rows.find((row) => keys.every((key) => sameValue(row[key], candidate[key])));
      if (existing) {
        Object.assign(existing, cleanObject(input));
        if (UPDATED_TABLES.has(this.table)) existing.updated_at = now();
        result.push(existing);
      } else {
        checkUnique(this.table, rows, candidate);
        rows.push(candidate);
        result.push(candidate);
      }
    }
    return result;
  }

  private runDelete(data: LocalData, rows: Row[]) {
    const removing = rows.filter((row) => matches(row, this.filters));
    const ids = new Set(removing.map((row) => row.id));
    data.tables[this.table] = rows.filter((row) => !ids.has(row.id));
    if (this.table === "habits") {
      data.tables.habit_completions = data.tables.habit_completions.filter(
        (row) => !ids.has(row.habit_id),
      );
    }
    if (this.table === "career_goals") {
      data.tables.career_milestones = data.tables.career_milestones.filter(
        (row) => !ids.has(row.goal_id),
      );
    }
  }

  private narrow(rows: Row[]) {
    return rows.map((row) => structuredClone(row));
  }

  private finish(data: any, count: number) {
    if (this.singleMode === "single") {
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error("Expected exactly one record.");
      }
      return { data: data[0], error: null, count: this.options.count ? count : null };
    }
    if (this.singleMode === "maybe") {
      if (!Array.isArray(data) || data.length === 0) {
        return { data: null, error: null, count: this.options.count ? count : null };
      }
      if (data.length > 1) throw new Error("Expected zero or one record.");
      return { data: data[0], error: null, count: this.options.count ? count : null };
    }
    return { data, error: null, count: this.options.count ? count : null };
  }

  private shape(rows: Row[], count: number | null) {
    const data = this.returning ? rows.map((row) => structuredClone(row)) : null;
    return this.finish(data, count ?? 0);
  }
}

export interface LocalClient {
  from(table: string): any;
  rpc(name: string, args?: Row): Promise<{ data: any; error: { message: string } | null }>;
  auth: {
    getUser(): Promise<{ data: { user: { id: string; email: string } }; error: null }>;
    signOut(): Promise<{ error: null }>;
  };
}

function eventRow(logDate: string, amount: number, result: number, kind: "add" | "set"): Row {
  return {
    id: randomUUID(),
    user_id: LOCAL_USER_ID,
    log_date: logDate,
    amount_ml: amount,
    result_ml: result,
    kind,
    created_at: now(),
  };
}

async function executeRpc(name: string, args: Row = {}) {
  try {
    const data = await mutate((db) => {
      switch (name) {
        case "add_water": {
          const amount = Number(args.p_amount_ml);
          if (!Number.isFinite(amount) || amount <= 0 || amount > 20000) {
            throw new Error("Invalid water amount.");
          }
          const existing = db.tables.water_logs.find(
            (row) => row.user_id === LOCAL_USER_ID && row.log_date === args.p_log_date,
          );
          if (existing) {
            existing.total_ml += amount;
            existing.updated_at = now();
            db.tables.water_events.push(eventRow(args.p_log_date, amount, existing.total_ml, "add"));
            return existing.total_ml;
          }
          const row = makeRow("water_logs", {
            log_date: args.p_log_date,
            total_ml: amount,
          });
          db.tables.water_logs.push(row);
          db.tables.water_events.push(eventRow(args.p_log_date, amount, row.total_ml, "add"));
          return row.total_ml;
        }
        case "set_water": {
          const total = Number(args.p_total_ml);
          if (!Number.isFinite(total) || total < 0 || total > 30000) {
            throw new Error("Invalid water total.");
          }
          const existing = db.tables.water_logs.find(
            (row) => row.user_id === LOCAL_USER_ID && row.log_date === args.p_log_date,
          );
          const old = existing?.total_ml ?? 0;
          if (existing) {
            existing.total_ml = total;
            existing.updated_at = now();
          } else {
            db.tables.water_logs.push(makeRow("water_logs", { log_date: args.p_log_date, total_ml: total }));
          }
          if (old !== total) {
            db.tables.water_events.push(eventRow(args.p_log_date, total - old, total, "set"));
          }
          return total;
        }
        case "undo_water": {
          const events = db.tables.water_events.filter(
            (row) => row.user_id === LOCAL_USER_ID && row.log_date === args.p_log_date,
          );
          const event = events[events.length - 1];
          const existing = db.tables.water_logs.find(
            (row) => row.user_id === LOCAL_USER_ID && row.log_date === args.p_log_date,
          );
          if (!event) return existing?.total_ml ?? 0;
          db.tables.water_events = db.tables.water_events.filter((row) => row.id !== event.id);
          if (existing) {
            existing.total_ml = Math.max(0, existing.total_ml - event.amount_ml);
            existing.updated_at = now();
            return existing.total_ml;
          }
          return 0;
        }
        case "reorder_tasks": {
          const ids = Array.isArray(args.p_ids) ? args.p_ids : [];
          ids.forEach((id: string, index: number) => {
            const row = db.tables.daily_tasks.find(
              (task) => task.id === id && task.user_id === LOCAL_USER_ID && task.log_date === args.p_log_date,
            );
            if (row) {
              row.position = index;
              row.updated_at = now();
            }
          });
          return null;
        }
        case "save_checkin": {
          const logDate = args.p_log_date;
          const complete = Boolean(args.p_complete);
          let log = db.tables.daily_logs.find(
            (row) => row.user_id === LOCAL_USER_ID && row.log_date === logDate,
          );
          if (!log) {
            log = makeRow("daily_logs", {
              log_date: logDate,
              checkin_status: complete ? "complete" : "partial",
              completed_at: complete ? now() : null,
              notes: args.p_use_reflection ? args.p_notes : null,
            });
            db.tables.daily_logs.push(log);
          } else {
            if (complete) {
              log.checkin_status = "complete";
              log.completed_at = log.completed_at ?? now();
            }
            if (args.p_use_reflection) log.notes = args.p_notes;
            log.updated_at = now();
          }

          if (args.p_use_reflection) {
            const reflection = db.tables.daily_reflections.find(
              (row) => row.user_id === LOCAL_USER_ID && row.log_date === logDate,
            );
            const values = {
              rating: args.p_rating,
              win: args.p_win,
              mistake: args.p_mistake,
              improvement: args.p_improvement,
            };
            if (reflection) {
              Object.assign(reflection, values);
              reflection.updated_at = now();
            } else {
              db.tables.daily_reflections.push(
                makeRow("daily_reflections", { log_date: logDate, ...values }),
              );
            }
          }

          const nutritionValues = [args.p_calories, args.p_protein, args.p_carbs, args.p_fat, args.p_fiber];
          if (args.p_update_nutrition && nutritionValues.some((value) => value !== null && value !== undefined)) {
            const nutrition = db.tables.nutrition_entries.find(
              (row) => row.user_id === LOCAL_USER_ID && row.log_date === logDate,
            );
            const values = {
              calories: args.p_calories ?? null,
              protein_g: args.p_protein ?? null,
              carbs_g: args.p_carbs ?? null,
              fat_g: args.p_fat ?? null,
              fiber_g: args.p_fiber ?? null,
              source: "manual",
            };
            if (nutrition) {
              Object.assign(nutrition, values);
              nutrition.updated_at = now();
            } else {
              db.tables.nutrition_entries.push(
                makeRow("nutrition_entries", { log_date: logDate, ...values }),
              );
            }
          }

          if (args.p_update_water && args.p_water_ml !== null && args.p_water_ml !== undefined) {
            const total = Number(args.p_water_ml);
            const water = db.tables.water_logs.find(
              (row) => row.user_id === LOCAL_USER_ID && row.log_date === logDate,
            );
            const old = water?.total_ml ?? 0;
            if (water) {
              water.total_ml = total;
              water.updated_at = now();
            } else {
              db.tables.water_logs.push(makeRow("water_logs", { log_date: logDate, total_ml: total }));
            }
            if (old !== total) {
              db.tables.water_events.push(eventRow(logDate, total - old, total, "set"));
            }
          }
          return { log_date: logDate, complete };
        }
        case "delete_my_account": {
          const fresh = initialData();
          db.user = fresh.user;
          db.tables = fresh.tables;
          return null;
        }
        default:
          throw new Error(`Unknown local database function: ${name}`);
      }
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }
}

export function createLocalClient(): LocalClient {
  return {
    from(table: string) {
      return new LocalQuery(table);
    },
    rpc(name: string, args: Row = {}) {
      return executeRpc(name, args);
    },
    auth: {
      async getUser() {
        return {
          data: { user: { id: LOCAL_USER_ID, email: LOCAL_EMAIL } },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}

export async function resetLocalData(): Promise<void> {
  state = initialData();
  await persist();
}

export async function getLocalDataSnapshot(): Promise<LocalData> {
  return structuredClone(await ensureState());
}

export async function getLocalDataPath(): Promise<string> {
  await ensureState();
  return LOCAL_DATA_PATH;
}
