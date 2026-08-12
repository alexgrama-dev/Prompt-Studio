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
import {
  activateCompilerPolicy,
  type CompilerState,
} from "./compiler-state.ts";
import {
  BASE_COMPILER_INSTRUCTIONS,
  compilerInstructionsDigest,
  defaultEnhancementCompilerPolicy,
  ENHANCEMENT_COMPILER_VERSION,
  type EnhancementCompilerPolicy,
} from "./enhancement.ts";
import type {
  FeedbackVerdict,
  PromptUseFeedbackRecord,
} from "./feedback-store.ts";
import { containsLikelySecret } from "./secrets.ts";

export const OPTIMIZATION_BASELINE_ID = "baseline";
export const OPTIMIZATION_PROPOSAL_STATUSES = [
  "awaiting-evaluation",
  "blocked",
  "ready-for-approval",
] as const;
export type OptimizationProposalStatus =
  (typeof OPTIMIZATION_PROPOSAL_STATUSES)[number];

export const OPTIMIZATION_RUBRIC_MAX = {
  fidelity: 25,
  completeness: 20,
  unsupportedFacts: 20,
  actionability: 15,
  validation: 10,
  authorization: 5,
  appropriateLength: 5,
} as const;
export type OptimizationRubricScores = {
  -readonly [K in keyof typeof OPTIMIZATION_RUBRIC_MAX]: number;
};

type EvaluationSplit = "development" | "validation" | "protected";

interface FrozenEvaluationCase {
  id: string;
  split: EvaluationSplit;
  category: string;
}

interface RawEvaluationCases {
  frozenAt: string;
  cases: FrozenEvaluationCase[];
}

const FROZEN_EVALUATION = evaluationCases as RawEvaluationCases;
const CASES_BY_ID = new Map(
  FROZEN_EVALUATION.cases.map((evaluationCase) => [
    evaluationCase.id,
    evaluationCase,
  ]),
);

export interface OptimizationEvidenceReference {
  feedbackId: string;
  promptId: string;
  promptTitle: string;
  promptSnapshotDigest: string;
  verdict: FeedbackVerdict;
  rating?: number;
  signals: string[];
}

export interface OptimizationCandidate {
  id: string;
  title: string;
  addendum: string;
  digest: string;
  rationale: string;
  addressesFeedbackIds: string[];
}

export interface OptimizationCriteria {
  minimumDevelopmentGain: number;
  minimumValidationScore: number;
  maximumValidationRegression: number;
  maximumCostIncreasePercent: number;
  protectedCasesMayRegress: false;
}

export interface OptimizationCaseScore {
  subjectId: string;
  caseId: string;
  generationCount: number;
  split: EvaluationSplit;
  scores: OptimizationRubricScores;
  total: number;
  hardFailure: boolean;
  hardFailureReason?: string;
  latencyMs: number;
  estimatedCostUsd: number;
  reviewed: true;
}

export interface OptimizationSubjectSummary {
  subjectId: string;
  developmentAverage: number;
  validationAverage: number;
  protectedAverage: number;
  totalCostUsd: number;
  hardFailureCount: number;
}

export interface OptimizationEvaluationSummary {
  recordedAt: string;
  winnerCandidateId?: string;
  qualityChange: {
    development: number;
    validation: number;
    protected: number;
  };
  costChange: {
    baselineUsd: number;
    candidateUsd: number;
    percent: number;
  };
  blockedReasons: string[];
  subjects: OptimizationSubjectSummary[];
}

export interface OptimizationEvaluation {
  scores: OptimizationCaseScore[];
  summary: OptimizationEvaluationSummary;
}

export interface OptimizationProposal {
  schemaVersion: 1;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  status: OptimizationProposalStatus;
  title: string;
  baseline: EnhancementCompilerPolicy;
  evidence: {
    approvedAt: string;
    feedback: OptimizationEvidenceReference[];
    evaluationFrozenAt: string;
    evaluationCaseIds: string[];
    conflicts: string[][];
  };
  criteria: OptimizationCriteria;
  candidates: OptimizationCandidate[];
  evaluation?: OptimizationEvaluation;
  filePath: string;
}

export interface OptimizationProposalDraft {
  title: string;
  feedback: PromptUseFeedbackRecord[];
  approvedEvidence: boolean;
  evaluationCaseIds: string[];
  candidates: Array<{
    id: string;
    title: string;
    addendum: string;
    rationale: string;
    addressesFeedbackIds: string[];
  }>;
  criteria?: Partial<Omit<OptimizationCriteria, "protectedCasesMayRegress">>;
  baseline?: EnhancementCompilerPolicy;
}

export interface OptimizationLibrary {
  proposals: OptimizationProposal[];
  invalid: Array<{ filePath: string; error: string }>;
}

