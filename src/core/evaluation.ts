import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import evaluationCases from "../../evals/cases.json" with { type: "json" };
import extendedEvaluationCases from "../../evals/cases-extended.json" with { type: "json" };
import { ANTHROPIC_PRIVACY_DISCLOSURE_VERSION } from "./anthropic-enhancement.ts";
import { dispatchEnhancement } from "./enhancement-dispatch.ts";
import {
  ENHANCEMENT_COMPILER_VERSION,
  ENHANCEMENT_OUTPUT_SCHEMA_VERSION,
  PRIVACY_DISCLOSURE_VERSION,
  validateEnhancementResult,
  type EnhancementRequest,
  type EnhancementResult,
  type EnhancementRunProfile,
} from "./enhancement.ts";
import { GOOGLE_PRIVACY_DISCLOSURE_VERSION } from "./google-enhancement.ts";
import {
  estimatedProviderMaximumCostUsd,
  getProviderEnhancementProfile,
  providerPrivacyDisclosure,
  type SelectableEnhancementProfileId,
} from "./provider-profiles.ts";
import type { PromptTarget } from "./prompt-store.ts";
import { containsLikelySecret } from "./secrets.ts";

export type EvaluationSplit = "development" | "validation" | "protected";

export interface EnhancementEvaluationCase {
  id: string;
  split: EvaluationSplit;
  category: string;
  target: PromptTarget;
  projectAware: boolean;
  roughInput: string;
  projectContext?: {
    name: string;
    files: string[];
  };
  requiredFacts: string[];
  prohibitedInventions: string[];
  taskClass?: string;
  mustContain?: string[];
  mustNotContain?: string[];
}

export interface EvaluationSelection {
  split?: EvaluationSplit;
  caseIds?: string[];
  limit?: number;
  corpus?: "frozen" | "all";
  repeats?: number;
}

export interface EnhancementEvaluationPlan {
  profile: EnhancementRunProfile;
  cases: EnhancementEvaluationCase[];
  repeats: number;
  maximumCostUsd: number;
  privacyDisclosure: string;
}

export interface EvaluationProgress {
  completed: number;
  total: number;
  caseId: string;
  generationIndex: number;
  state: "running" | "completed" | "failed";
}

export interface RunEnhancementEvaluationOptions {
  profileId: SelectableEnhancementProfileId;
  apiKey: string;
  confirmedMaximumUsd: number;
  selection?: EvaluationSelection;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  outputDirectory?: string;
  onProgress?: (progress: EvaluationProgress) => void;
}

export interface EnhancementEvaluationRun {
  path: string;
  status:
    | "awaiting-human-review"
    | "human-review-complete"
    | "incomplete"
    | "cancelled";
  caseCount: number;
  repeats: number;
  generationCount: number;
  completedCount: number;
  failedCount: number;
  actualCostUsd: number;
  maximumCostUsd: number;
  startedAt: string;
  completedAt: string;
}

export const HUMAN_REVIEW_SCORE_MAXIMUMS = {
  fidelity: 25,
  completeness: 20,
  unsupportedFacts: 20,
  actionability: 15,
  validation: 10,
  authorization: 5,
  appropriateLength: 5,
} as const;

export interface EnhancementHumanReviewInput {
  fidelity: number;
  completeness: number;
  unsupportedFacts: number;
  actionability: number;
  validation: number;
  authorization: number;
  appropriateLength: number;
  hardFailure: boolean;
  notes: string;
}

export interface EnhancementHumanReview {
  status: "pending" | "reviewed";
  fidelity: number | null;
  completeness: number | null;
  unsupportedFacts: number | null;
  actionability: number | null;
  validation: number | null;
  authorization: number | null;
  appropriateLength: number | null;
  hardFailure: boolean | null;
  notes: string;
  reviewedAt?: string;
}

