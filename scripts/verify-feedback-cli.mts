#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { FEATURES } from "../src/core/features.ts";

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
  payload?: {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: { code: string };
  };
}

const root = await mkdtemp(join(tmpdir(), "prompt-studio-feedback-bundle-"));
const cliPath = resolve("dist-cli/cli/prompt-studio.mjs");
const disabledLibrary = join(root, "disabled-library");
const library = join(root, "library");
const featureConfig = join(root, "features.json");

try {
  assert.equal(
    existsSync(cliPath),
    true,
    "Build the CLI before running the feedback bundle proof.",
  );

  const disabled = runCli(
    ["feedback", "list", "--json", "--library", disabledLibrary],
    undefined,
  );
  assert.equal(disabled.status, 3);
  assert.equal(disabled.payload?.error?.code, "FEATURE_DISABLED");
  assert.equal(existsSync(disabledLibrary), false);

  const checkedAt = new Date("2026-07-19T00:00:00.000Z").toISOString();
  const overrides = Object.fromEntries(
    FEATURES.filter(
      (feature) => feature.activationOrder > 0 && feature.activationOrder <= 14,
    ).map((feature) => [
      feature.id,
      feature.id === "feedback"
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
  ];
  const created = runCli(
    ["create", "--yes", "--input", "-", ...common],
    JSON.stringify({
      title: "Verify Feedback Bundle",
      summary: "Exercise the compiled feedback workflow.",
      body: "Review this prompt with concrete evidence.",
      target: "codex",
      tags: ["verification"],
      aliases: ["feedback proof"],
      searchTerms: ["compiled feedback workflow"],
    }),
  );
  assertSuccess(created);
  const promptId = stringField(created, "id");

  const feedbackInput = JSON.stringify({
    targetAgent: "codex",
    targetApplication: "Codex Desktop",
    verdict: "useful",
    rating: 4,
    critique: "The prompt produced a concrete review.",
  });
  const unconfirmed = runCli(
    ["feedback", "add", promptId, "--input", "-", ...common],
    feedbackInput,
  );
  assert.equal(unconfirmed.status, 2);
  assert.equal(existsSync(join(library, ".feedback")), false);

  const added = runCli(
    ["feedback", "add", promptId, "--yes", "--input", "-", ...common],
    feedbackInput,
  );
  assertSuccess(added);
  assert.equal("filePath" in (added.payload?.data ?? {}), false);
  const feedbackId = stringField(added, "id");
  const originalDigest = nestedStringField(
    added,
    ["prompt", "snapshotDigest"],
    "prompt snapshot digest",
  );

  const updated = runCli(
    [
      "feedback",
      "update",
      feedbackId.slice(0, 8),
      "--yes",
      "--input",
      "-",
      ...common,
    ],
    JSON.stringify({
      verdict: "not-useful",
      rating: null,
      outcomeStatus: "failed",
      outcomeSummary: "The review missed the ownership boundary.",
    }),
  );
  assertSuccess(updated);
  assert.equal(updated.payload?.data?.revision, 2);
  assert.equal(
    nestedStringField(
      updated,
      ["prompt", "snapshotDigest"],
      "updated prompt snapshot digest",
    ),
    originalDigest,
  );

  const exported = runCli(
    [
      "feedback",
      "export",
      promptId.slice(0, 8),
      "--format",
      "markdown",
      ...common,
    ],
    undefined,
  );
  assertSuccess(exported);
  assert.match(String(exported.payload?.data?.content), /Prompt Snapshot/);
  assert.equal(String(exported.payload?.data?.content).includes(root), false);

  const deleted = runCli(
    ["feedback", "delete", feedbackId, "--yes", ...common],
    undefined,
  );
  assertSuccess(deleted);

  const feedbackAfterDelete = runCli(
    ["feedback", "list", ...common],
    undefined,
  );
  assertSuccess(feedbackAfterDelete);
  assert.equal(feedbackAfterDelete.payload?.data?.count, 0);

  const promptAfterDelete = runCli(["get", promptId, ...common], undefined);
  assertSuccess(promptAfterDelete);

  console.log(
    JSON.stringify(
      {
        ok: true,
        cliPath,
        disabledTouchedData: existsSync(disabledLibrary),
        confirmationRequired: unconfirmed.status === 2,
        feedbackCreated: true,
        immutableSnapshotPreserved: true,
        exportRedactedRuntimePath: true,
        feedbackDeleted: true,
        promptPreserved: true,
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
  let payload: CliResult["payload"];
  if (stdout.trim()) {
    payload = JSON.parse(stdout) as CliResult["payload"];
  }
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

function stringField(result: CliResult, key: string): string {
  const value = result.payload?.data?.[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string field ${key}.`);
  }
  return value;
}

function nestedStringField(
  result: CliResult,
  path: string[],
  label: string,
): string {
  let value: unknown = result.payload?.data;
  for (const key of path) {
    assert.equal(
      typeof value,
      "object",
      `Expected object while reading ${label}.`,
    );
    assert.notEqual(value, null, `Expected object while reading ${label}.`);
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string.`);
  }
  return value;
}