export function defaultOptimizationDirectory(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Prompt Studio",
    "Optimization",
    "Proposals",
  );
}

export function availableOptimizationEvaluationCases(): Array<{
  id: string;
  split: EvaluationSplit;
  category: string;
}> {
  return FROZEN_EVALUATION.cases.map(({ id, split, category }) => ({
    id,
    split,
    category,
  }));
}

export async function createOptimizationProposal(
  directory: string,
  draft: OptimizationProposalDraft,
  now = new Date(),
): Promise<OptimizationProposal> {
  if (!draft.approvedEvidence) {
    throw new Error(
      "Optimization requires explicit approval of the selected feedback evidence.",
    );
  }
  const feedback = optimizationEvidence(draft.feedback);
  if (feedback.length < 2) {
    throw new Error(
      "Optimization requires at least two approved prompt-use feedback records.",
    );
  }
  if (!feedback.some((item) => item.verdict === "not-useful")) {
    throw new Error(
      "Optimization requires at least one not-useful record with corrective evidence.",
    );
  }
  if (
    !feedback.some(
      (item) =>
        item.signals.length > 0 &&
        (item.verdict === "not-useful" ||
          item.rating === 1 ||
          item.rating === 2),
    )
  ) {
    throw new Error(
      "Optimization requires a critique, correction, or observed outcome explaining what should improve.",
    );
  }
  const evaluationCaseIds = validateCaseSelection(draft.evaluationCaseIds);
  const baseline = validateBaseline(
    draft.baseline ?? defaultEnhancementCompilerPolicy(),
  );
  const candidates = validateCandidates(draft.candidates, feedback);
  const timestamp = now.toISOString();
  const id = randomUUID();
  const proposal = validateOptimizationProposal({
    schemaVersion: 1,
    id,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "awaiting-evaluation",
    title: boundedText(draft.title, "title", 1, 160),
    baseline,
    evidence: {
      approvedAt: timestamp,
      feedback,
      evaluationFrozenAt: FROZEN_EVALUATION.frozenAt,
      evaluationCaseIds,
      conflicts: feedbackConflicts(feedback),
    },
    criteria: optimizationCriteria(draft.criteria),
    candidates,
  });
  const filePath = join(directory, `${id}.json`);
  await atomicWrite(filePath, serializeOptimizationProposal(proposal));
  return { ...proposal, filePath };
}

export async function listOptimizationProposals(
  directory = defaultOptimizationDirectory(),
): Promise<OptimizationLibrary> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return { proposals: [], invalid: [] };
    throw error;
  }
  const proposals: OptimizationProposal[] = [];
  const invalid: OptimizationLibrary["invalid"] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = join(directory, entry.name);
    try {
      proposals.push(
        parseOptimizationProposal(await readFile(filePath, "utf8"), filePath),
      );
    } catch (error) {
      invalid.push({ filePath, error: errorMessage(error) });
    }
  }
  proposals.sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.id.localeCompare(right.id),
  );
  invalid.sort((left, right) => left.filePath.localeCompare(right.filePath));
  return { proposals, invalid };
}

export async function getOptimizationProposal(
  directory: string,
  id: string,
): Promise<OptimizationProposal> {
  const library = await listOptimizationProposals(directory);
  const exact = library.proposals.find((proposal) => proposal.id === id);
  if (exact) return exact;
  const prefix = library.proposals.filter(
    (proposal) => id.length >= 8 && proposal.id.startsWith(id),
  );
  if (prefix.length === 1) return prefix[0]!;
  throw new Error(
    prefix.length > 1
      ? "Optimization proposal identifier is ambiguous."
      : "Optimization proposal was not found.",
  );
}

export async function recordOptimizationScores(
  directory: string,
  id: string,
  scores: OptimizationCaseScore[],
  now = new Date(),
): Promise<OptimizationProposal> {
  const proposal = await getOptimizationProposal(directory, id);
  const evaluation = evaluateOptimizationScores(proposal, scores, now);
  const next = validateOptimizationProposal({
    ...withoutFilePath(proposal),
    revision: proposal.revision + 1,
    updatedAt: now.toISOString(),
    status:
      evaluation.summary.blockedReasons.length > 0
        ? "blocked"
        : "ready-for-approval",
    evaluation,
  });
  await atomicWrite(proposal.filePath, serializeOptimizationProposal(next));
  return { ...next, filePath: proposal.filePath };
}