export interface EnhancementEvaluationRecord {
  caseId: string;
  generationIndex: number;
  split: EvaluationSplit;
  category: string;
  requiredFacts: string[];
  prohibitedInventions: string[];
  request: {
    target: PromptTarget;
    roughThoughts: string;
    project: { name: string; path: string } | null;
    allowedProjectFiles: string[];
  };
  result: EnhancementResult;
  metrics: Record<string, unknown> & { status: "completed" };
  responseIds: string[];
  humanReview: EnhancementHumanReview;
}

export interface EvaluationCaseFlipRate {
  caseId: string;
  generations: number;
  passCount: number;
  failCount: number;
  flipRate: number;
}

export interface EnhancementEvaluationReviewSummary {
  reviewedCount: number;
  pendingCount: number;
  averageScore: number | null;
  hardFailureCount: number;
  protectedFailureCount: number;
  passing: boolean;
  flipRates?: EvaluationCaseFlipRate[];
}

export interface EnhancementEvaluationDocument {
  schemaVersion: 1;
  evaluationFrozenAt: string;
  profile: Record<string, unknown>;
  compilerVersion: string;
  outputSchemaVersion: number;
  privacyDisclosureVersion: string;
  privacyDisclosure: string;
  confirmedMaximumCostUsd: number;
  estimatedMaximumCostUsd: number;
  actualCostUsd: number;
  repeats: number;
  startedAt: string;
  completedAt: string;
  status: EnhancementEvaluationRun["status"];
  records: EnhancementEvaluationRecord[];
  reviewSummary?: EnhancementEvaluationReviewSummary;
}

interface RawEvaluationFile {
  schemaVersion: number;
  frozenAt: string;
  cases: EnhancementEvaluationCase[];
}

const FROZEN_EVALUATION = evaluationCases as RawEvaluationFile;
const EXTENDED_EVALUATION = extendedEvaluationCases as RawEvaluationFile;
const EVALUATION = FROZEN_EVALUATION;

export function allEvaluationCases(): EnhancementEvaluationCase[] {
  return [...FROZEN_EVALUATION.cases, ...EXTENDED_EVALUATION.cases];
}

export function defaultEvaluationDirectory(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Prompt Studio",
    "Evaluations",
  );
}

export function normalizeEvaluationRepeats(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 9
  ) {
    throw new Error("repeats must be an integer from 1 to 9.");
  }
  return value;
}

export function getEnhancementEvaluationPlan(
  profileId: RunEnhancementEvaluationOptions["profileId"],
  selection: EvaluationSelection = {},
): EnhancementEvaluationPlan {
  const profile = getProviderEnhancementProfile(profileId);
  const cases = selectEvaluationCases(selection);
  if (cases.length === 0) throw new Error("No evaluation cases matched.");
  const repeats = normalizeEvaluationRepeats(selection.repeats);
  const maximumCostUsd = cases.reduce(
    (sum, evaluationCase) =>
      sum +
      estimatedProviderMaximumCostUsd(requestFor(evaluationCase, profileId)),
    0,
  );
  return {
    profile,
    cases,
    repeats,
    maximumCostUsd: roundCost(maximumCostUsd * repeats),
    privacyDisclosure: providerPrivacyDisclosure(profile),
  };
}

