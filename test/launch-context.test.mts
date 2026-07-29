import assert from "node:assert/strict";
import test from "node:test";
import { browseEmptyState } from "../src/core/browse-state.ts";
import {
  browsePromptsLaunchContext,
  enhancePromptLaunchContext,
  enhancePromptThoughtsLaunchContext,
  fallbackPromptDecision,
  ideaStudioInitialIdea,
  ideaStudioLaunchContext,
  retainPromptSelectionWhileLoading,
} from "../src/core/launch-context.ts";

test("menu-bar launch context keeps the selected prompt identity", () => {
  assert.deepEqual(browsePromptsLaunchContext("prompt-123"), {
    promptId: "prompt-123",
  });
});

test("an empty loading list cannot erase the launched prompt selection", () => {
  assert.equal(
    retainPromptSelectionWhileLoading("prompt-123", null, true),
    "prompt-123",
  );
  assert.equal(
    retainPromptSelectionWhileLoading("prompt-123", "prompt-456", true),
    "prompt-456",
  );
  assert.equal(
    retainPromptSelectionWhileLoading("prompt-456", null, false),
    null,
  );
});

test("Idea Studio and Enhance Prompt handoffs preserve exact unsaved text and identity", () => {
  const idea = "  Keep this exact idea.\n";
  assert.equal(
    ideaStudioInitialIdea(ideaStudioLaunchContext(idea), "ignored", "ignored"),
    idea,
  );
  assert.equal(ideaStudioInitialIdea(undefined, idea), idea);
  assert.deepEqual(
    enhancePromptLaunchContext({
      id: "idea-123",
      body: idea,
      target: "claude-code",
    }),
    {
      thoughts: idea,
      target: "claude-code",
      seedId: "idea-123",
    },
  );
  assert.deepEqual(enhancePromptThoughtsLaunchContext(idea), {
    thoughts: idea,
  });
});

test("browse recovery distinguishes empty, no-match, filtered, and failed states", () => {
  assert.equal(
    browseEmptyState({
      loading: true,
      recordCount: 0,
      visibleCount: 0,
      query: "",
    }),
    undefined,
  );
  assert.equal(
    browseEmptyState({
      loading: false,
      error: "permission denied",
      recordCount: 0,
      visibleCount: 0,
      query: "",
    }),
    "load-failure",
  );
  assert.equal(
    browseEmptyState({
      loading: false,
      recordCount: 0,
      visibleCount: 0,
      query: "",
    }),
    "empty-library",
  );
  assert.equal(
    browseEmptyState({
      loading: false,
      recordCount: 4,
      visibleCount: 0,
      query: "missing prompt",
    }),
    "no-results",
  );
  assert.equal(
    browseEmptyState({
      loading: false,
      recordCount: 4,
      visibleCount: 0,
      query: "",
    }),
    "filtered-empty",
  );
});

test("fallback paste requires one exact active prompt without placeholders", () => {
  const exact = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Repair the flaky cache",
    aliases: ["cache repair"],
    body: "Find and repair the cache failure.",
  };
  const ambiguous = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Another prompt",
    aliases: ["cache repair"],
    body: "Do something else.",
  };
  const archived = {
    id: "33333333-3333-4333-8333-333333333333",
    title: "Archived prompt",
    aliases: ["old repair"],
    body: "Do the old work.",
    archivedAt: "2026-07-29T00:00:00.000Z",
  };
  const placeholder = {
    id: "44444444-4444-4444-8444-444444444444",
    title: "Prepare release",
    aliases: ["release prep"],
    body: "Prepare {{product}} for release.",
  };
  const records = [exact, ambiguous, archived, placeholder];

  assert.deepEqual(
    fallbackPromptDecision(records, "  REPAIR   THE FLAKY CACHE "),
    { kind: "paste", record: exact },
  );
  assert.deepEqual(
    fallbackPromptDecision(records, exact.id.toUpperCase()),
    { kind: "paste", record: exact },
  );
  assert.deepEqual(fallbackPromptDecision(records, "release prep"), {
    kind: "review",
    record: placeholder,
  });

  for (const unsafe of [
    "cache repair",
    "Repair the flaky",
    "Find and repair the cache failure.",
    "old repair",
    "flaky system repair",
    "",
  ]) {
    assert.deepEqual(fallbackPromptDecision(records, unsafe), { kind: "none" });
  }
});