export async function approveOptimizationCandidate(
  directory: string,
  proposalId: string,
  candidateId: string,
  expectedPolicyDigest: string,
  compilerStatePath: string,
  options: {
    expectedCurrentDigest: string;
    confirmed: boolean;
    now?: Date;
  },
): Promise<CompilerState> {
  const proposal = await getOptimizationProposal(directory, proposalId);
  if (proposal.status !== "ready-for-approval") {
    throw new Error(
      "Only a fully evaluated, unblocked proposal can be approved.",
    );
  }
  if (proposal.evaluation?.summary.winnerCandidateId !== candidateId) {
    throw new Error("Only the evaluated winning candidate can be approved.");
  }
  if (options.expectedCurrentDigest !== proposal.baseline.digest) {
    throw new Error(
      "The active compiler no longer matches this proposal's baseline. Generate and evaluate a new proposal.",
    );
  }
  const policy = optimizationCandidatePolicy(
    proposal,
    candidateId,
    options.now ?? new Date(),
  );
  if (policy.digest !== expectedPolicyDigest) {
    throw new Error(
      "The candidate compiler digest changed after review. Reload before approval.",
    );
  }
  return activateCompilerPolicy(compilerStatePath, policy, {
    expectedCurrentDigest: options.expectedCurrentDigest,
    confirmed: options.confirmed,
    proposalId: proposal.id,
    candidateId,
    ...(options.now ? { now: options.now } : {}),
  });
}

export async function deleteOptimizationProposal(
  directory: string,
  id: string,
  activeProposalIds: ReadonlySet<string> = new Set(),
): Promise<void> {
  const proposal = await getOptimizationProposal(directory, id);
  if (activeProposalIds.has(proposal.id)) {
    throw new Error(
      "An active or previously accepted optimization proposal cannot be deleted.",
    );
  }
  await rm(proposal.filePath);
}

export function optimizationCandidatePolicy(
  proposal: OptimizationProposal,
  candidateId: string,
  acceptedAt = new Date(),
): EnhancementCompilerPolicy {
  const candidate = proposal.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error("Optimization candidate was not found.");
  const instructions = [
    BASE_COMPILER_INSTRUCTIONS,
    "Accepted optimization addendum:",
    candidate.addendum,
  ].join("\n\n");
  return {
    version: `${ENHANCEMENT_COMPILER_VERSION}+opt.${proposal.id.slice(0, 8)}.${candidate.id}`,
    instructions,
    digest: compilerInstructionsDigest(instructions),
    proposalId: proposal.id,
    candidateId: candidate.id,
    acceptedAt: acceptedAt.toISOString(),
  };
}

export function optimizationInstructionDiff(
  proposal: OptimizationProposal,
  candidateId: string,
): string {
  const candidate = proposal.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error("Optimization candidate was not found.");
  const baselineAddendum = compilerAddendum(proposal.baseline.instructions);
  const before = baselineAddendum ? baselineAddendum.split("\n") : [];
  const after = candidate.addendum.split("\n");
  return simpleLineDiff(before, after);
}

export function exportOptimizationProposal(
  proposal: OptimizationProposal,
  format: "json" | "markdown",
): string {
  if (format === "json") {
    return `${JSON.stringify(withoutFilePath(proposal), null, 2)}\n`;
  }
  if (format !== "markdown") {
    throw new Error("Optimization export format must be json or markdown.");
  }
  const winnerId = proposal.evaluation?.summary.winnerCandidateId;
  const winner = proposal.candidates.find(
    (candidate) => candidate.id === winnerId,
  );
  const lines = [
    `# ${proposal.title}`,
    `**Status:** ${proposal.status}  `,
    `**Proposal:** ${proposal.id}  `,
    `**Baseline:** ${proposal.baseline.version}  `,
    `**Evidence:** ${proposal.evidence.feedback.length} feedback records, ${proposal.evidence.evaluationCaseIds.length} frozen cases`,
  ];
  if (winner && proposal.evaluation) {
    lines.push(
      "",
      `## Proposed Winner`,
      "",
      `**${winner.title}** (\`${winner.id}\`)`,
      "",
      winner.rationale,
      "",
      "### Instruction Diff",
      "",
      "```diff",
      optimizationInstructionDiff(proposal, winner.id),
      "```",
      "",
      "### Measured Change",
      "",
      `- Development: ${signed(proposal.evaluation.summary.qualityChange.development)} points`,
      `- Validation: ${signed(proposal.evaluation.summary.qualityChange.validation)} points`,
      `- Protected: ${signed(proposal.evaluation.summary.qualityChange.protected)} points`,
      `- Estimated evaluation cost: ${signed(proposal.evaluation.summary.costChange.percent)}%`,
    );
  }
  if (proposal.evaluation?.summary.blockedReasons.length) {
    lines.push(
      "",
      "## Blocked Reasons",
      "",
      ...proposal.evaluation.summary.blockedReasons.map(
        (reason) => `- ${reason}`,
      ),
    );
  }
  lines.push(
    "",
    "## Rollback",
    "",
    `Restore baseline digest \`${proposal.baseline.digest}\`. Approval never deletes this version or its evidence.`,
  );
  return `${lines.join("\n")}\n`;
}