export async function runEnhancementEvaluation(
  options: RunEnhancementEvaluationOptions,
): Promise<EnhancementEvaluationRun> {
  const plan = getEnhancementEvaluationPlan(
    options.profileId,
    options.selection,
  );
  if (
    !Number.isFinite(options.confirmedMaximumUsd) ||
    options.confirmedMaximumUsd <= 0
  ) {
    throw new Error("A positive confirmed evaluation budget is required.");
  }
  if (plan.maximumCostUsd > options.confirmedMaximumUsd) {
    throw new Error(
      `The maximum estimate $${plan.maximumCostUsd.toFixed(3)} exceeds the confirmed $${options.confirmedMaximumUsd.toFixed(3)} limit.`,
    );
  }
  if (!options.apiKey.trim()) {
    throw new Error(
      `A ${providerTitle(plan.profile.provider)} API key is required for the live evaluation.`,
    );
  }

  const startedAt = new Date().toISOString();
  const records: Array<Record<string, unknown>> = [];
  const privacyDisclosureVersion = privacyDisclosureVersionForProvider(
    plan.profile.provider,
  );
  const expectedGenerations = plan.cases.length * plan.repeats;
  let cancelled = false;
  let completedIndex = 0;
  caseLoop: for (const evaluationCase of plan.cases) {
    for (
      let generationIndex = 1;
      generationIndex <= plan.repeats;
      generationIndex += 1
    ) {
      if (options.signal?.aborted) {
        cancelled = true;
        break caseLoop;
      }
      const progress = {
        completed: completedIndex,
        total: expectedGenerations,
        caseId: evaluationCase.id,
        generationIndex,
      };
      options.onProgress?.({ ...progress, state: "running" });
      const request = requestFor(evaluationCase, options.profileId);
      try {
        const run = await dispatchEnhancement(request, {
          apiKey: options.apiKey,
          ...(options.signal ? { signal: options.signal } : {}),
          ...(options.fetcher
            ? {
                fetchers: {
                  [plan.profile.provider]: options.fetcher,
                },
              }
            : {}),
        });
        records.push({
          caseId: evaluationCase.id,
          generationIndex,
          split: evaluationCase.split,
          category: evaluationCase.category,
          requiredFacts: evaluationCase.requiredFacts,
          prohibitedInventions: evaluationCase.prohibitedInventions,
          request: {
            target: request.target,
            roughThoughts: request.roughThoughts,
            project: request.project ?? null,
            allowedProjectFiles: request.allowedProjectFiles ?? [],
          },
          result: run.result,
          metrics: {
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            latencyMs: run.latencyMs,
            ...run.usage,
            privacyDisclosureVersion,
            compilerVersion: run.compilerVersion,
            schemaVersion: run.outputSchemaVersion,
            status: "completed",
          },
          responseIds: run.responseIds,
          humanReview: emptyHumanReview(),
        });
        completedIndex += 1;
        options.onProgress?.({
          completed: completedIndex,
          total: expectedGenerations,
          caseId: evaluationCase.id,
          generationIndex,
          state: "completed",
        });
      } catch (error) {
        if (options.signal?.aborted) {
          cancelled = true;
          break caseLoop;
        }
        records.push({
          caseId: evaluationCase.id,
          generationIndex,
          split: evaluationCase.split,
          category: evaluationCase.category,
          metrics: {
            status: "failed",
            privacyDisclosureVersion,
            compilerVersion: ENHANCEMENT_COMPILER_VERSION,
            schemaVersion: ENHANCEMENT_OUTPUT_SCHEMA_VERSION,
          },
          error: error instanceof Error ? error.message : String(error),
        });
        completedIndex += 1;
        options.onProgress?.({
          completed: completedIndex,
          total: expectedGenerations,
          caseId: evaluationCase.id,
          generationIndex,
          state: "failed",
        });
      }
    }
  }

  const completedAt = new Date().toISOString();
  const completedCount = records.filter(
    (record) =>
      (record.metrics as Record<string, unknown> | undefined)?.status ===
      "completed",
  ).length;
  const failedCount = records.filter(
    (record) =>
      (record.metrics as Record<string, unknown> | undefined)?.status ===
      "failed",
  ).length;
  const actualCostUsd = roundCost(
    records.reduce((sum, record) => {
      const metrics = record.metrics as Record<string, unknown> | undefined;
      return (
        sum +
        (typeof metrics?.estimatedCostUsd === "number"
          ? metrics.estimatedCostUsd
          : 0)
      );
    }, 0),
  );
  const status = cancelled
    ? "cancelled"
    : failedCount > 0 || completedCount !== expectedGenerations
      ? "incomplete"
      : "awaiting-human-review";
  const document = {
    schemaVersion: 1,
    evaluationFrozenAt: EVALUATION.frozenAt,
    profile: {
      id: plan.profile.id,
      provider: plan.profile.provider,
      model: plan.profile.model,
      reasoningEffort: plan.profile.reasoningEffort,
      passes: plan.profile.passes,
    },
    compilerVersion: ENHANCEMENT_COMPILER_VERSION,
    outputSchemaVersion: ENHANCEMENT_OUTPUT_SCHEMA_VERSION,
    privacyDisclosureVersion,
    privacyDisclosure: plan.privacyDisclosure,
    confirmedMaximumCostUsd: options.confirmedMaximumUsd,
    estimatedMaximumCostUsd: plan.maximumCostUsd,
    actualCostUsd,
    repeats: plan.repeats,
    startedAt,
    completedAt,
    status,
    records,
  };
  const outputDirectory =
    options.outputDirectory ?? defaultEvaluationDirectory();
  const path = join(
    outputDirectory,
    `${startedAt.replaceAll(":", "-")}--${plan.profile.id}.json`,
  );
  await atomicWriteJson(path, document);
  return {
    path,
    status,
    caseCount: plan.cases.length,
    repeats: plan.repeats,
    generationCount: expectedGenerations,
    completedCount,
    failedCount,
    actualCostUsd,
    maximumCostUsd: plan.maximumCostUsd,
    startedAt,
    completedAt,
  };
}

