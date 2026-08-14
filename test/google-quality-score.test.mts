import assert from "node:assert/strict";
import test from "node:test";
import {
  mapBlindRankToIndexes,
  maximumGeminiQualityCostUsd,
  parseGeminiComparativeRank,
  parseGeminiQualityScore,
  presentBlindQualityCandidates,
} from "../src/core/google-quality-score.ts";
import {
  applyGeminiComparativeRank,
  geminiQualityReview,
  isGeminiQualityReview,
  rankVariants,
  variantReviewSummary,
} from "../src/core/variant-selection.ts";

test("Gemini quality scores clamp to 1-10 and require a rationale", () => {
  assert.deepEqual(parseGeminiQualityScore({ score: 7, rationale: "Ready." }), {
    score: 7,
    rationale: "Ready.",
  });
  assert.equal(parseGeminiQualityScore({ score: 0, rationale: "Empty." }).score, 1);
  assert.equal(
    parseGeminiQualityScore({ score: 12, rationale: "Overflow." }).score,
    10,
  );
  assert.equal(
    parseGeminiQualityScore({ score: "8", rationale: "String score." }).score,
    8,
  );
  assert.throws(
    () => parseGeminiQualityScore({ score: 5, rationale: "   " }),
    /rationale/,
  );
  assert.throws(() => parseGeminiQualityScore(null), /JSON object/);
});

test("Gemini 1-10 ranking prefers the higher score and earlier index on ties", () => {
  const low = {
    index: 0,
    run: { usage: { estimatedCostUsd: 0.01 } } as never,
    score: 6,
    judgeCostUsd: 0.001,
    review: geminiQualityReview(6, "Weaker constraints."),
  };
  const high = {
    index: 1,
    run: { usage: { estimatedCostUsd: 0.01 } } as never,
    score: 9,
    judgeCostUsd: 0.001,
    review: geminiQualityReview(9, "Executable brief."),
  };
  const tied = {
    index: 2,
    run: { usage: { estimatedCostUsd: 0.01 } } as never,
    score: 9,
    judgeCostUsd: 0.001,
    review: geminiQualityReview(9, "Also executable."),
  };
  const selection = rankVariants([low, high, tied], "gemini-10");
  assert.equal(selection.winner.index, 1);
  assert.equal(selection.judgeRubric, "gemini-10");
  assert.ok(maximumGeminiQualityCostUsd(3) > maximumGeminiQualityCostUsd(1));
});

test("Gemini comparative rank accepts a permutation and Prompt B labels", () => {
  assert.deepEqual(
    parseGeminiComparativeRank(
      { order: ["B", "A", "C"], rationale: "B is shortest." },
      ["A", "B", "C"],
    ),
    { order: ["B", "A", "C"], rationale: "B is shortest." },
  );
  assert.deepEqual(
    parseGeminiComparativeRank(
      { order: ["Prompt B", "Prompt A"], rationale: "B wins." },
      ["A", "B"],
    ).order,
    ["B", "A"],
  );
  assert.throws(
    () =>
      parseGeminiComparativeRank(
        { order: ["A", "A"], rationale: "Duplicate." },
        ["A", "B"],
      ),
    /repeated/,
  );
  assert.throws(
    () =>
      parseGeminiComparativeRank(
        { order: ["A"], rationale: "Incomplete." },
        ["A", "B"],
      ),
    /every prompt once/,
  );
  assert.throws(
    () =>
      parseGeminiComparativeRank(
        { order: ["A", "Z"], rationale: "Unknown." },
        ["A", "B"],
      ),
    /unknown label/,
  );
});

test("blind presentation maps shuffled labels back to indexes", () => {
  const presented = presentBlindQualityCandidates(
    [
      { index: 0, enhancedPrompt: "one" },
      { index: 1, enhancedPrompt: "two" },
      { index: 2, enhancedPrompt: "three" },
    ],
    (items) => [items[2]!, items[0]!, items[1]!],
  );
  assert.deepEqual(
    presented.map((candidate) => ({
      label: candidate.label,
      index: candidate.index,
    })),
    [
      { label: "A", index: 2 },
      { label: "B", index: 0 },
      { label: "C", index: 1 },
    ],
  );
  assert.deepEqual(mapBlindRankToIndexes(["A", "C", "B"], presented), [2, 1, 0]);
});

test("head-to-head rank reorders 10/10 variants and keeps absolute scores", () => {
  const make = (index: number) => ({
    index,
    run: { usage: { estimatedCostUsd: 0.01 } } as never,
    score: 10,
    judgeCostUsd: 0.001,
    review: geminiQualityReview(10, "Executable."),
  });
  const selection = applyGeminiComparativeRank(
    [make(0), make(1), make(2)],
    [2, 0, 1],
    "Variant 3 is leaner.",
    0.002,
  );
  assert.equal(selection.winner.index, 2);
  assert.deepEqual(
    selection.ranked.map((variant) => variant.index),
    [2, 0, 1],
  );
  assert.equal(selection.winner.score, 10);
  assert.equal(selection.comparativeRationale, "Variant 3 is leaner.");
  assert.equal(selection.judgeCostUsd, 0.005);
  const winnerReview = selection.winner.review;
  assert.equal(isGeminiQualityReview(winnerReview), true);
  if (!isGeminiQualityReview(winnerReview)) return;
  assert.equal(winnerReview.comparativeRank, 1);
  assert.equal(winnerReview.comparativeTotal, 3);
  assert.match(variantReviewSummary(winnerReview), /Rank 1 of 3/);
  assert.throws(
    () => applyGeminiComparativeRank([make(0), make(1)], [0, 0], "Bad.", 0),
    /permutation/,
  );
});