export function parseOptimizationProposal(
  source: string,
  filePath = "<memory>",
): OptimizationProposal {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Optimization proposal is not valid JSON.");
  }
  return { ...validateOptimizationProposal(value), filePath };
}

export function serializeOptimizationProposal(
  proposal: OptimizationProposal | Omit<OptimizationProposal, "filePath">,
): string {
  return `${JSON.stringify(
    validateOptimizationProposal(withoutFilePath(proposal)),
    null,
    2,
  )}\n`;
}

function evaluateOptimizationScores(
  proposal: OptimizationProposal,
  scores: OptimizationCaseScore[],
  now: Date,
): OptimizationEvaluation {
  const validated = validateCompleteScores(proposal, scores);
  const subjectIds = [
    OPTIMIZATION_BASELINE_ID,
    ...proposal.candidates.map((candidate) => candidate.id),
  ];
  const subjects = subjectIds.map((subjectId) =>
    subjectSummary(subjectId, validated),
  );
  const baseline = subjects[0]!;
  const developmentEligible = subjects
    .slice(1)
    .filter(
      (subject) =>
        !validated.some(
          (score) =>
            score.subjectId === subject.subjectId &&
            score.split === "development" &&
            score.hardFailure,
        ),
    )
    .sort(
      (left, right) =>
        right.developmentAverage - left.developmentAverage ||
        left.subjectId.localeCompare(right.subjectId),
    );
  const winner = developmentEligible[0];
  const blockedReasons: string[] = [];
  if (!winner) {
    blockedReasons.push("Every candidate has a development-case hard failure.");
  }
  if (winner) {
    const candidate = proposal.candidates.find(
      (item) => item.id === winner.subjectId,
    )!;
    if (
      winner.developmentAverage <
      baseline.developmentAverage + proposal.criteria.minimumDevelopmentGain
    ) {
      blockedReasons.push(
        `Development gain is below ${proposal.criteria.minimumDevelopmentGain} points.`,
      );
    }
    if (winner.validationAverage < proposal.criteria.minimumValidationScore) {
      blockedReasons.push(
        `Validation average is below ${proposal.criteria.minimumValidationScore}.`,
      );
    }
    if (
      winner.validationAverage <
      baseline.validationAverage - proposal.criteria.maximumValidationRegression
    ) {
      blockedReasons.push("The candidate regresses the validation split.");
    }
    const winnerScores = validated.filter(
      (score) => score.subjectId === winner.subjectId,
    );
    const baselineByCase = new Map(
      validated
        .filter((score) => score.subjectId === OPTIMIZATION_BASELINE_ID)
        .map((score) => [score.caseId, score]),
    );
    for (const score of winnerScores.filter(
      (item) => item.split === "validation",
    )) {
      if (score.hardFailure) {
        blockedReasons.push(
          `Validation case ${score.caseId} has a hard failure.`,
        );
      }
    }
    for (const score of winnerScores.filter(
      (item) => item.split === "protected",
    )) {
      const baselineScore = baselineByCase.get(score.caseId)!;
      if (score.hardFailure) {
        blockedReasons.push(
          `Protected case ${score.caseId} has a hard failure.`,
        );
      }
      if (score.total < baselineScore.total) {
        blockedReasons.push(
          `Protected case ${score.caseId} regresses from ${baselineScore.total} to ${score.total}.`,
        );
      }
    }
    const costPercent = percentageChange(
      baseline.totalCostUsd,
      winner.totalCostUsd,
    );
    if (costPercent > proposal.criteria.maximumCostIncreasePercent) {
      blockedReasons.push(
        `Estimated evaluation cost rises ${round(costPercent)}%, above the ${proposal.criteria.maximumCostIncreasePercent}% limit.`,
      );
    }
    const unresolvedConflicts = proposal.evidence.conflicts.filter((group) =>
      group.some(
        (feedbackId) => !candidate.addressesFeedbackIds.includes(feedbackId),
      ),
    );
    if (unresolvedConflicts.length > 0) {
      blockedReasons.push(
        "The winning candidate does not explicitly address every conflicting feedback record.",
      );
    }
  }
  const qualityChange = winner
    ? {
        development: round(
          winner.developmentAverage - baseline.developmentAverage,
        ),
        validation: round(
          winner.validationAverage - baseline.validationAverage,
        ),
        protected: round(winner.protectedAverage - baseline.protectedAverage),
      }
    : { development: 0, validation: 0, protected: 0 };
  const candidateCost = winner?.totalCostUsd ?? 0;
  return {
    scores: validated,
    summary: {
      recordedAt: now.toISOString(),
      ...(winner ? { winnerCandidateId: winner.subjectId } : {}),
      qualityChange,
      costChange: {
        baselineUsd: baseline.totalCostUsd,
        candidateUsd: candidateCost,
        percent: round(percentageChange(baseline.totalCostUsd, candidateCost)),
      },
      blockedReasons: unique(blockedReasons),
      subjects,
    },
  };
}