export async function latestEnhancementEvaluation(): Promise<
  EnhancementEvaluationRun | undefined
> {
  let names: string[];
  try {
    names = (await readdir(defaultEvaluationDirectory()))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
  for (const name of names) {
    const path = join(defaultEvaluationDirectory(), name);
    const raw: unknown = JSON.parse(await readFile(path, "utf8"));
    if (
      !isObject(raw) ||
      !["awaiting-human-review", "human-review-complete"].includes(
        String(raw.status),
      )
    ) {
      continue;
    }
    const document = await loadEnhancementEvaluation(path);
    return evaluationRunSummary(path, document);
  }
  return undefined;
}

export async function loadEnhancementEvaluation(
  path: string,
): Promise<EnhancementEvaluationDocument> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isObject(raw) || raw.schemaVersion !== 1) {
    throw new Error("Evaluation report must use schema version 1.");
  }
  if (
    !["awaiting-human-review", "human-review-complete"].includes(
      String(raw.status),
    )
  ) {
    throw new Error("Only a completed evaluation can be reviewed.");
  }
  if (!Array.isArray(raw.records) || raw.records.length === 0) {
    throw new Error("Evaluation report contains no completed cases.");
  }
  const records = raw.records.map((record, index) =>
    validateEvaluationRecord(record, index),
  );
  return {
    schemaVersion: 1,
    evaluationFrozenAt: requiredString(
      raw.evaluationFrozenAt,
      "evaluationFrozenAt",
    ),
    profile: requiredObject(raw.profile, "profile"),
    compilerVersion: requiredString(raw.compilerVersion, "compilerVersion"),
    outputSchemaVersion: requiredNumber(
      raw.outputSchemaVersion,
      "outputSchemaVersion",
    ),
    privacyDisclosureVersion: requiredString(
      raw.privacyDisclosureVersion,
      "privacyDisclosureVersion",
    ),
    privacyDisclosure: requiredString(
      raw.privacyDisclosure,
      "privacyDisclosure",
    ),
    confirmedMaximumCostUsd: requiredNumber(
      raw.confirmedMaximumCostUsd,
      "confirmedMaximumCostUsd",
    ),
    estimatedMaximumCostUsd: requiredNumber(
      raw.estimatedMaximumCostUsd,
      "estimatedMaximumCostUsd",
    ),
    actualCostUsd: requiredNumber(raw.actualCostUsd, "actualCostUsd"),
    repeats: raw.repeats === undefined ? 1 : normalizeEvaluationRepeats(raw.repeats),
    startedAt: requiredTimestamp(raw.startedAt, "startedAt"),
    completedAt: requiredTimestamp(raw.completedAt, "completedAt"),
    status: raw.status as EnhancementEvaluationDocument["status"],
    records,
    ...(raw.reviewSummary
      ? {
          reviewSummary: evaluationReviewSummary(records),
        }
      : {}),
  };
}

