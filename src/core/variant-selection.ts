import {
  HUMAN_REVIEW_SCORE_MAXIMUMS,
  type EnhancementEvaluationRecord,
  type EnhancementHumanReviewInput,
} from "./evaluation.ts";
import {
  judgeEvaluationRecord,
  type EvaluationJudgeOptions,
} from "./evaluation-judge.ts";
import {
  judgeEvaluationRecordV2,
  v2Mean,
  V2_DIMENSION_IDS,
  type EvaluationJudgeV2Review,
} from "./evaluation-judge-v2.ts";
import { deriveEnhancementFacts } from "./enhancement-facts.ts";
import type { EnhancementRequest, EnhancementRun } from "./enhancement.ts";

export const MAX_VARIANTS = 4;
export const MIN_VARIANTS = 2;

export const REVIEW_TOTAL = Object.values(HUMAN_REVIEW_SCORE_MAXIMUMS).reduce(
  (total, value) => total + value,
  0,
);

export type VariantReview =
  | EnhancementHumanReviewInput
  | EvaluationJudgeV2Review;

export type VariantJudgeRubric = "v1" | "v2";

export interface EnhancementVariant {
  index: number;
  run: EnhancementRun;
}

export interface ScoredVariant extends EnhancementVariant {
  score: number;
  review: VariantReview;
  judgeCostUsd: number;
}

export interface VariantSelection {
  ranked: ScoredVariant[];
  winner: ScoredVariant;
  judgeCostUsd: number;
  enhancementCostUsd: number;
  judgeRubric: VariantJudgeRubric;
}

export interface VariantJudgeOptions extends EvaluationJudgeOptions {
  rubric?: VariantJudgeRubric;
}

export function variantCount(requested: unknown): number {
  const parsed =
    typeof requested === "number" ? requested : Number(requested ?? Number.NaN);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.round(parsed);
  if (rounded < MIN_VARIANTS) return 0;
  return Math.min(rounded, MAX_VARIANTS);
}

export function isV1VariantReview(
  review: VariantReview,
): review is EnhancementHumanReviewInput {
  return "fidelity" in review;
}

export function reviewTotal(review: EnhancementHumanReviewInput): number {
  return (
    review.fidelity +
    review.completeness +
    review.unsupportedFacts +
    review.actionability +
    review.validation +
    review.authorization +
    review.appropriateLength
  );
}

export function variantReviewSummary(review: VariantReview): string {
  if (isV1VariantReview(review)) {
    return [
      `fidelity ${review.fidelity}`,
      `completeness ${review.completeness}`,
      `unsupported facts ${review.unsupportedFacts}`,
      `actionability ${review.actionability}`,
      `validation ${review.validation}`,
      `authorization ${review.authorization}`,
      `length ${review.appropriateLength}`,
    ].join(" · ");
  }
  return V2_DIMENSION_IDS.map((id) => `${id} ${review[id]}`).join(" · ");
}

/**
 * Wraps one variant as an evaluation record so the existing blind judge scores
 * it with the same rubric the eval suite gates on. The judge never sees the
 * variant index or which model produced it.
 */
export function variantAsEvaluationRecord(
  request: EnhancementRequest,
  variant: EnhancementVariant,
): EnhancementEvaluationRecord {
  const facts = deriveEnhancementFacts({
    roughThoughts: request.roughThoughts,
    ...(request.allowedProjectFiles
      ? { allowedProjectFiles: request.allowedProjectFiles }
      : {}),
    ...(request.project?.name ? { projectName: request.project.name } : {}),
  });
  return {
    caseId: `variant-${variant.index + 1}`,
    generationIndex: 1,
    split: "development",
    category: "interactive",
    requiredFacts: facts.requiredFacts,
    prohibitedInventions: facts.prohibitedInventions,
    request: {
      target: request.target,
      roughThoughts: request.roughThoughts,
      project: null,
      allowedProjectFiles: request.allowedProjectFiles ?? [],
    },
    result: variant.run.result,
    metrics: { status: "completed" },
    responseIds: [],
    humanReview: {
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
    },
  };
}

export async function selectBestVariant(
  request: EnhancementRequest,
  variants: EnhancementVariant[],
  options: VariantJudgeOptions,
): Promise<VariantSelection> {
  if (variants.length < MIN_VARIANTS) {
    throw new Error("Variant selection requires at least two variants.");
  }
  const rubric: VariantJudgeRubric = options.rubric ?? "v1";
  const scored: ScoredVariant[] = [];
  for (const variant of variants) {
    const record = variantAsEvaluationRecord(request, variant);
    if (rubric === "v2") {
      const judged = await judgeEvaluationRecordV2(record, options);
      scored.push({
        ...variant,
        review: judged.review,
        score: Math.round(v2Mean(judged.review) * 25),
        judgeCostUsd: judged.estimatedCostUsd,
      });
    } else {
      const judged = await judgeEvaluationRecord(record, options);
      scored.push({
        ...variant,
        review: judged.review,
        score: reviewTotal(judged.review),
        judgeCostUsd: judged.estimatedCostUsd,
      });
    }
  }
  return rankVariants(scored, rubric);
}

/**
 * A hard failure always loses, whatever it scored. Ties break toward the
 * earlier variant so the same inputs always pick the same winner.
 */
export function rankVariants(
  scored: ScoredVariant[],
  rubric: VariantJudgeRubric = "v1",
): VariantSelection {
  const ranked = [...scored].sort(
    (left, right) =>
      Number(left.review.hardFailure) - Number(right.review.hardFailure) ||
      right.score - left.score ||
      left.index - right.index,
  );
  const winner = ranked[0];
  if (!winner) throw new Error("Variant selection produced no winner.");
  return {
    ranked,
    winner,
    judgeCostUsd: round(
      scored.reduce((total, item) => total + item.judgeCostUsd, 0),
    ),
    enhancementCostUsd: round(
      scored.reduce(
        (total, item) => total + item.run.usage.estimatedCostUsd,
        0,
      ),
    ),
    judgeRubric: rubric,
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
