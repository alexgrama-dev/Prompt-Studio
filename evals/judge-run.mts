#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
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
import {
  EVALUATION_JUDGE_V2_PRIVACY_DISCLOSURE,
  judgeEvaluationRecordV2,
  maximumV2JudgeCostUsd,
  v2Mean,
  type EnhancementV2JudgeDocument,
} from "../src/core/evaluation-judge-v2.ts";
import { getProviderEnhancementProfile } from "../src/core/provider-profiles.ts";

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--report");
const maxUsdIndex = args.indexOf("--max-usd");
const rubricIndex = args.indexOf("--rubric");
const confirmSpend = args.includes("--confirm-spend");
const rubric = rubricIndex >= 0 ? args[rubricIndex + 1] : "v1";
if (rubric !== "v1" && rubric !== "v2") {
  throw new Error(`Unsupported rubric: ${String(rubric)}. Use v1 or v2.`);
}

const reportPath =
  pathIndex >= 0
    ? args[pathIndex + 1]
    : (await latestEnhancementEvaluation())?.path;
if (!reportPath) {
  throw new Error(
    "No evaluation report was found. Run pnpm eval:openai first, or pass --report <path>.",
  );
}

const document = await loadEnhancementEvaluation(reportPath);

if (rubric === "v2") {
  const pending = document.records;
  const maximumCostUsd = maximumV2JudgeCostUsd(pending.length);
  console.log(
    JSON.stringify(
      {
        mode: confirmSpend ? "live" : "dry-run",
        report: reportPath,
        rubric: "v2",
        judgeProvider: "anthropic",
        cases: document.records.length,
        pendingReview: pending.length,
        maximumJudgeCostUsd: maximumCostUsd,
        privacyDisclosure: EVALUATION_JUDGE_V2_PRIVACY_DISCLOSURE,
      },
      null,
      2,
    ),
  );
  if (!confirmSpend) {
    console.log(
      "\nDry run only. A live v2 run additionally requires --confirm-spend, --max-usd <limit>, and ANTHROPIC_API_KEY.",
    );
    process.exit(0);
  }
  const maxUsd = Number(maxUsdIndex >= 0 ? args[maxUsdIndex + 1] : Number.NaN);
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
    throw new Error(
      "A positive --max-usd limit is required for a live judging run.",
    );
  }
  if (maximumCostUsd > maxUsd) {
    throw new Error(
      `The maximum judging estimate $${maximumCostUsd.toFixed(2)} exceeds the approved --max-usd $${maxUsd.toFixed(2)}.`,
    );
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for a live v2 judging run.");
  }
  let spent = 0;
  const judgedRecords = [];
  for (const [index, record] of pending.entries()) {
    const worstCaseRemaining = maximumV2JudgeCostUsd(pending.length - index);
    if (spent + worstCaseRemaining > maxUsd) {
      console.log(
        `Stopping before ${record.caseId}: continuing could exceed the approved $${maxUsd.toFixed(2)}.`,
      );
      break;
    }
    const judged = await judgeEvaluationRecordV2(record, { apiKey });
    spent += judged.estimatedCostUsd;
    judgedRecords.push(judged);
    process.stdout.write(
      `[${index + 1}/${pending.length}] ${judged.caseId} · mean ${v2Mean(judged.review)}/4${judged.review.hardFailure ? " · HARD FAILURE" : ""}\n`,
    );
  }
  const sidecar: EnhancementV2JudgeDocument = {
    schemaVersion: 2,
    sourceReport: reportPath,
    judgeProvider: "anthropic",
    judgeModel: getProviderEnhancementProfile("anthropic-sonnet-5-v1").model,
    rubric: "v2",
    records: judgedRecords,
  };
  const sidecarPath = reportPath.replace(/\.json$/u, ".v2.json");
  await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      {
        report: sidecarPath,
        judgedCases: judgedRecords.length,
        actualJudgeCostUsd: Math.round(spent * 10_000) / 10_000,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const pending = pendingJudgeRecords(document);
const maximumCostUsd = maximumJudgeCostUsd(pending.length);

console.log(
  JSON.stringify(
    {
      mode: confirmSpend ? "live" : "dry-run",
      report: reportPath,
      rubric: "v1",
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
  throw new Error(
    "A positive --max-usd limit is required for a live judging run.",
  );
}
if (maximumCostUsd > maxUsd) {
  throw new Error(
    `The maximum judging estimate $${maximumCostUsd.toFixed(2)} exceeds the approved --max-usd $${maxUsd.toFixed(2)}.`,
  );
}
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey)
  throw new Error("OPENAI_API_KEY is required for a live judging run.");

let spent = 0;
let latest = document;
for (const [index, record] of pending.entries()) {
  const worstCaseRemaining = maximumJudgeCostUsd(pending.length - index);
  if (spent + worstCaseRemaining > maxUsd) {
    console.log(
      `Stopping before ${record.caseId}: continuing could exceed the approved $${maxUsd.toFixed(2)}.`,
    );
    break;
  }
  const judged = await judgeEvaluationRecord(record, { apiKey });
  spent += judged.estimatedCostUsd;
  latest = await recordEnhancementEvaluationReview(
    reportPath,
    judged.caseId,
    judged.review,
    record.generationIndex,
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

if (!summary.passing) process.exitCode = 1;