export async function recordEnhancementEvaluationReview(
  path: string,
  caseId: string,
  input: EnhancementHumanReviewInput,
  generationIndex?: number,
): Promise<EnhancementEvaluationDocument> {
  const document = await loadEnhancementEvaluation(path);
  const record = document.records.find((item) => {
    if (item.caseId !== caseId) return false;
    if (generationIndex !== undefined) {
      return item.generationIndex === generationIndex;
    }
    return item.humanReview.status === "pending";
  });
  if (!record) throw new Error(`Evaluation case ${caseId} was not found.`);
  const reviewed = validateHumanReviewInput(input);
  record.humanReview = {
    status: "reviewed",
    ...reviewed,
    reviewedAt: new Date().toISOString(),
  };
  const reviewSummary = evaluationReviewSummary(document.records);
  document.status =
    reviewSummary.pendingCount === 0
      ? "human-review-complete"
      : "awaiting-human-review";
  document.reviewSummary = reviewSummary;
  await atomicWriteJson(path, document);
  return document;
}

export function blindEvaluationRecords(
  document: EnhancementEvaluationDocument,
): EnhancementEvaluationRecord[] {
  return [...document.records].sort((left, right) =>
    blindDigest(document.startedAt, left.caseId).localeCompare(
      blindDigest(document.startedAt, right.caseId),
    ),
  );
}

export function fullMarksHumanReview(): EnhancementHumanReviewInput {
  return {
    ...HUMAN_REVIEW_SCORE_MAXIMUMS,
    hardFailure: false,
    notes: "",
  };
}

export function evaluationReviewSummary(
  records: EnhancementEvaluationRecord[],
): EnhancementEvaluationReviewSummary {
  const reviewed = records.filter(
    (record) => record.humanReview.status === "reviewed",
  );
  const grouped = groupEvaluationRecords(records);
  const usesMajority = [...grouped.values()].some((group) => group.length > 1);
  const hardFailureCount = reviewed.filter(
    (record) => record.humanReview.hardFailure,
  ).length;
  const protectedFailureCount = usesMajority
    ? [...grouped.values()].filter(
        (group) => group[0]?.split === "protected" && !caseMajorityPasses(group),
      ).length
    : reviewed.filter(
        (record) => record.split === "protected" && !casePasses(record),
      ).length;
  const averages = reviewed.length > 0 ? reviewAverages(reviewed) : undefined;
  const authorizationOk = usesMajority
    ? [...grouped.values()]
        .filter((group) =>
          ["authorization", "destructive"].includes(group[0]?.category ?? ""),
        )
        .every(authorizationMajorityPasses)
    : reviewed
        .filter((record) =>
          ["authorization", "destructive"].includes(record.category),
        )
        .every((record) => record.humanReview.authorization === 5);
  const passing = usesMajority
    ? reviewed.length === records.length &&
      records.length > 0 &&
      [...grouped.values()].every(caseMajorityPasses) &&
      protectedFailureCount === 0 &&
      averages !== undefined &&
      averages.total >= 85 &&
      averages.fidelity >= 22 &&
      averages.unsupportedFacts >= 18 &&
      averages.validation >= 8 &&
      authorizationOk
    : reviewed.length === records.length &&
      hardFailureCount === 0 &&
      protectedFailureCount === 0 &&
      averages !== undefined &&
      averages.total >= 85 &&
      averages.fidelity >= 22 &&
      averages.unsupportedFacts >= 18 &&
      averages.validation >= 8 &&
      authorizationOk;
  return {
    reviewedCount: reviewed.length,
    pendingCount: records.length - reviewed.length,
    averageScore: averages ? roundReviewScore(averages.total) : null,
    hardFailureCount,
    protectedFailureCount,
    passing,
    ...(usesMajority ? { flipRates: evaluationCaseFlipRates(records) } : {}),
  };
}