function validateCompleteScores(
  proposal: OptimizationProposal,
  scores: OptimizationCaseScore[],
): OptimizationCaseScore[] {
  const expectedSubjects = new Set([
    OPTIMIZATION_BASELINE_ID,
    ...proposal.candidates.map((candidate) => candidate.id),
  ]);
  const expectedCases = new Set(proposal.evidence.evaluationCaseIds);
  const seen = new Set<string>();
  const validated = scores.map((score) => {
    const normalized = validateScore(score);
    if (!expectedSubjects.has(normalized.subjectId)) {
      throw new Error(`Score names unknown subject ${normalized.subjectId}.`);
    }
    if (!expectedCases.has(normalized.caseId)) {
      throw new Error(`Score names unselected case ${normalized.caseId}.`);
    }
    const key = `${normalized.subjectId}:${normalized.caseId}`;
    if (seen.has(key)) throw new Error(`Duplicate score for ${key}.`);
    seen.add(key);
    return normalized;
  });
  for (const subjectId of expectedSubjects) {
    for (const caseId of expectedCases) {
      if (!seen.has(`${subjectId}:${caseId}`)) {
        throw new Error(`Missing score for ${subjectId}:${caseId}.`);
      }
    }
  }
  return validated.sort(
    (left, right) =>
      left.subjectId.localeCompare(right.subjectId) ||
      left.caseId.localeCompare(right.caseId),
  );
}

function subjectSummary(
  subjectId: string,
  scores: OptimizationCaseScore[],
): OptimizationSubjectSummary {
  const selected = scores.filter((score) => score.subjectId === subjectId);
  return {
    subjectId,
    developmentAverage: averageFor(selected, "development"),
    validationAverage: averageFor(selected, "validation"),
    protectedAverage: averageFor(selected, "protected"),
    totalCostUsd: round(
      selected.reduce((sum, score) => sum + score.estimatedCostUsd, 0),
    ),
    hardFailureCount: selected.filter((score) => score.hardFailure).length,
  };
}

function averageFor(
  scores: OptimizationCaseScore[],
  split: EvaluationSplit,
): number {
  const selected = scores.filter((score) => score.split === split);
  return round(
    selected.reduce((sum, score) => sum + score.total, 0) / selected.length,
  );
}

function validateScore(score: OptimizationCaseScore): OptimizationCaseScore {
  const caseId = identifier(score.caseId, "score.caseId");
  const evaluationCase = CASES_BY_ID.get(caseId);
  if (!evaluationCase) throw new Error(`Unknown evaluation case ${caseId}.`);
  if (score.split !== evaluationCase.split) {
    throw new Error(`Score split does not match frozen case ${caseId}.`);
  }
  const scores = {} as OptimizationRubricScores;
  for (const [criterion, maximum] of Object.entries(
    OPTIMIZATION_RUBRIC_MAX,
  ) as Array<[keyof OptimizationRubricScores, number]>) {
    scores[criterion] = boundedNumber(
      score.scores[criterion],
      `score.${criterion}`,
      0,
      maximum,
    );
  }
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  if (score.total !== total) {
    throw new Error(`Score total for ${caseId} must equal ${total}.`);
  }
  if (score.reviewed !== true) {
    throw new Error(`Score for ${caseId} requires completed human review.`);
  }
  const generationCount = boundedNumber(
    score.generationCount,
    "generationCount",
    3,
    20,
  );
  if (!Number.isInteger(generationCount)) {
    throw new Error("generationCount must be a whole number.");
  }
  const hardFailureReason = score.hardFailureReason?.trim();
  if (score.hardFailure && !hardFailureReason) {
    throw new Error(`Hard failure for ${caseId} requires a reason.`);
  }
  if (!score.hardFailure && hardFailureReason) {
    throw new Error(
      `Non-failing score ${caseId} cannot have a failure reason.`,
    );
  }
  return {
    subjectId: identifier(score.subjectId, "score.subjectId"),
    caseId,
    generationCount,
    split: score.split,
    scores,
    total,
    hardFailure: score.hardFailure === true,
    ...(hardFailureReason
      ? {
          hardFailureReason: boundedText(
            hardFailureReason,
            "hardFailureReason",
            1,
            1_000,
          ),
        }
      : {}),
    latencyMs: boundedNumber(score.latencyMs, "latencyMs", 0, 3_600_000),
    estimatedCostUsd: boundedNumber(
      score.estimatedCostUsd,
      "estimatedCostUsd",
      0,
      1_000,
    ),
    reviewed: true,
  };
}

