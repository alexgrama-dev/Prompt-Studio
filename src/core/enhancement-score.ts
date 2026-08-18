import {
  detectAntiPatterns,
  extractInstructionShapedSpans,
  HARD_ANTI_PATTERN_IDS,
  type AntiPatternFinding,
  type AntiPatternId,
} from "./anti-patterns.ts";
import { planCompilerStages } from "./compiler-pipeline.ts";
import {
  splitExecutionGuardrails,
  type EnhancementResult,
} from "./enhancement.ts";
import type { PromptTarget } from "./prompt-store.ts";
import { resolveRenderingProfile } from "./rendering-profiles.ts";

export const REVIEW_SCORE_MAXIMUM = 5;

export const REVIEW_SCORE_DIMENSIONS = [
  "clarity",
  "constraints",
  "missingContext",
] as const;

export type ReviewScoreDimensionId = (typeof REVIEW_SCORE_DIMENSIONS)[number];

export interface ReviewDimensionScore {
  id: ReviewScoreDimensionId;
  title: string;
  score: number;
  max: typeof REVIEW_SCORE_MAXIMUM;
  notes: string[];
}

export interface EnhancementReviewScore {
  clarity: ReviewDimensionScore;
  constraints: ReviewDimensionScore;
  missingContext: ReviewDimensionScore;
}

export interface ScoreEnhancementReviewInput {
  roughThoughts: string;
  result: EnhancementResult;
  findings?: readonly AntiPatternFinding[];
  hasProject?: boolean;
  allowedProjectFiles?: readonly string[];
  target?: PromptTarget;
}

const DIMENSION_TITLES: Record<ReviewScoreDimensionId, string> = {
  clarity: "Clarity",
  constraints: "Constraints",
  missingContext: "Missing context",
};

const CLARITY_IDS = new Set<AntiPatternId>([
  "length-as-quality",
  "process-overspec",
  "emphasis-inflation",
  "redundant-instruction",
  "unverifiable-success",
  "cargo-cult-structure",
  "identifier-markup-drift",
  "tier-blind-density",
]);

const CONSTRAINT_IDS = new Set<AntiPatternId>([
  "missing-stopping-rules",
  "scope-inflation",
  "unguarded-tool-trust",
  "merged-conflict-rendering",
  "absolutes-on-judgment",
]);

const MISSING_CONTEXT_IDS = new Set<AntiPatternId>([
  "fabricated-specifics",
  "silent-assumption-burial",
  "injection-passthrough",
]);

const FINDING_NOTES: Record<AntiPatternId, string> = {
  "length-as-quality": "The prompt is padded or ceremonial.",
  "process-overspec": "The prompt over-specifies process.",
  "absolutes-on-judgment": "Stacked absolutes land on judgment calls.",
  "emphasis-inflation": "Criticality markers are stacked.",
  "unverifiable-success": "Success is not checkable.",
  "missing-stopping-rules": "No done, ask, or stop condition.",
  "fabricated-specifics": "The prompt invents files or facts.",
  "silent-assumption-burial": "Assumptions are buried in the prompt.",
  "scope-inflation": "A small ask was expanded.",
  "redundant-instruction": "The prompt repeats native model behavior.",
  "cargo-cult-structure": "Empty or placeholder sections are present.",
  "injection-passthrough": "Untrusted text is not fenced.",
  "merged-conflict-rendering": "Opposing instructions were averaged.",
  "tier-blind-density": "Density does not match the target.",
  "unguarded-tool-trust": "A required safety guard is missing.",
  "identifier-markup-drift": "Path markup does not match the target.",
};

/**
 * Compact review score from the existing compiler critique: anti-patterns,
 * listed missing information, and blocking input gaps. No network call.
 */
export function scoreEnhancementReview(
  input: ScoreEnhancementReviewInput,
): EnhancementReviewScore {
  const target = input.target ?? input.result.target;
  const { taskPrompt } = splitExecutionGuardrails(input.result.enhancedPrompt);
  const findings = input.findings
    ? [...input.findings]
    : critiqueFindings(input, taskPrompt, target);
  const plan = planCompilerStages({
    roughThoughts: input.roughThoughts,
    target,
    hasProject: input.hasProject === true,
  });
  const blockingGaps = plan.gaps.filter((gap) => gap.bucket === "blocking");
  const listedMissing = input.result.missingInformation.length > 0;

  return {
    clarity: dimension(
      "clarity",
      findings.filter((finding) => CLARITY_IDS.has(finding.id)),
    ),
    constraints: dimension(
      "constraints",
      findings.filter((finding) => CONSTRAINT_IDS.has(finding.id)),
    ),
    missingContext: dimension(
      "missingContext",
      findings.filter((finding) => MISSING_CONTEXT_IDS.has(finding.id)),
      !listedMissing && blockingGaps.length > 0
        ? [
            {
              amount: 2,
              note: "Blocking gaps were not listed as missing information.",
            },
          ]
        : [],
    ),
  };
}

export function formatEnhancementReviewScore(
  score: EnhancementReviewScore,
): string {
  return REVIEW_SCORE_DIMENSIONS.map((id) => {
    const dimensionScore = score[id];
    return `${dimensionScore.title} ${dimensionScore.score}/${dimensionScore.max}`;
  }).join(" · ");
}

export function enhancementReviewWatch(
  score: EnhancementReviewScore,
): string | undefined {
  for (const id of REVIEW_SCORE_DIMENSIONS) {
    const note = score[id].notes[0];
    if (score[id].score < REVIEW_SCORE_MAXIMUM && note) return note;
  }
  return undefined;
}

function critiqueFindings(
  input: ScoreEnhancementReviewInput,
  taskPrompt: string,
  target: PromptTarget,
): AntiPatternFinding[] {
  const profile = resolveRenderingProfile(target);
  return detectAntiPatterns({
    prompt: taskPrompt,
    roughInput: input.roughThoughts,
    untrustedSpans: extractInstructionShapedSpans(input.roughThoughts),
    reasoningTier:
      profile.tier === "non-reasoning" ? "non-reasoning" : "reasoning",
    identifierMarkup: profile.identifierMarkup,
    ...(input.allowedProjectFiles
      ? { allowedProjectFiles: input.allowedProjectFiles }
      : {}),
  });
}

function dimension(
  id: ReviewScoreDimensionId,
  findings: readonly AntiPatternFinding[],
  extras: readonly { amount: number; note: string }[] = [],
): ReviewDimensionScore {
  let score = REVIEW_SCORE_MAXIMUM;
  const notes: string[] = [];
  for (const finding of findings) {
    score -= (HARD_ANTI_PATTERN_IDS as readonly AntiPatternId[]).includes(
      finding.id,
    )
      ? 2
      : 1;
    const note = FINDING_NOTES[finding.id];
    if (note && !notes.includes(note)) notes.push(note);
  }
  for (const extra of extras) {
    score -= extra.amount;
    if (!notes.includes(extra.note)) notes.push(extra.note);
  }
  return {
    id,
    title: DIMENSION_TITLES[id],
    score: clampScore(score),
    max: REVIEW_SCORE_MAXIMUM,
    notes,
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(REVIEW_SCORE_MAXIMUM, value));
}