function selectEvaluationCases(
  selection: EvaluationSelection,
): EnhancementEvaluationCase[] {
  const pool =
    selection.corpus === "all" ? allEvaluationCases() : EVALUATION.cases;
  const caseIds = new Set(selection.caseIds ?? []);
  const matches = pool.filter(
    (evaluationCase) =>
      (!selection.split || evaluationCase.split === selection.split) &&
      (caseIds.size === 0 || caseIds.has(evaluationCase.id)),
  );
  const limit = selection.limit
    ? Math.max(1, Math.trunc(selection.limit))
    : matches.length;
  return matches.slice(0, limit);
}

function requestFor(
  evaluationCase: EnhancementEvaluationCase,
  profileId: RunEnhancementEvaluationOptions["profileId"],
): EnhancementRequest {
  const projectContext = evaluationCase.projectContext;
  return {
    roughThoughts: evaluationCase.roughInput,
    target: evaluationCase.target,
    profileId,
    researchLevel: "none",
    ...(projectContext
      ? {
          project: {
            name: projectContext.name,
            path: `/prompt-studio-eval/${slug(projectContext.name)}`,
          },
          allowedProjectFiles: projectContext.files,
        }
      : {}),
  };
}

function privacyDisclosureVersionForProvider(
  provider: EnhancementRunProfile["provider"],
): string {
  if (provider === "anthropic") {
    return ANTHROPIC_PRIVACY_DISCLOSURE_VERSION;
  }
  if (provider === "google") {
    return GOOGLE_PRIVACY_DISCLOSURE_VERSION;
  }
  return PRIVACY_DISCLOSURE_VERSION;
}

function providerTitle(provider: EnhancementRunProfile["provider"]): string {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "google") return "Google";
  return "OpenAI";
}

function emptyHumanReview(): EnhancementHumanReview {
  return {
    status: "pending",
    fidelity: null,
    completeness: null,
    unsupportedFacts: null,
    actionability: null,
    validation: null,
    authorization: null,
    appropriateLength: null,
    hardFailure: null,
    notes: "",
  };
}

function evaluationRunSummary(
  path: string,
  document: EnhancementEvaluationDocument,
): EnhancementEvaluationRun {
  return {
    path,
    status: document.status,
    caseCount: new Set(document.records.map((record) => record.caseId)).size,
    repeats: document.repeats,
    generationCount: document.records.length,
    completedCount: document.records.length,
    failedCount: 0,
    actualCostUsd: document.actualCostUsd,
    maximumCostUsd: document.estimatedMaximumCostUsd,
    startedAt: document.startedAt,
    completedAt: document.completedAt,
  };
}

function validateEvaluationRecord(
  value: unknown,
  index: number,
): EnhancementEvaluationRecord {
  const field = `records[${index}]`;
  const record = requiredObject(value, field);
  const caseId = requiredString(record.caseId, `${field}.caseId`);
  const generationIndex =
    record.generationIndex === undefined
      ? 1
      : normalizeEvaluationRepeats(record.generationIndex);
  const frozenCase = allEvaluationCases().find((item) => item.id === caseId);
  if (!frozenCase) throw new Error(`Unknown evaluation case ${caseId}.`);
  if (record.split !== frozenCase.split) {
    throw new Error(`${field}.split does not match the frozen case.`);
  }
  const requestValue = requiredObject(record.request, `${field}.request`);
  const target = requiredTarget(requestValue.target, `${field}.request.target`);
  const project = optionalEvaluationProject(
    requestValue.project,
    `${field}.request.project`,
  );
  const allowedProjectFiles = stringArray(
    requestValue.allowedProjectFiles,
    `${field}.request.allowedProjectFiles`,
  );
  const request: EnhancementRequest = {
    roughThoughts: requiredString(
      requestValue.roughThoughts,
      `${field}.request.roughThoughts`,
    ),
    target,
    profileId: "openai-standard-v1",
    researchLevel: "none",
    allowedProjectFiles,
    ...(project ? { project } : {}),
  };
  const metrics = requiredObject(record.metrics, `${field}.metrics`);
  if (metrics.status !== "completed") {
    throw new Error(`${field} is not a completed evaluation case.`);
  }
  return {
    caseId,
    generationIndex,
    split: frozenCase.split,
    category: requiredString(record.category, `${field}.category`),
    requiredFacts: stringArray(record.requiredFacts, `${field}.requiredFacts`),
    prohibitedInventions: stringArray(
      record.prohibitedInventions,
      `${field}.prohibitedInventions`,
    ),
    request: {
      target,
      roughThoughts: request.roughThoughts,
      project: project ?? null,
      allowedProjectFiles,
    },
    result: validateEnhancementResult(record.result, request),
    metrics: { ...metrics, status: "completed" },
    responseIds: stringArray(record.responseIds, `${field}.responseIds`),
    humanReview: validateHumanReview(
      record.humanReview,
      `${field}.humanReview`,
    ),
  };
}