function optimizationEvidence(
  records: PromptUseFeedbackRecord[],
): OptimizationEvidenceReference[] {
  const seen = new Set<string>();
  return records
    .map((record) => {
      if (seen.has(record.id)) {
        throw new Error(`Feedback ${record.id} was selected more than once.`);
      }
      seen.add(record.id);
      const signals = unique(
        [
          record.critique,
          record.correction,
          record.outcome?.summary,
          record.outcome?.status
            ? `Observed outcome: ${record.outcome.status}.`
            : undefined,
        ]
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => boundedText(value, "feedback signal", 1, 8_000)),
      );
      return {
        feedbackId: record.id,
        promptId: record.prompt.promptId,
        promptTitle: record.prompt.title,
        promptSnapshotDigest: record.prompt.snapshotDigest,
        verdict: record.verdict,
        ...(record.rating ? { rating: record.rating } : {}),
        signals,
      };
    })
    .sort((left, right) => left.feedbackId.localeCompare(right.feedbackId));
}

function feedbackConflicts(
  feedback: OptimizationEvidenceReference[],
): string[][] {
  const bySnapshot = new Map<string, OptimizationEvidenceReference[]>();
  for (const item of feedback) {
    const existing = bySnapshot.get(item.promptSnapshotDigest) ?? [];
    existing.push(item);
    bySnapshot.set(item.promptSnapshotDigest, existing);
  }
  return [...bySnapshot.values()]
    .filter((group) => {
      const verdicts = new Set(group.map((item) => item.verdict));
      return verdicts.has("useful") && verdicts.has("not-useful");
    })
    .map((group) => group.map((item) => item.feedbackId).sort())
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
}

function validateCandidates(
  drafts: OptimizationProposalDraft["candidates"],
  feedback: OptimizationEvidenceReference[],
): OptimizationCandidate[] {
  if (drafts.length < 2 || drafts.length > 4) {
    throw new Error("Optimization requires between two and four candidates.");
  }
  const feedbackIds = new Set(feedback.map((item) => item.feedbackId));
  const seen = new Set<string>();
  return drafts.map((draft) => {
    const id = identifier(draft.id, "candidate.id");
    if (id === OPTIMIZATION_BASELINE_ID) {
      throw new Error("Optimization candidate cannot use the baseline ID.");
    }
    if (seen.has(id)) throw new Error(`Duplicate candidate ${id}.`);
    seen.add(id);
    const addendum = boundedText(
      draft.addendum,
      "candidate.addendum",
      50,
      6_000,
    );
    if (containsLikelySecret(addendum)) {
      throw new Error("Optimization candidate appears to contain a secret.");
    }
    const addressesFeedbackIds = unique(
      draft.addressesFeedbackIds.map((feedbackId) =>
        identifier(feedbackId, "addressesFeedbackId"),
      ),
    ).sort();
    for (const feedbackId of addressesFeedbackIds) {
      if (!feedbackIds.has(feedbackId)) {
        throw new Error(
          `Candidate ${id} addresses unselected feedback ${feedbackId}.`,
        );
      }
    }
    return {
      id,
      title: boundedText(draft.title, "candidate.title", 1, 120),
      addendum,
      digest: createHash("sha256").update(addendum).digest("hex"),
      rationale: boundedText(draft.rationale, "candidate.rationale", 1, 2_000),
      addressesFeedbackIds,
    };
  });
}

function validateCaseSelection(caseIds: string[]): string[] {
  const selected = unique(
    caseIds.map((caseId) => identifier(caseId, "evaluationCaseId")),
  );
  for (const caseId of selected) {
    if (!CASES_BY_ID.has(caseId)) {
      throw new Error(`Unknown evaluation case ${caseId}.`);
    }
  }
  const counts = { development: 0, validation: 0, protected: 0 };
  for (const caseId of selected) counts[CASES_BY_ID.get(caseId)!.split] += 1;
  if (counts.development < 2 || counts.validation < 2 || counts.protected < 1) {
    throw new Error(
      "Optimization requires at least two development, two validation, and one protected case.",
    );
  }
  return selected.sort();
}

function optimizationCriteria(
  input: OptimizationProposalDraft["criteria"],
): OptimizationCriteria {
  return {
    minimumDevelopmentGain: boundedNumber(
      input?.minimumDevelopmentGain ?? 2,
      "minimumDevelopmentGain",
      0,
      25,
    ),
    minimumValidationScore: boundedNumber(
      input?.minimumValidationScore ?? 85,
      "minimumValidationScore",
      0,
      100,
    ),
    maximumValidationRegression: boundedNumber(
      input?.maximumValidationRegression ?? 0,
      "maximumValidationRegression",
      0,
      10,
    ),
    maximumCostIncreasePercent: boundedNumber(
      input?.maximumCostIncreasePercent ?? 25,
      "maximumCostIncreasePercent",
      0,
      1_000,
    ),
    protectedCasesMayRegress: false,
  };
}

