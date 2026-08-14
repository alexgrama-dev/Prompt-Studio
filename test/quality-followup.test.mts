import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyQualityFollowup,
  rewriteInstructionFromQuality,
} from "../src/core/quality-followup.ts";
import {
  outcomeLessonCompilerSection,
  recallOutcomeLessons,
} from "../src/core/outcome-lessons.ts";
import {
  enhancementHistoryMarkdown,
  enhancementHistoryMatches,
  enhancementHistoryRowSummary,
  withHistoryQuality,
} from "../src/core/enhancement-history.ts";
import {
  parsePrompt,
  serializePrompt,
  type PromptRecord,
} from "../src/core/prompt-store.ts";
import type { PromptUseFeedbackRecord } from "../src/core/feedback-store.ts";

test("low quality scores classify rewrite versus missing input", () => {
  assert.equal(classifyQualityFollowup(8, "Ready to run.").low, false);
  assert.equal(classifyQualityFollowup(7, "Barely executable.").rewrite, false);
  const rewrite = classifyQualityFollowup(5, "The success check is unnamed.");
  assert.equal(rewrite.low, true);
  assert.equal(rewrite.rewrite, true);
  assert.equal(rewrite.needEvidence, false);
  assert.match(
    rewriteInstructionFromQuality("The success check is unnamed."),
    /The success check is unnamed/,
  );
  const evidence = classifyQualityFollowup(4, "No log was supplied.");
  assert.equal(evidence.rewrite, false);
  assert.equal(evidence.needEvidence, true);
  const project = classifyQualityFollowup(3, "No repository is attached.");
  assert.equal(project.rewrite, false);
  assert.equal(project.needProject, true);
});

test("outcome lessons keep failed feedback and omit useful runs", () => {
  const useful = feedbackRecord({
    id: "useful",
    verdict: "useful",
    outcomeStatus: "succeeded",
  });
  const failed = feedbackRecord({
    id: "failed",
    verdict: "not-useful",
    critique: "Guessed a retry.",
    correction: "Require the timeout cause.",
    outcomeStatus: "failed",
  });
  const lessons = recallOutcomeLessons([useful, failed]);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0]?.critique, "Guessed a retry.");
  const section = outcomeLessonCompilerSection(lessons);
  assert.match(section, /do not copy as project facts/i);
  assert.match(section, /Guessed a retry/);
});

test("enhancement history search and markdown keep score and save state", () => {
  const record = historyRecord();
  assert.equal(enhancementHistoryMatches(record, ""), true);
  assert.equal(enhancementHistoryMatches(record, "6/10"), true);
  assert.equal(enhancementHistoryMatches(record, "no log"), true);
  assert.equal(enhancementHistoryMatches(record, "unrelated-query"), false);
  const markdown = enhancementHistoryMarkdown(record, {
    savedToLibrary: false,
    used: false,
  });
  assert.match(markdown, /\*\*Saved to library:\*\* No/);
  assert.match(markdown, /\*\*Used:\*\* No/);
  assert.match(markdown, /\*\*Score:\*\* 6\/10/);
  assert.match(markdown, /No log was supplied/);
});

test("history row summary stays short and readable without score", () => {
  const record = historyRecord();
  assert.equal(
    enhancementHistoryRowSummary(record, {
      savedToLibrary: false,
      used: false,
    }),
    "6/10 · Unsaved · Unused · P2/3 · Gemini 3.7 · $0.0123",
  );
  const legacy = historyRecord();
  delete legacy.enhancement?.quality;
  if (legacy.enhancement) {
    delete legacy.enhancement.generationRole;
    delete legacy.enhancement.generationPass;
    delete legacy.enhancement.generationPassCount;
    delete legacy.enhancement.estimatedCostUsd;
    legacy.enhancement.model = "gpt-5.6-terra";
  }
  assert.equal(
    enhancementHistoryRowSummary(legacy, {
      savedToLibrary: true,
      used: true,
      useCount: 3,
    }),
    "Saved · Used 3 · Terra",
  );
});

test("enhancement provenance round-trips optional quality fields", () => {
  const record = historyRecord();
  const parsed = parsePrompt(serializePrompt(record, record.body));
  assert.equal(parsed.enhancement?.quality?.score, 6);
  assert.equal(parsed.enhancement?.generationRole, "candidate");
  assert.equal(parsed.enhancement?.generationPass, 2);
  assert.equal(parsed.enhancement?.estimatedCostUsd, 0.0123);
});

test("history quality write keeps existing provenance", () => {
  const record = historyRecord();
  const next = withHistoryQuality(record.enhancement, {
    score: 4,
    rationale: "No log was supplied.",
    model: "gemini-3.7-flash",
    estimatedCostUsd: 0.002,
  });
  assert.equal(next.model, "gemini-3.7-flash");
  assert.equal(next.quality?.score, 4);
  assert.equal(next.profileId, "google-gemini-3.7-flash-v1");
  assert.throws(
    () =>
      withHistoryQuality(undefined, {
        score: 4,
        rationale: "No log was supplied.",
        model: "gemini-3.7-flash",
        estimatedCostUsd: 0.002,
      }),
    /provenance/,
  );
});

function historyRecord(): PromptRecord {
  return {
    schemaVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    title: "Diagnose login timeout",
    summary: "Find the timeout cause.",
    target: "codex",
    tags: ["timeout"],
    aliases: [],
    searchTerms: ["login timeout"],
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
    favorite: false,
    body: "Inspect the timeout. Do not add retries.",
    filePath: "/tmp/history.md",
    seed: { thoughts: "login hangs" },
    enhancement: {
      provider: "google",
      profileId: "google-gemini-3.7-flash-v1",
      model: "gemini-3.7-flash",
      reasoningEffort: "low",
      compilerVersion: "prompt-studio-compiler/1.3.0",
      outputSchemaVersion: 1,
      generatedAt: "2026-08-14T12:00:00.000Z",
      quality: {
        score: 6,
        rationale: "No log was supplied.",
        model: "gemini-3.7-flash",
        estimatedCostUsd: 0.001,
      },
      generationRole: "candidate",
      generationPass: 2,
      generationPassCount: 3,
      estimatedCostUsd: 0.0123,
    },
  };
}

function feedbackRecord(options: {
  id: string;
  verdict: PromptUseFeedbackRecord["verdict"];
  critique?: string;
  correction?: string;
  outcomeStatus?: NonNullable<PromptUseFeedbackRecord["outcome"]>["status"];
}): PromptUseFeedbackRecord {
  return {
    schemaVersion: 1,
    id: options.id,
    revision: 1,
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
    prompt: {
      promptId: "22222222-2222-4222-8222-222222222222",
      promptUpdatedAt: "2026-08-14T12:00:00.000Z",
      sourceDigest: "a".repeat(64),
      snapshotDigest: "b".repeat(64),
      title: "Diagnose login timeout",
      summary: "Find the timeout cause.",
      body: "Inspect the timeout.",
      target: "codex",
      tags: [],
      aliases: [],
      searchTerms: [],
    },
    use: {
      usedAt: "2026-08-14T12:00:00.000Z",
      targetAgent: "codex",
    },
    verdict: options.verdict,
    ...(options.critique ? { critique: options.critique } : {}),
    ...(options.correction ? { correction: options.correction } : {}),
    ...(options.outcomeStatus
      ? { outcome: { status: options.outcomeStatus } }
      : {}),
    filePath: `/tmp/${options.id}.json`,
  };
}
