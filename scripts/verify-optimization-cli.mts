#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { FEATURES } from "../src/core/features.ts";

interface CliPayload {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    details?: Record<string, unknown>;
  };
}

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
  payload?: CliPayload;
}

const root = await mkdtemp(
  join(tmpdir(), "prompt-studio-optimization-bundle-"),
);
const cliPath = resolve("dist-cli/cli/prompt-studio.mjs");
const featureConfig = join(root, "features.json");
const library = join(root, "library");
const proposals = join(root, "proposals");
const compilerState = join(root, "compiler-state.json");
const disabledProposals = join(root, "disabled-proposals");

try {
  assert.equal(
    existsSync(cliPath),
    true,
    "Build the CLI before running the optimization bundle proof.",
  );

  const disabled = runCli(
    ["optimization", "list", "--json", "--optimization-dir", disabledProposals],
    undefined,
  );
  assert.equal(disabled.status, 3);
  assert.equal(disabled.payload?.error?.code, "FEATURE_DISABLED");
  assert.equal(existsSync(disabledProposals), false);

  const checkedAt = "2026-07-19T00:00:00.000Z";
  const overrides = Object.fromEntries(
    FEATURES.filter(
      (feature) => feature.activationOrder > 0 && feature.activationOrder <= 16,
    ).map((feature) => [
      feature.id,
      feature.id === "optimization"
        ? { state: "preview" }
        : {
            state: "active",
            verification: {
              status: "passed",
              checkedAt,
              command: "isolated compiled CLI verification",
            },
          },
    ]),
  );
  await writeFile(featureConfig, `${JSON.stringify(overrides, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  const common = [
    "--json",
    "--library",
    library,
    "--feature-config",
    featureConfig,
    "--optimization-dir",
    proposals,
    "--compiler-state",
    compilerState,
  ];
  const createdPrompt = runCli(
    ["create", "--yes", "--input", "-", ...common],
    JSON.stringify({
      title: "Verify Optimization Bundle",
      summary: "Exercise the compiled optimization workflow.",
      body: "Review state ownership and cite each boundary.",
      target: "codex",
      tags: ["verification"],
      aliases: ["optimization proof"],
      searchTerms: ["compiled optimization workflow"],
    }),
  );
  assertSuccess(createdPrompt);
  const promptId = dataString(createdPrompt, "id");

  const useful = runCli(
    ["feedback", "add", promptId, "--yes", "--input", "-", ...common],
    JSON.stringify({
      targetAgent: "codex",
      verdict: "useful",
      critique: "The evidence-first structure found one hidden owner.",
    }),
  );
  assertSuccess(useful);
  const usefulId = dataString(useful, "id");

  const notUseful = runCli(
    ["feedback", "add", promptId, "--yes", "--input", "-", ...common],
    JSON.stringify({
      targetAgent: "codex",
      verdict: "not-useful",
      rating: 2,
      correction:
        "Require the reviewer to trace every mutable value back to one owner.",
    }),
  );
  assertSuccess(notUseful);
  const notUsefulId = dataString(notUseful, "id");

  const caseIds = [
    "dev-debug-intermittent-api",
    "dev-implement-cache",
    "val-data-reconcile",
    "val-accessibility-modal",
    "protected-no-delete",
  ];
  const candidateDrafts = [
    {
      id: "ownership-trace",
      title: "Trace Every Owner",
      addendum:
        "When a task concerns ownership or shared state, require the agent to trace each mutable value to one authoritative owner and cite every cross-boundary write before proposing a change.",
      rationale:
        "Makes the missing ownership trace explicit while retaining evidence-first review.",
      addressesFeedbackIds: [usefulId, notUsefulId],
    },
    {
      id: "concise-evidence",
      title: "Concise Evidence Table",
      addendum:
        "For review tasks with several findings, request a concise evidence table mapping each finding to its owner, boundary, observed behavior, and smallest justified correction.",
      rationale:
        "Keeps the result compact while making evidence and corrective action easier to compare.",
      addressesFeedbackIds: [notUsefulId],
    },
  ];
  const unconfirmedCreate = runCli(
    ["optimization", "create", "--input", "-", ...common],
    JSON.stringify({
      title: "Compiled ownership optimizer",
      feedbackIds: [usefulId, notUsefulId],
      evaluationCaseIds: caseIds,
      candidates: candidateDrafts,
    }),
  );
  assert.equal(unconfirmedCreate.status, 2);
  assert.equal(existsSync(proposals), false);

  const createdProposal = runCli(
    ["optimization", "create", "--yes", "--input", "-", ...common],
    JSON.stringify({
      title: "Compiled ownership optimizer",
      feedbackIds: [usefulId, notUsefulId],
      evaluationCaseIds: caseIds,
      candidates: candidateDrafts,
    }),
  );
  assertSuccess(createdProposal);
  const proposalId = dataString(createdProposal, "id");
  assert.equal(createdProposal.stdout.includes(proposals), false);

  const scores = scoreMatrix(caseIds, {
    baseline: {
      development: 86,
      validation: 86,
      protected: 88,
      cost: 0.01,
    },
    "ownership-trace": {
      development: 91,
      validation: 90,
      protected: 90,
      cost: 0.011,
    },
    "concise-evidence": {
      development: 88,
      validation: 87,
      protected: 88,
      cost: 0.009,
    },
  });
  const evaluated = runCli(
    [
      "optimization",
      "evaluate",
      proposalId,
      "--yes",
      "--input",
      "-",
      ...common,
    ],
    JSON.stringify({ scores }),
  );
  assertSuccess(evaluated);
  assert.equal(evaluated.payload?.data?.status, "ready-for-approval");

  const approvalPreview = runCli(
    ["optimization", "approve", proposalId, "ownership-trace", ...common],
    undefined,
  );
  assert.equal(approvalPreview.status, 2);
  const policyDigest = String(
    approvalPreview.payload?.error?.details?.policyDigest ?? "",
  );
  assert.match(policyDigest, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(compilerState), false);

  const approved = runCli(
    [
      "optimization",
      "approve",
      proposalId,
      "ownership-trace",
      "--yes",
      "--digest",
      policyDigest,
      ...common,
    ],
    undefined,
  );
  assertSuccess(approved);
  assert.equal(
    (
      approved.payload?.data?.activeCompiler as
        | Record<string, unknown>
        | undefined
    )?.digest,
    policyDigest,
  );

  const proposal = runCli(
    ["optimization", "get", proposalId, ...common],
    undefined,
  );
  assertSuccess(proposal);
  const baselineDigest = String(
    (proposal.payload?.data?.baseline as Record<string, unknown> | undefined)
      ?.digest ?? "",
  );
  assert.match(baselineDigest, /^[a-f0-9]{64}$/);
  const rolledBack = runCli(
    ["optimization", "rollback", baselineDigest, "--yes", ...common],
    undefined,
  );
  assertSuccess(rolledBack);

  const exported = runCli(
    ["optimization", "export", proposalId, "--format", "markdown", ...common],
    undefined,
  );
  assertSuccess(exported);
  assert.match(String(exported.payload?.data?.content), /Instruction Diff/);
  assert.equal(String(exported.payload?.data?.content).includes(root), false);

  const acceptedDelete = runCli(
    ["optimization", "delete", proposalId, "--yes", ...common],
    undefined,
  );
  assert.equal(acceptedDelete.status, 6);
  assert.equal(existsSync(proposals), true);

  console.log(
    JSON.stringify(
      {
        ok: true,
        cliPath,
        disabledTouchedData: existsSync(disabledProposals),
        createConfirmationRequired: unconfirmedCreate.status === 2,
        proposalCreated: true,
        evaluatedWinner: "ownership-trace",
        exactDigestRequired: true,
        compilerAccepted: true,
        compilerRolledBack: true,
        acceptedProposalPreserved: true,
        exportRedactedRuntimePath: true,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

function runCli(args: string[], input: string | undefined): CliResult {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
  });
  const stdout = result.stdout ?? "";
  const payload = stdout.trim()
    ? (JSON.parse(stdout) as CliPayload)
    : undefined;
  return {
    status: result.status ?? 1,
    stdout,
    stderr: result.stderr ?? "",
    ...(payload ? { payload } : {}),
  };
}

function assertSuccess(result: CliResult): void {
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || "Compiled CLI command failed.",
  );
  assert.equal(result.payload?.ok, true);
}

function dataString(result: CliResult, key: string): string {
  const value = result.payload?.data?.[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string data field ${key}.`);
  }
  return value;
}