function validateBaseline(
  baseline: EnhancementCompilerPolicy,
): EnhancementCompilerPolicy {
  if (baseline.digest !== compilerInstructionsDigest(baseline.instructions)) {
    throw new Error("Optimization baseline digest is invalid.");
  }
  if (!baseline.instructions.startsWith(BASE_COMPILER_INSTRUCTIONS)) {
    throw new Error(
      "Optimization baseline does not preserve the mandatory compiler contract.",
    );
  }
  return baseline;
}

function validateOptimizationProposal(
  value: unknown,
): Omit<OptimizationProposal, "filePath"> {
  const object = requiredObject(value, "optimization proposal");
  const baseline = validateBaseline(
    requiredObject(
      object.baseline,
      "optimization baseline",
    ) as unknown as EnhancementCompilerPolicy,
  );
  const evidenceObject = requiredObject(
    object.evidence,
    "optimization evidence",
  );
  const feedback = requiredArray(
    evidenceObject.feedback,
    "optimization feedback",
  ).map(validateEvidenceReference);
  const candidates = requiredArray(
    object.candidates,
    "optimization candidates",
  ).map((candidate) =>
    validateCandidateRecord(
      candidate,
      new Set(feedback.map((item) => item.feedbackId)),
    ),
  );
  if (candidates.length < 2 || candidates.length > 4) {
    throw new Error(
      "Optimization proposal must contain two to four candidates.",
    );
  }
  const evaluationCaseIds = validateCaseSelection(
    requiredArray(
      evidenceObject.evaluationCaseIds,
      "evaluationCaseIds",
    ) as string[],
  );
  const conflicts = requiredArray(
    evidenceObject.conflicts,
    "evidence conflicts",
  ).map((group) =>
    requiredArray(group, "feedback conflict").map((id) =>
      identifier(id, "feedback conflict id"),
    ),
  );
  const criteriaObject = requiredObject(
    object.criteria,
    "optimization criteria",
  );
  const criteria: OptimizationCriteria = {
    minimumDevelopmentGain: boundedNumber(
      criteriaObject.minimumDevelopmentGain,
      "minimumDevelopmentGain",
      0,
      25,
    ),
    minimumValidationScore: boundedNumber(
      criteriaObject.minimumValidationScore,
      "minimumValidationScore",
      0,
      100,
    ),
    maximumValidationRegression: boundedNumber(
      criteriaObject.maximumValidationRegression,
      "maximumValidationRegression",
      0,
      10,
    ),
    maximumCostIncreasePercent: boundedNumber(
      criteriaObject.maximumCostIncreasePercent,
      "maximumCostIncreasePercent",
      0,
      1_000,
    ),
    protectedCasesMayRegress: false,
  };
  if (criteriaObject.protectedCasesMayRegress !== false) {
    throw new Error("Protected evaluation cases may never regress silently.");
  }
  const status = object.status;
  if (
    typeof status !== "string" ||
    !(OPTIMIZATION_PROPOSAL_STATUSES as readonly string[]).includes(status)
  ) {
    throw new Error("Optimization proposal has an unsupported status.");
  }
  const base = {
    schemaVersion: 1 as const,
    id: identifier(object.id, "proposal.id"),
    revision: positiveInteger(object.revision, "proposal.revision"),
    createdAt: timestamp(object.createdAt, "proposal.createdAt"),
    updatedAt: timestamp(object.updatedAt, "proposal.updatedAt"),
    status: status as OptimizationProposalStatus,
    title: boundedText(object.title, "proposal.title", 1, 160),
    baseline,
    evidence: {
      approvedAt: timestamp(evidenceObject.approvedAt, "evidence.approvedAt"),
      feedback,
      evaluationFrozenAt: boundedText(
        evidenceObject.evaluationFrozenAt,
        "evaluationFrozenAt",
        1,
        64,
      ),
      evaluationCaseIds,
      conflicts,
    },
    criteria,
    candidates,
  };
  const evaluation =
    object.evaluation === undefined
      ? undefined
      : validateEvaluation(object.evaluation, base);
  if (status === "awaiting-evaluation" && evaluation) {
    throw new Error("Awaiting-evaluation proposal cannot contain scores.");
  }
  if (status !== "awaiting-evaluation" && !evaluation) {
    throw new Error("Evaluated proposal is missing its evaluation.");
  }
  if (
    evaluation &&
    ((status === "blocked" && evaluation.summary.blockedReasons.length === 0) ||
      (status === "ready-for-approval" &&
        evaluation.summary.blockedReasons.length > 0))
  ) {
    throw new Error(
      "Optimization proposal status disagrees with its evaluation.",
    );
  }
  return { ...base, ...(evaluation ? { evaluation } : {}) };
}

