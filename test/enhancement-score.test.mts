import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { appendExecutionGuardrails } from "../src/core/enhancement.ts";
import type { EnhancementResult } from "../src/core/enhancement.ts";
import {
  enhancementReviewWatch,
  formatEnhancementReviewScore,
  REVIEW_SCORE_MAXIMUM,
  scoreEnhancementReview,
} from "../src/core/enhancement-score.ts";

const CLEAN_PROMPT = [
  "Fix the upload control so a click starts the expected upload.",
  "Inspect the current handler before changing it.",
  "Done when a click starts an upload.",
  "Ask when the expected file type is unknown.",
  "Do not redesign the form.",
].join("\n");

test("the enhance review score is local, compact, and uses the existing critique", () => {
  const clean = scoreEnhancementReview({
    roughThoughts:
      "upload button does nothing. expected: a click starts an upload. actual: noop.",
    result: scoredResult({
      enhancedPrompt: CLEAN_PROMPT,
      missingInformation: [],
    }),
  });

  assert.equal(clean.clarity.score, REVIEW_SCORE_MAXIMUM);
  assert.equal(clean.constraints.score, REVIEW_SCORE_MAXIMUM);
  assert.equal(clean.missingContext.score, REVIEW_SCORE_MAXIMUM);
  assert.equal(
    formatEnhancementReviewScore(clean),
    "Clarity 5/5 · Constraints 5/5 · Missing context 5/5",
  );
  assert.equal(enhancementReviewWatch(clean), undefined);

  const weakPrompt = [
    "You are an expert. Make it good and ensure quality.",
    "The app uses Next.js. Edit src/invented/upload-handler.ts.",
    "CRITICAL. IMPORTANT. WARNING.",
  ].join("\n");
  const weak = scoreEnhancementReview({
    roughThoughts: "upload button does nothing",
    result: scoredResult({
      enhancedPrompt: weakPrompt,
      assumptions: [],
      missingInformation: [],
    }),
  });

  assert.ok(weak.clarity.score < REVIEW_SCORE_MAXIMUM);
  assert.ok(weak.constraints.score < REVIEW_SCORE_MAXIMUM);
  assert.ok(weak.missingContext.score < REVIEW_SCORE_MAXIMUM);
  assert.match(
    formatEnhancementReviewScore(weak),
    /^Clarity \d\/5 · Constraints \d\/5 · Missing context \d\/5$/,
  );
  assert.ok(enhancementReviewWatch(weak));

  const listedGaps = scoreEnhancementReview({
    roughThoughts: "the api call is broken. find the cause.",
    result: scoredResult({
      enhancedPrompt: CLEAN_PROMPT,
      missingInformation: [
        "Expected versus actual behavior and failure evidence are unnamed.",
      ],
    }),
  });
  assert.equal(listedGaps.missingContext.score, REVIEW_SCORE_MAXIMUM);

  const buriedGaps = scoreEnhancementReview({
    roughThoughts: "the api call is broken. find the cause.",
    result: scoredResult({
      enhancedPrompt: CLEAN_PROMPT,
      missingInformation: [],
    }),
  });
  assert.equal(buriedGaps.missingContext.score, 3);
  assert.equal(
    enhancementReviewWatch(buriedGaps),
    "Blocking gaps were not listed as missing information.",
  );

  const withGuardrails = scoreEnhancementReview({
    roughThoughts:
      "upload button does nothing. expected: a click starts an upload. actual: noop.",
    result: scoredResult({
      enhancedPrompt: appendExecutionGuardrails(CLEAN_PROMPT, "codex"),
      missingInformation: [],
    }),
  });
  assert.equal(
    formatEnhancementReviewScore(withGuardrails),
    formatEnhancementReviewScore(clean),
  );
});

test("the enhance review shows the score without a new screen or credential wall", async () => {
  const source = await readFile("src/enhance-prompt.tsx", "utf8");
  const preview = source.slice(
    source.indexOf("function EnhancementPreview("),
    source.indexOf("function EnhancementEditor("),
  );

  assert.match(preview, /scoreEnhancementReview\(/);
  assert.match(preview, /title="Score"/);
  assert.match(preview, /formatEnhancementReviewScore\(reviewScore\)/);
  assert.match(preview, /title="Copy Prompt"/);
  assert.match(preview, /title="Save to Prompt Library"/);

  const scoreIndex = preview.indexOf('title="Score"');
  const copyIndex = preview.indexOf('title="Copy Prompt"');
  const saveIndex = preview.indexOf('title="Save to Prompt Library"');
  assert.ok(scoreIndex > 0 && copyIndex > scoreIndex && saveIndex > copyIndex);

  assert.doesNotMatch(preview, /judgeEvaluationRecord\(/);
  assert.doesNotMatch(preview, /openaiApiKey/);
  assert.doesNotMatch(source, /title="Prompt Score Dashboard"/);
});

function scoredResult(
  overrides: Partial<EnhancementResult> &
    Pick<EnhancementResult, "enhancedPrompt">,
): EnhancementResult {
  return {
    title: "Fix the upload control",
    summary: "Restore the expected click-to-upload behavior.",
    target: "codex",
    assumptions: [],
    missingInformation: [],
    validationSteps: ["Click the control and confirm an upload starts."],
    tags: ["upload", "bug-fix", "ui"],
    aliases: ["fix upload"],
    searchTerms: Array.from(
      { length: 20 },
      (_, index) => `upload control phrase ${index + 1}`,
    ),
    taxonomy: {
      taskTypes: ["bug-fix"],
      technologies: ["ui"],
      artifacts: ["upload-control"],
      problems: ["broken-click"],
      workflows: ["repair"],
    },
    projectFiles: [],
    sources: [],
    ...overrides,
  };
}
