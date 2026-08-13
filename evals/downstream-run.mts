#!/usr/bin/env node

import { planDownstreamFromReport } from "../src/core/evaluation-downstream.ts";
import { latestEnhancementEvaluation } from "../src/core/evaluation.ts";

const args = process.argv.slice(2);
const pathIndex = args.indexOf("--report");
const confirmSpend = args.includes("--confirm-spend");
const reportPath =
  pathIndex >= 0
    ? args[pathIndex + 1]
    : (await latestEnhancementEvaluation())?.path;

if (!reportPath) {
  const plan = {
    mode: "dry-run",
    skipReason: "missing-fixtures",
    note: "No evaluation report was found. Pass --report <path> after a provider run.",
  };
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

const plan = await planDownstreamFromReport(reportPath, { confirmSpend });
console.log(JSON.stringify(plan, null, 2));
if (plan.skipReason === "missing-fixtures") {
  console.log(
    "\nDry run only. Add license-clean repos under evals/fixtures/ before a live downstream run.",
  );
} else if (plan.skipReason === "no-confirm-spend") {
  console.log(
    "\nDry run only. A live run additionally requires --confirm-spend, --max-usd <limit>, fixtures, and agent keys.",
  );
}
process.exit(0);