function validateEvaluation(
  value: unknown,
  proposal: Pick<
    OptimizationProposal,
    "candidates" | "evidence" | "criteria" | "baseline"
  >,
): OptimizationEvaluation {
  const object = requiredObject(value, "optimization evaluation");
  const scores = validateCompleteScores(
    {
      ...proposal,
    } as OptimizationProposal,
    requiredArray(
      object.scores,
      "optimization scores",
    ) as OptimizationCaseScore[],
  );
  const recordedAt = timestamp(
    requiredObject(object.summary, "evaluation summary").recordedAt,
    "evaluation.recordedAt",
  );
  const recomputed = evaluateOptimizationScores(
    proposal as OptimizationProposal,
    scores,
    new Date(recordedAt),
  );
  if (stableJson(recomputed.summary) !== stableJson(object.summary)) {
    throw new Error(
      "Optimization evaluation summary does not match its scores.",
    );
  }
  return recomputed;
}

function validateEvidenceReference(
  value: unknown,
): OptimizationEvidenceReference {
  const object = requiredObject(value, "optimization feedback reference");
  if (
    object.verdict !== "not-rated" &&
    object.verdict !== "useful" &&
    object.verdict !== "not-useful"
  ) {
    throw new Error("Optimization evidence has an unsupported verdict.");
  }
  return {
    feedbackId: identifier(object.feedbackId, "feedbackId"),
    promptId: identifier(object.promptId, "promptId"),
    promptTitle: boundedText(object.promptTitle, "promptTitle", 1, 160),
    promptSnapshotDigest: digest(
      object.promptSnapshotDigest,
      "promptSnapshotDigest",
    ),
    verdict: object.verdict,
    ...(object.rating !== undefined
      ? { rating: boundedNumber(object.rating, "rating", 1, 5) }
      : {}),
    signals: requiredArray(object.signals, "feedback signals").map((signal) =>
      boundedText(signal, "feedback signal", 1, 8_000),
    ),
  };
}

function validateCandidateRecord(
  value: unknown,
  feedbackIds: Set<string>,
): OptimizationCandidate {
  const object = requiredObject(value, "optimization candidate");
  const addendum = boundedText(
    object.addendum,
    "candidate.addendum",
    50,
    6_000,
  );
  const candidate: OptimizationCandidate = {
    id: identifier(object.id, "candidate.id"),
    title: boundedText(object.title, "candidate.title", 1, 120),
    addendum,
    digest: digest(object.digest, "candidate.digest"),
    rationale: boundedText(object.rationale, "candidate.rationale", 1, 2_000),
    addressesFeedbackIds: requiredArray(
      object.addressesFeedbackIds,
      "addressesFeedbackIds",
    )
      .map((id) => identifier(id, "addressesFeedbackId"))
      .sort(),
  };
  if (
    candidate.digest !== createHash("sha256").update(addendum).digest("hex")
  ) {
    throw new Error(`Candidate ${candidate.id} digest is invalid.`);
  }
  for (const feedbackId of candidate.addressesFeedbackIds) {
    if (!feedbackIds.has(feedbackId)) {
      throw new Error(
        `Candidate ${candidate.id} addresses unknown feedback ${feedbackId}.`,
      );
    }
  }
  return candidate;
}

function compilerAddendum(instructions: string): string {
  if (instructions === BASE_COMPILER_INSTRUCTIONS) return "";
  const marker = "\n\nAccepted optimization addendum:\n\n";
  const index = instructions.indexOf(marker);
  return index >= 0 ? instructions.slice(index + marker.length) : "";
}

function simpleLineDiff(before: string[], after: string[]): string {
  if (before.length === 0) return after.map((line) => `+ ${line}`).join("\n");
  const lines = before.map((line) => `- ${line}`);
  lines.push(...after.map((line) => `+ ${line}`));
  return lines.join("\n");
}

function percentageChange(baseline: number, candidate: number): number {
  if (baseline === 0) return candidate === 0 ? 0 : 1_000_000;
  return ((candidate - baseline) / baseline) * 100;
}

function signed(value: number): string {
  const rounded = round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function withoutFilePath<T extends object>(value: T): Omit<T, "filePath"> {
  const copy = {
    ...(value as T & { filePath?: string }),
  };
  delete copy.filePath;
  return copy;
}

function boundedText(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${name} must contain ${minimum}-${maximum} characters.`);
  }
  return normalized;
}

function boundedNumber(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return round(value);
}

function identifier(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[a-zA-Z0-9._:/+-]+$/.test(value)
  ) {
    throw new Error(`${name} must be a bounded identifier.`);
  }
  return value;
}

function digest(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function timestamp(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${name} must be an ISO 8601 UTC timestamp.`);
  }
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value as number;
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function atomicWrite(path: string, source: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, {
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

function isMissingFile(error: unknown): boolean {
  return (
    error !== null &&
    error !== undefined &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
