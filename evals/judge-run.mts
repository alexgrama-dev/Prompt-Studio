#!/usr/bin/env node

import {
  evaluationReviewSummary,
  latestEnhancementEvaluation,
  loadEnhancementEvaluation,
  recordEnhancementEvaluationReview,
} from "../src/core/evaluation.ts";
import {
  EVALUATION_JUDGE_PRIVACY_DISCLOSURE,
  judgeEvaluationRecord,
  maximumJudgeCostUsd,
  pendingJudgeRecords,
} from "../src/core/evaluation-judge.ts";

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--report");
const maxUsdIndex = args.indexOf("--max-usd");
const confirmSpend = args.includes("--confirm-spend");

const reportPath =
  pathIndex >= 0 ? args[pathIndex + 1] : (await latestEnhancementEvaluation())?.path;
if (!reportPath) {
  throw new Error(
    "No evaluation report was found. Run pnpm eval:openai first, or pass --report <path>.",
  );
}

const document = await loadEnhancementEvaluation(reportPath);
const pending = pendingJudgeRecords(document);
const maximumCostUsd = maximumJudgeCostUsd(pending.length);

console.log(
  JSON.stringify(
    {
      mode: confirmSpend ? "live" : "dry-run",
      report: reportPath,
      cases: document.records.length,
      pendingReview: pending.length,
      maximumJudgeCostUsd: maximumCostUsd,
      privacyDisclosure: EVALUATION_JUDGE_PRIVACY_DISCLOSURE,
    },
    null,
    2,
  ),
);

if (!confirmSpend) {
  console.log(
    "\nDry run only. A live run additionally requires --confirm-spend, --max-usd <limit>, and OPENAI_API_KEY.",
  );
  process.exit(0);
}

const maxUsd = Number(maxUsdIndex >= 0 ? args[maxUsdIndex + 1] : Number.NaN);
if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
  throw new Error("A positive --max-usd limit is required for a live judging run.");
}
if (maximumCostUsd > maxUsd) {
  throw new Error(
    `The maximum judging estimate $${maximumCostUsd.toFixed(2)} exceeds the approved --max-usd $${maxUsd.toFixed(2)}.`,
  );
}
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY is required for a live judging run.");

let spent = 0;
let latest = document;
for (const [index, record] of pending.entries()) {
  const judged = await judgeEvaluationRecord(record, { apiKey });
  spent += judged.estimatedCostUsd;
  latest = await recordEnhancementEvaluationReview(
    reportPath,
    judged.caseId,
    judged.review,
  );
  const total =
    judged.review.fidelity +
    judged.review.completeness +
    judged.review.unsupportedFacts +
    judged.review.actionability +
    judged.review.validation +
    judged.review.authorization +
    judged.review.appropriateLength;
  process.stdout.write(
    `[${index + 1}/${pending.length}] ${judged.caseId} · ${total}/100${judged.review.hardFailure ? " · HARD FAILURE" : ""} · facts ${judged.coverage.requiredFacts}/${record.requiredFacts.length}\n`,
  );
}

const summary = latest.reviewSummary ?? evaluationReviewSummary(latest.records);
console.log(
  JSON.stringify(
    {
      report: reportPath,
      judgedCases: pending.length,
      actualJudgeCostUsd: Math.round(spent * 10_000) / 10_000,
      summary,
    },
    null,
    2,
  ),
);

// A failing gate must fail the command, so this can run in a check pipeline.
if (!summary.passing) process.exitCode = 1;
