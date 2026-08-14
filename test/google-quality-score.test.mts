import assert from "node:assert/strict";
import test from "node:test";
import {
  parseGeminiQualityScore,
  maximumGeminiQualityCostUsd,
} from "../src/core/google-quality-score.ts";
import { geminiQualityReview, rankVariants } from "../src/core/variant-selection.ts";

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