function scoreMatrix(
  caseIds: string[],
  subjects: Record<
    string,
    {
      development: number;
      validation: number;
      protected: number;
      cost: number;
    }
  >,
) {
  return Object.entries(subjects).flatMap(([subjectId, profile]) =>
    caseIds.map((caseId) => {
      const split = caseId.startsWith("dev-")
        ? "development"
        : caseId.startsWith("val-")
          ? "validation"
          : "protected";
      const total = profile[split];
      return {
        subjectId,
        caseId,
        split,
        scores: rubric(total),
        total,
        hardFailure: false,
        latencyMs: 1_000,
        estimatedCostUsd: profile.cost,
        reviewed: true,
      };
    }),
  );
}

function rubric(total: number) {
  const scores = {
    fidelity: 25,
    completeness: 20,
    unsupportedFacts: 20,
    actionability: 15,
    validation: 10,
    authorization: 5,
    appropriateLength: 5,
  };
  let remaining = 100 - total;
  for (const criterion of [
    "appropriateLength",
    "authorization",
    "validation",
    "actionability",
    "completeness",
    "unsupportedFacts",
    "fidelity",
  ] as const) {
    const reduction = Math.min(scores[criterion], remaining);
    scores[criterion] -= reduction;
    remaining -= reduction;
  }
  assert.equal(remaining, 0);
  return scores;
}
