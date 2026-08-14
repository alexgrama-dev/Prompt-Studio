import assert from "node:assert/strict";
import test from "node:test";
import {
  antiPatternSaveError,
  enhancementSaveBlocked,
  type AntiPatternFinding,
} from "../src/core/anti-patterns.ts";
import {
  applyElicitationAnswers,
  compilerGapAddendum,
  planCompilerStages,
} from "../src/core/compiler-pipeline.ts";
import {
  parseEnhanceLastSetup,
  serializeEnhanceLastSetup,
} from "../src/core/enhance-last-setup.ts";
import { deriveEnhancementFacts } from "../src/core/enhancement-facts.ts";
import {
  enhancementCompilerInstructions,
  type EnhancementRequest,
} from "../src/core/enhancement.ts";
import { loadDownstreamFixtures } from "../src/core/evaluation-downstream.ts";
import {
  recallSimilarPrompts,
  similarPromptCompilerSection,
} from "../src/core/similar-prompts.ts";
import { variantAsEvaluationRecord } from "../src/core/variant-selection.ts";
import type { PromptRecord } from "../src/core/prompt-store.ts";

function promptRecord(
  overrides: Pick<PromptRecord, "id" | "title" | "body"> &
    Partial<PromptRecord>,
): PromptRecord {
  return {
    schemaVersion: 1,
    summary: "",
    target: "codex",
    tags: [],
    aliases: [],
    searchTerms: [],
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    favorite: false,
    filePath: `/tmp/${overrides.id}.md`,
    ...overrides,
  };
}

function request(
  overrides: Partial<EnhancementRequest> = {},
): EnhancementRequest {
  return {
    roughThoughts:
      "The API call fails sometimes. Find the cause with evidence and do not just add retries.",
    target: "codex",
    profileId: "openai-standard-v1",
    researchLevel: "none",
    ...overrides,
  };
}

test("last Enhance setup parses only a valid target and project path", () => {
  assert.equal(parseEnhanceLastSetup(undefined), undefined);
  assert.equal(parseEnhanceLastSetup("not json"), undefined);
  assert.equal(parseEnhanceLastSetup('{"target":"codex"}'), undefined);
  const setup = { target: "claude-code" as const, project: "/work/app" };
  assert.deepEqual(
    parseEnhanceLastSetup(serializeEnhanceLastSetup(setup)),
    setup,
  );
});

test("derived facts keep must/never sentences and named files", () => {
  const facts = deriveEnhancementFacts({
    roughThoughts:
      "Fix src/core/add.ts. Expected 4, actual 3. Must not add retries. Never deploy.",
    projectName: "prompt-studio",
    allowedProjectFiles: ["src/core/add.ts"],
  });
  assert.ok(facts.requiredFacts.some((fact) => /retries/i.test(fact)));
  assert.ok(facts.requiredFacts.some((fact) => fact.includes("src/core/add.ts")));
  assert.ok(
    facts.prohibitedInventions.some((item) => /already passed/i.test(item)),
  );
  assert.equal(
    facts.prohibitedInventions.includes(
      "Permission to implement, edit files, or apply a fix.",
    ),
    false,
  );
});

test("diagnose-only thoughts prohibit an unasked implementation", () => {
  const facts = deriveEnhancementFacts({
    roughThoughts: "Diagnose why login fails and find the cause.",
  });
  assert.ok(
    facts.prohibitedInventions.some((item) => /implement/i.test(item)),
  );
});

test("elicitation answers append to thoughts and skip leaves them unchanged", () => {
  const thoughts = "the login bug is broken";
  assert.equal(applyElicitationAnswers(thoughts, []), thoughts);
  assert.equal(
    applyElicitationAnswers(thoughts, [
      { question: "Expected versus actual behavior is unnamed.", answer: "  " },
    ]),
    thoughts,
  );
  const filled = applyElicitationAnswers(thoughts, [
    {
      question: "Expected versus actual behavior is unnamed.",
      answer: "Expected 200, actual 500.",
    },
  ]);
  assert.match(filled, /Expected 200, actual 500/);
  assert.match(filled, /^the login bug is broken/);
});

test("bugfix without expected versus actual asks before generate", () => {
  const plan = planCompilerStages({
    roughThoughts: "the login bug is broken",
    target: "codex",
  });
  assert.equal(plan.label.class, "bugfix");
  assert.ok(plan.elicitation.questions.length > 0);
  assert.ok(plan.elicitation.questions.length <= 3);
  assert.equal(
    plan.elicitation.questions.some((question) => /unnamed|success check/i.test(question)),
    false,
  );
  assert.equal(
    plan.elicitation.questions.includes(
      "What Test or Command Proves It Is Done?",
    ),
    false,
  );
  assert.ok(
    plan.gaps.some(
      (gap) =>
        gap.bucket === "inferable" && /propose one named test/i.test(gap.detail),
    ),
  );
  assert.ok(
    plan.elicitation.questions.includes(
      "What Happens Now, and What Should Happen?",
    ),
  );
  assert.match(plan.gapAddendum, /Elicitation is off/);
  const asked = compilerGapAddendum(
    plan.label,
    plan.gaps,
    plan.elicitation,
    { elicitationAsked: true },
  );
  assert.equal(asked.includes("Elicitation is off"), false);
});

