import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ResearchRoute } from "./research-router.ts";

const MAX_TEXT = 300;
const MAX_LIST = 20;
const MAX_RECORDS_READ = 2_000;

export type RunStatus = "ok" | "failed" | "cancelled";

/**
 * Where a run stopped. A failure at "context7" means research money was already
 * spent, which the enhancement history alone never shows.
 */
export type RunStage =
  | "planning"
  | "context7"
  | "github"
  | "web"
  | "exa"
  | "enhancement"
  | "save";

export interface RunCost {
  planning?: number;
  exa?: number;
  model?: number;
}

export interface RunRecord {
  at: string;
  status: RunStatus;
  stage: RunStage;
  durationMs?: number;
  provider?: string;
  model?: string;
  profileId?: string;
  selfReview?: boolean;
  target?: string;
  researchLevel?: string;
  routes?: ResearchRoute[];
  libraries?: string[];
  sourceCount?: number;
  cost?: RunCost;
  usage?: { inputTokens: number; outputTokens: number };
  promptId?: string;
  /** Provider or validation message. Never the prompt text. */
  error?: string;
}

export interface RunTally {
  total: number;
  ok: number;
  failed: number;
  cancelled: number;
  totalCostUsd: number;
  failuresByStage: Array<{ stage: RunStage; count: number }>;
  topErrors: Array<{ error: string; count: number; lastAt: string }>;
}

export function runLogPath(promptDirectory: string): string {
  return join(promptDirectory, ".feedback", "runs.jsonl");
}

/**
 * Appends one line per enhancement attempt. Logging never fails a run: a write
 * error is swallowed so a full disk cannot lose an enhancement the user paid
 * for.
 */
export async function recordRun(
  promptDirectory: string,
  record: Omit<RunRecord, "at"> & { at?: string },
  now: () => Date = () => new Date(),
): Promise<void> {
  try {
    const safe = sanitizeRun({ ...record, at: record.at ?? now().toISOString() });
    await mkdir(join(promptDirectory, ".feedback"), { recursive: true });
    await appendFile(
      runLogPath(promptDirectory),
      `${JSON.stringify(safe)}\n`,
      "utf8",
    );
  } catch {
    // Observability must never break the thing it observes.
  }
}

export async function listRuns(
  promptDirectory: string,
): Promise<RunRecord[]> {
  let raw: string;
  try {
    raw = await readFile(runLogPath(promptDirectory), "utf8");
  } catch {
    return [];
  }
  const records: RunRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (!isRunRecord(parsed)) continue;
      records.push(sanitizeRun(parsed));
    } catch {
      // A malformed line never blocks the readable remainder of the log.
    }
  }
  return records.slice(-MAX_RECORDS_READ);
}

export function tallyRuns(records: readonly RunRecord[]): RunTally {
  const byStage = new Map<RunStage, number>();
  const byError = new Map<string, { count: number; lastAt: string }>();
  let totalCostUsd = 0;
  let ok = 0;
  let failed = 0;
  let cancelled = 0;

  for (const record of records) {
    if (record.status === "ok") ok += 1;
    else if (record.status === "cancelled") cancelled += 1;
    else failed += 1;

    totalCostUsd +=
      (record.cost?.planning ?? 0) +
      (record.cost?.exa ?? 0) +
      (record.cost?.model ?? 0);

    if (record.status === "failed") {
      byStage.set(record.stage, (byStage.get(record.stage) ?? 0) + 1);
      if (record.error) {
        const entry = byError.get(record.error);
        if (entry) {
          entry.count += 1;
          if (record.at > entry.lastAt) entry.lastAt = record.at;
        } else {
          byError.set(record.error, { count: 1, lastAt: record.at });
        }
      }
    }
  }

  return {
    total: records.length,
    ok,
    failed,
    cancelled,
    totalCostUsd: Math.round(totalCostUsd * 10_000) / 10_000,
    failuresByStage: [...byStage.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((left, right) => right.count - left.count),
    topErrors: [...byError.entries()]
      .map(([error, entry]) => ({ error, ...entry }))
      .sort(
        (left, right) =>
          right.count - left.count || right.lastAt.localeCompare(left.lastAt),
      )
      .slice(0, 10),
  };
}

const RUN_STATUSES = new Set<string>(["ok", "failed", "cancelled"]);
const RUN_STAGES = new Set<string>([
  "planning",
  "context7",
  "github",
  "web",
  "exa",
  "enhancement",
  "save",
]);

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<RunRecord>;
  return (
    typeof record.at === "string" &&
    typeof record.status === "string" &&
    RUN_STATUSES.has(record.status) &&
    typeof record.stage === "string" &&
    RUN_STAGES.has(record.stage)
  );
}

function sanitizeRun(record: RunRecord): RunRecord {
  return {
    at: record.at,
    status: record.status,
    stage: record.stage,
    ...optionalNumber("durationMs", record.durationMs),
    ...optionalText("provider", record.provider),
    ...optionalText("model", record.model),
    ...optionalText("profileId", record.profileId),
    ...(record.selfReview === true ? { selfReview: true } : {}),
    ...optionalText("target", record.target),
    ...optionalText("researchLevel", record.researchLevel),
    ...(record.routes?.length
      ? { routes: record.routes.slice(0, MAX_LIST) }
      : {}),
    ...(record.libraries?.length
      ? {
          libraries: record.libraries
            .slice(0, MAX_LIST)
            .map((item) => item.slice(0, MAX_TEXT)),
        }
      : {}),
    ...optionalNumber("sourceCount", record.sourceCount),
    ...(record.cost && Object.keys(record.cost).length > 0
      ? { cost: record.cost }
      : {}),
    ...(record.usage ? { usage: record.usage } : {}),
    ...optionalText("promptId", record.promptId),
    ...optionalText("error", record.error),
  };
}

function optionalText<K extends string>(
  key: K,
  value: string | undefined,
): Record<K, string> | Record<string, never> {
  const trimmed = value?.trim();
  return trimmed ? ({ [key]: trimmed.slice(0, MAX_TEXT) } as Record<K, string>) : {};
}

function optionalNumber<K extends string>(
  key: K,
  value: number | undefined,
): Record<K, number> | Record<string, never> {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? ({ [key]: Math.round(value) } as Record<K, number>)
    : {};
}