function validateHumanReview(
  value: unknown,
  field: string,
): EnhancementHumanReview {
  const review = requiredObject(value, field);
  if (review.status === "pending") {
    return {
      status: "pending",
      fidelity: null,
      completeness: null,
      unsupportedFacts: null,
      actionability: null,
      validation: null,
      authorization: null,
      appropriateLength: null,
      hardFailure: null,
      notes: optionalReviewNotes(review.notes),
    };
  }
  if (review.status !== "reviewed") {
    throw new Error(`${field}.status is invalid.`);
  }
  return {
    status: "reviewed",
    ...validateHumanReviewInput({
      fidelity: review.fidelity,
      completeness: review.completeness,
      unsupportedFacts: review.unsupportedFacts,
      actionability: review.actionability,
      validation: review.validation,
      authorization: review.authorization,
      appropriateLength: review.appropriateLength,
      hardFailure: review.hardFailure,
      notes: review.notes,
    }),
    reviewedAt: requiredTimestamp(review.reviewedAt, `${field}.reviewedAt`),
  };
}

function validateHumanReviewInput(
  input: EnhancementHumanReviewInput | Record<string, unknown>,
): EnhancementHumanReviewInput {
  if (typeof input.hardFailure !== "boolean") {
    throw new Error("hardFailure must be true or false.");
  }
  return {
    fidelity: reviewScoreValue(input.fidelity, "fidelity", 25),
    completeness: reviewScoreValue(input.completeness, "completeness", 20),
    unsupportedFacts: reviewScoreValue(
      input.unsupportedFacts,
      "unsupportedFacts",
      20,
    ),
    actionability: reviewScoreValue(input.actionability, "actionability", 15),
    validation: reviewScoreValue(input.validation, "validation", 10),
    authorization: reviewScoreValue(input.authorization, "authorization", 5),
    appropriateLength: reviewScoreValue(
      input.appropriateLength,
      "appropriateLength",
      5,
    ),
    hardFailure: input.hardFailure,
    notes: optionalReviewNotes(input.notes),
  };
}

function reviewAverages(records: EnhancementEvaluationRecord[]) {
  const totals = records.map((record) => {
    const review = record.humanReview;
    if (review.status !== "reviewed") {
      throw new Error("Cannot average an unreviewed evaluation case.");
    }
    return {
      total: reviewTotal(review),
      fidelity: review.fidelity!,
      unsupportedFacts: review.unsupportedFacts!,
      validation: review.validation!,
    };
  });
  return {
    total: average(totals.map((item) => item.total)),
    fidelity: average(totals.map((item) => item.fidelity)),
    unsupportedFacts: average(totals.map((item) => item.unsupportedFacts)),
    validation: average(totals.map((item) => item.validation)),
  };
}

function casePasses(record: EnhancementEvaluationRecord): boolean {
  const review = record.humanReview;
  if (review.status !== "reviewed" || review.hardFailure) return false;
  return (
    reviewTotal(review) >= 85 &&
    review.fidelity! >= 22 &&
    review.unsupportedFacts! >= 18 &&
    review.validation! >= 8 &&
    (!["authorization", "destructive"].includes(record.category) ||
      review.authorization === 5)
  );
}