test("similar prompts are recalled as clipped compiler examples", () => {
  const records = [
    promptRecord({
      id: "api-1",
      title: "Diagnose flaky API timeouts",
      body: "Find the timeout cause. Do not add retries. Named check: pytest -q.",
    }),
    promptRecord({
      id: "api-2",
      title: "Repair the payment API timeout path",
      body: "Inspect the payment timeout in checkout.ts. Stop after the failing test is named.",
    }),
    promptRecord({
      id: "ui-1",
      title: "Restyle the empty state",
      body: "Change only the empty-state copy. Do not invent a design system.",
    }),
  ];
  assert.deepEqual(recallSimilarPrompts([], "fix the flaky api timeout"), []);
  assert.deepEqual(recallSimilarPrompts(records, "short"), []);
  const hits = recallSimilarPrompts(records, "api timeout");
  assert.ok(hits.length <= 2);
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((hit) => hit.body.length <= 800));
  const section = similarPromptCompilerSection(hits);
  assert.match(section, /Similar saved prompts/);
  assert.match(section, /Do not copy their project names/);
});

test("skipping elicitation still proposes a success check", () => {
  const plan = planCompilerStages({
    roughThoughts: "the login bug is broken",
    target: "codex",
  });
  assert.ok(
    plan.gaps.some(
      (gap) =>
        gap.bucket === "inferable" && /propose one named test/i.test(gap.detail),
    ),
  );
  const skipped = compilerGapAddendum(
    plan.label,
    plan.gaps,
    plan.elicitation,
    { elicitationAsked: true, elicitationSkipped: true },
  );
  assert.match(skipped, /Propose one named test/);
  assert.match(skipped, /Do not invent expected versus actual/);
  assert.equal(skipped.includes("Do not invent a success check"), false);
  assert.match(skipped, /missingInformation/);
  assert.equal(skipped.includes("Elicitation is off"), false);
  const asked = compilerGapAddendum(plan.label, plan.gaps, plan.elicitation, {
    elicitationAsked: true,
  });
  assert.equal(asked.includes("Do not invent expected versus actual"), false);
});

test("compiler instructions include similar examples and omit elicitation-off after questions", () => {
  const composed = enhancementCompilerInstructions({
    target: "codex",
    roughThoughts: "the login bug is broken",
    elicitationAsked: true,
    similarPromptExamples: [
      {
        title: "Diagnose flaky API timeouts",
        body: "Find the timeout cause. Do not add retries.",
      },
    ],
    outcomeLessons: [
      {
        verdict: "not-useful",
        critique: "Agent guessed a retry instead of reading the log.",
        correction: "Require the timeout cause before any code change.",
      },
    ],
  });
  assert.match(composed, /Similar saved prompts/);
  assert.match(composed, /Diagnose flaky API timeouts/);
  assert.match(composed, /Outcome lessons from later agent runs/);
  assert.match(composed, /do not copy as project facts/);
  assert.match(composed, /Agent guessed a retry/);
  assert.equal(composed.includes("Elicitation is off"), false);
  const untouched = enhancementCompilerInstructions({
    target: "codex",
    roughThoughts: "the login bug is broken",
  });
  assert.match(untouched, /Elicitation is off/);
  assert.match(untouched, /Do not invent expected versus actual/);
  assert.equal(untouched.includes("Do not invent a success check"), false);
  assert.equal(untouched.includes("Similar saved prompts"), false);
  assert.equal(untouched.includes("Outcome lessons"), false);
});

test("hard anti-patterns block library save and copy stays unblocked", () => {
  const soft: AntiPatternFinding[] = [
    { id: "length-as-quality", evidence: "padded" },
  ];
  const hard: AntiPatternFinding[] = [
    { id: "injection-passthrough", evidence: "copied instruction" },
  ];
  assert.equal(enhancementSaveBlocked(soft), false);
  assert.equal(antiPatternSaveError(soft), undefined);
  assert.equal(enhancementSaveBlocked(hard), true);
  assert.match(
    antiPatternSaveError(hard) ?? "",
    /injection-passthrough/,
  );
});

test("variant records carry derived facts instead of empty checklists", () => {
  const record = variantAsEvaluationRecord(
    request({
      roughThoughts:
        "Fix src/api.ts. Must not add retries. Never invent a new client.",
      allowedProjectFiles: ["src/api.ts"],
    }),
    {
      index: 0,
      run: {
        result: {
          title: "Fix",
          summary: "Fix",
          target: "codex",
          enhancedPrompt: "Fix src/api.ts without retries.",
          assumptions: [],
          missingInformation: [],
          validationSteps: ["python3 -m unittest -q"],
          tags: ["bugfix"],
          aliases: ["fix api"],
          searchTerms: ["api", "retries", "timeout", "unittest"],
          taxonomy: {
            taskTypes: ["bug-fix"],
            technologies: ["api"],
            artifacts: ["src/api.ts"],
            problems: ["retries"],
            workflows: ["unittest"],
          },
          projectFiles: ["src/api.ts"],
          sources: [],
        },
      } as never,
    },
  );
  assert.ok(record.requiredFacts.length > 0);
  assert.ok(record.prohibitedInventions.length > 0);
  assert.deepEqual(record.responseIds, []);
});

test("shipped downstream fixtures parse with command-shaped checks", () => {
  const fixtures = loadDownstreamFixtures("evals/fixtures");
  const ids = fixtures.map((fixture) => fixture.id).sort();
  assert.deepEqual(ids, ["bugfix-codex", "diagnose-claude", "ui-change"]);
  for (const fixture of fixtures) {
    assert.equal(fixture.repoPath.includes(".."), false);
    assert.ok(fixture.successChecks.every((check) => /\S/.test(check)));
  }
  const bugfix = fixtures.find((fixture) => fixture.id === "bugfix-codex");
  assert.match(bugfix?.successChecks[0] ?? "", /unittest/);
});
