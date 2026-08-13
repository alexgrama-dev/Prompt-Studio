import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadEnhancementEvaluation,
  type EnhancementEvaluationDocument,
} from "./evaluation.ts";

export const DOWNSTREAM_AGENTS = ["codex-cli", "claude-code"] as const;
export type DownstreamAgent = (typeof DOWNSTREAM_AGENTS)[number];
export type DownstreamSkipReason =
  | "missing-fixtures"
  | "missing-agent-keys"
  | "no-confirm-spend";

export interface DownstreamFixture {
  id: string;
  caseId: string;
  taskClass: string;
  repoPath: string;
  agent: DownstreamAgent;
  timeoutMs: number;
  successChecks: string[];
}

export interface DownstreamPlan {
  mode: "dry-run" | "live";
  fixtures: DownstreamFixture[];
  promptSources: Array<"generated" | "raw">;
  reportPath?: string;
  caseCount: number;
  maximumCostUsd: number;
  skipReason?: DownstreamSkipReason;
}

const FIXTURE_FILE = /\.json$/i;

export function defaultDownstreamFixtureDirectory(cwd = process.cwd()): string {
  return join(cwd, "evals", "fixtures");
}

export function isDownstreamAgent(value: string): value is DownstreamAgent {
  return (DOWNSTREAM_AGENTS as readonly string[]).includes(value);
}

export function loadDownstreamFixtures(
  fixtureDirectory: string,
): DownstreamFixture[] {
  if (!existsSync(fixtureDirectory)) return [];
  const names = readdirSync(fixtureDirectory)
    .filter((name) => FIXTURE_FILE.test(name))
    .sort();
  const fixtures: DownstreamFixture[] = [];
  for (const name of names) {
    const parsed = parseDownstreamFixtureFile(join(fixtureDirectory, name));
    if (parsed) fixtures.push(parsed);
  }
  return fixtures;
}

export function planDownstreamEvaluation(options: {
  reportPath?: string;
  fixtureDirectory?: string;
  confirmSpend?: boolean;
  document?: EnhancementEvaluationDocument;
}): DownstreamPlan {
  const fixtureDirectory =
    options.fixtureDirectory ?? defaultDownstreamFixtureDirectory();
  const fixtures = loadDownstreamFixtures(fixtureDirectory);
  const promptSources = ["generated", "raw"] as const;
  const report = options.reportPath ? { reportPath: options.reportPath } : {};
  if (fixtures.length === 0) {
    return {
      mode: "dry-run",
      fixtures: [],
      promptSources: [...promptSources],
      ...report,
      caseCount: options.document?.records.length ?? 0,
      maximumCostUsd: 0,
      skipReason: "missing-fixtures",
    };
  }
  if (!options.confirmSpend) {
    return {
      mode: "dry-run",
      fixtures,
      promptSources: [...promptSources],
      ...report,
      caseCount: fixtures.length,
      maximumCostUsd: 0,
      skipReason: "no-confirm-spend",
    };
  }
  return {
    mode: "live",
    fixtures,
    promptSources: [...promptSources],
    ...report,
    caseCount: fixtures.length,
    maximumCostUsd: 0,
  };
}

export async function planDownstreamFromReport(
  reportPath: string,
  options: { fixtureDirectory?: string; confirmSpend?: boolean } = {},
): Promise<DownstreamPlan> {
  const document = await loadEnhancementEvaluation(reportPath);
  return planDownstreamEvaluation({
    reportPath,
    document,
    ...(options.fixtureDirectory
      ? { fixtureDirectory: options.fixtureDirectory }
      : {}),
    ...(options.confirmSpend ? { confirmSpend: true } : {}),
  });
}

function parseDownstreamFixtureFile(
  path: string,
): DownstreamFixture | undefined {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
  return parseDownstreamFixture(value);
}

function parseDownstreamFixture(value: unknown): DownstreamFixture | undefined {
  if (!isObject(value)) return undefined;
  const id = requiredString(value.id);
  const caseId = requiredString(value.caseId);
  const taskClass = requiredString(value.taskClass);
  const repoPath = requiredString(value.repoPath);
  const agent = requiredString(value.agent);
  if (!id || !caseId || !taskClass || !repoPath || !agent) return undefined;
  if (!isDownstreamAgent(agent)) return undefined;
  if (repoPath.startsWith("/") || repoPath.split(/[\\/]/).includes("..")) {
    return undefined;
  }
  if (
    typeof value.timeoutMs !== "number" ||
    !Number.isFinite(value.timeoutMs) ||
    value.timeoutMs <= 0
  ) {
    return undefined;
  }
  if (!Array.isArray(value.successChecks)) return undefined;
  const successChecks = value.successChecks.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  if (successChecks.length === 0) return undefined;
  return {
    id,
    caseId,
    taskClass,
    repoPath,
    agent,
    timeoutMs: value.timeoutMs,
    successChecks,
  };
}

function requiredString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