function groupEvaluationRecords(
  records: readonly EnhancementEvaluationRecord[],
): Map<string, EnhancementEvaluationRecord[]> {
  const grouped = new Map<string, EnhancementEvaluationRecord[]>();
  for (const record of records) {
    const list = grouped.get(record.caseId) ?? [];
    list.push(record);
    grouped.set(record.caseId, list);
  }
  return grouped;
}

function caseMajorityPasses(group: EnhancementEvaluationRecord[]): boolean {
  const reviewed = group.filter(
    (record) => record.humanReview.status === "reviewed",
  );
  if (reviewed.length === 0 || reviewed.length !== group.length) return false;
  const passCount = reviewed.filter(casePasses).length;
  return passCount > reviewed.length - passCount;
}

function authorizationMajorityPasses(
  group: EnhancementEvaluationRecord[],
): boolean {
  const reviewed = group.filter(
    (record) => record.humanReview.status === "reviewed",
  );
  if (reviewed.length === 0 || reviewed.length !== group.length) return false;
  const ok = reviewed.filter(
    (record) => record.humanReview.authorization === 5,
  ).length;
  return ok > reviewed.length - ok;
}

export function evaluationCaseFlipRates(
  records: readonly EnhancementEvaluationRecord[],
): EvaluationCaseFlipRate[] {
  const byCase = new Map<string, boolean[]>();
  for (const record of records) {
    if (record.humanReview.status !== "reviewed") continue;
    const list = byCase.get(record.caseId) ?? [];
    list.push(casePasses(record));
    byCase.set(record.caseId, list);
  }
  return [...byCase.entries()]
    .map(([caseId, verdicts]) => {
      const passCount = verdicts.filter(Boolean).length;
      const failCount = verdicts.length - passCount;
      const majority = Math.max(passCount, failCount);
      return {
        caseId,
        generations: verdicts.length,
        passCount,
        failCount,
        flipRate:
          verdicts.length <= 1 ? 0 : 1 - majority / verdicts.length,
      };
    })
    .sort((left, right) => left.caseId.localeCompare(right.caseId));
}

function reviewTotal(review: EnhancementHumanReview): number {
  return (
    review.fidelity! +
    review.completeness! +
    review.unsupportedFacts! +
    review.actionability! +
    review.validation! +
    review.authorization! +
    review.appropriateLength!
  );
}

function blindDigest(startedAt: string, caseId: string): string {
  return createHash("sha256").update(`${startedAt}:${caseId}`).digest("hex");
}

function reviewScoreValue(
  value: unknown,
  field: string,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw new Error(`${field} must be a whole number from 0 to ${maximum}.`);
  }
  return value;
}

function optionalReviewNotes(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > 2_000) {
    throw new Error("Review notes must be at most 2,000 characters.");
  }
  const notes = value.trim();
  if (notes && containsLikelySecret(notes)) {
    throw new Error("Review notes appear to contain a secret.");
  }
  return notes;
}

function optionalEvaluationProject(
  value: unknown,
  field: string,
): { name: string; path: string } | undefined {
  if (value === undefined || value === null) return undefined;
  const project = requiredObject(value, field);
  return {
    name: requiredString(project.name, `${field}.name`),
    path: requiredString(project.path, `${field}.path`),
  };
}

function requiredTarget(value: unknown, field: string): PromptTarget {
  if (!["generic", "codex", "claude-code"].includes(String(value))) {
    throw new Error(`${field} is invalid.`);
  }
  return value as PromptTarget;
}

function requiredObject(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${field} must be an object.`);
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value.map((item) => item.trim());
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }
  return value;
}

function requiredTimestamp(value: unknown, field: string): string {
  const timestamp = requiredString(value, field);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`${field} must be an ISO timestamp.`);
  }
  return timestamp;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundReviewScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function slug(value: string): string {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  );
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isObject(error) && error.code === "ENOENT";
}
