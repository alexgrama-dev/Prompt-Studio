import assert from "node:assert/strict";
import test from "node:test";
import {
  browseEmptyState,
  CAPTURE_INBOX_ITEM_ID,
  ENHANCE_HISTORY_ITEM_ID,
  ENHANCE_PROMPT_ITEM_ID,
  NEW_PROMPT_ITEM_ID,
  organizeLibraryPrompts,
  parseLibraryGroupMode,
  parseLibrarySortMode,
  selectedLibraryItemId,
  UNCATEGORIZED_LIBRARY_SECTION,
} from "../src/core/browse-state.ts";
import type { PromptRecord } from "../src/core/prompt-store.ts";
import {
  browsePromptsLaunchContext,
  enhancePromptEntryUntrustedSurface,
  enhancePromptFromHistoryLaunchContext,
  enhancePromptLaunchContext,
  enhancePromptLibraryLaunchContext,
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
  assert.equal(
    enhancePromptLibraryLaunchContext(idea, idea).untrustedSurface,
    "selection",
  );
  assert.equal(
    enhancePromptLibraryLaunchContext("typed query", idea).untrustedSurface,
    undefined,
  );
  assert.equal(
    enhancePromptEntryUntrustedSurface({
      argumentThoughts: "paste this",
    }),
    "argument",
  );
  assert.equal(
    enhancePromptEntryUntrustedSurface({
      fallbackText: "selected",
    }),
    "selection",
  );
  assert.equal(
    enhancePromptEntryUntrustedSurface({
      launchContext: enhancePromptThoughtsLaunchContext("typed query"),
      argumentThoughts: "paste this",
    }),
    undefined,
  );
});

test("Enhance Again from history uses original thoughts, not the compiled body", () => {
  assert.deepEqual(
    enhancePromptFromHistoryLaunchContext({
      body: "Compiled prompt body.",
      target: "codex",
      seed: { thoughts: "Fix the login timeout.", id: "seed-1" },
    }),
    {
      thoughts: "Fix the login timeout.",
      target: "codex",
      seedId: "seed-1",
    },
  );
  assert.deepEqual(
    enhancePromptFromHistoryLaunchContext(
      {
        body: "Compiled prompt body.",
        target: "claude-code",
      },
      "library-prompt-id",
    ),
    {
      thoughts: "Compiled prompt body.",
      target: "claude-code",
      revisionOfPromptId: "library-prompt-id",
    },
  );
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

test("Prompt Library keeps paste selected when studio rows sit above prompts", () => {
  const studioRows = [
    ENHANCE_PROMPT_ITEM_ID,
    CAPTURE_INBOX_ITEM_ID,
    NEW_PROMPT_ITEM_ID,
    ENHANCE_HISTORY_ITEM_ID,
  ];
  assert.equal(
    selectedLibraryItemId(null, ["prompt-1", "prompt-2"], studioRows),
    "prompt-1",
  );
  assert.equal(
    selectedLibraryItemId(ENHANCE_PROMPT_ITEM_ID, ["prompt-1"], studioRows),
    ENHANCE_PROMPT_ITEM_ID,
  );
  assert.equal(
    selectedLibraryItemId(CAPTURE_INBOX_ITEM_ID, ["prompt-1"], studioRows),
    CAPTURE_INBOX_ITEM_ID,
  );
  assert.equal(
    selectedLibraryItemId(NEW_PROMPT_ITEM_ID, ["prompt-1"], studioRows),
    NEW_PROMPT_ITEM_ID,
  );
  assert.equal(
    selectedLibraryItemId(ENHANCE_HISTORY_ITEM_ID, ["prompt-1"], studioRows),
    ENHANCE_HISTORY_ITEM_ID,
  );
  assert.equal(
    selectedLibraryItemId("prompt-2", ["prompt-1", "prompt-2"], studioRows),
    "prompt-2",
  );
  assert.equal(
    selectedLibraryItemId("hidden", ["prompt-1"], studioRows),
    "prompt-1",
  );
  assert.equal(selectedLibraryItemId(null, [], studioRows), ENHANCE_PROMPT_ITEM_ID);
  assert.equal(
    selectedLibraryItemId(null, [], [CAPTURE_INBOX_ITEM_ID]),
    CAPTURE_INBOX_ITEM_ID,
  );
  assert.equal(
    selectedLibraryItemId(null, [], [NEW_PROMPT_ITEM_ID]),
    NEW_PROMPT_ITEM_ID,
  );
  assert.equal(selectedLibraryItemId(null, [], []), undefined);
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
  assert.deepEqual(fallbackPromptDecision(records, exact.id.toUpperCase()), {
    kind: "paste",
    record: exact,
  });
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

function libraryPrompt(over: Record<string, unknown> = {}): PromptRecord {
  return {
    schemaVersion: 1,
    id: "p1",
    title: "Prompt",
    summary: "Summary",
    target: "generic",
    tags: [],
    aliases: [],
    searchTerms: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    favorite: false,
    body: "Body",
    filePath: "/p1.md",
    ...over,
  } as PromptRecord;
}

test("library arrangement groups by purpose or content and sorts within sections", () => {
  assert.equal(parseLibraryGroupMode("nope"), "purpose");
  assert.equal(parseLibrarySortMode("nope"), "used");
  assert.equal(parseLibraryGroupMode("content"), "content");
  assert.equal(parseLibrarySortMode("title"), "title");

  const review = libraryPrompt({
    id: "review",
    title: "PR Review",
    updatedAt: "2026-07-03T00:00:00.000Z",
    taxonomy: {
      taskTypes: ["Review"],
      technologies: ["git"],
      artifacts: [],
      problems: [],
      workflows: [],
    },
  });
  const atlas = libraryPrompt({
    id: "atlas",
    title: "Atlas 26 — Content & Personal",
    updatedAt: "2026-07-02T00:00:00.000Z",
  });
  const stray = libraryPrompt({
    id: "stray",
    title: "Master Orchestrator v3",
    updatedAt: "2026-07-04T00:00:00.000Z",
  });
  const laterReview = libraryPrompt({
    id: "review-2",
    title: "Design Review",
    updatedAt: "2026-07-01T00:00:00.000Z",
    tags: ["review"],
  });

  const byPurpose = organizeLibraryPrompts([review, laterReview, atlas, stray], {
    groupMode: "purpose",
    sortMode: "title",
  });
  assert.deepEqual(
    byPurpose.map((section) => [
      section.title,
      section.records.map((record) => record.id),
    ]),
    [
      ["00. Inbox", ["atlas", "stray"]],
      ["Code Review", ["review-2", "review"]],
    ],
  );

  const imported = libraryPrompt({
    id: "atlas-build",
    title: "Atlas 01 — Context Ingestion",
    tags: ["apple-notes-import", "atlas-builds"],
  });
  const archived = libraryPrompt({
    id: "old",
    title: "Old Atlas Build",
    tags: ["atlas-builds"],
    archivedAt: "2026-07-01T00:00:00.000Z",
  });
  const byCollection = organizeLibraryPrompts([imported, archived, stray], {
    groupMode: "purpose",
    sortMode: "title",
  });
  assert.deepEqual(
    byCollection.map((section) => [
      section.title,
      section.records.map((record) => record.id),
    ]),
    [
      ["00. Inbox", ["stray"]],
      ["01. Archive", ["old"]],
      ["Atlas Builds", ["atlas-build"]],
    ],
  );

  const byContent = organizeLibraryPrompts([review, atlas, stray], {
    groupMode: "content",
    sortMode: "updated",
  });
  assert.equal(byContent[0]?.title, "Content & Personal");
  assert.equal(
    byContent.find((section) => section.title === "git")?.records[0]?.id,
    "review",
  );
  assert.equal(byContent.at(-1)?.title, UNCATEGORIZED_LIBRARY_SECTION);

  const ungrouped = organizeLibraryPrompts([review, atlas], {
    groupMode: "none",
    sortMode: "updated",
  });
  assert.deepEqual(
    ungrouped.map((section) => [
      section.title,
      section.records.map((record) => record.id),
    ]),
    [["Prompts", ["review", "atlas"]]],
  );

  const byUse = organizeLibraryPrompts([review, atlas], {
    groupMode: "none",
    sortMode: "used",
    usage: new Map([
      ["atlas", { useCount: 2, lastUsedAt: "2026-07-05T00:00:00.000Z" }],
    ]),
  });
  assert.deepEqual(
    byUse[0]?.records.map((record) => record.id),
    ["atlas", "review"],
  );

  const preserved = organizeLibraryPrompts([atlas, review], {
    groupMode: "none",
    sortMode: "used",
    preserveSearchOrder: true,
    usage: new Map([
      ["review", { useCount: 9, lastUsedAt: "2026-07-09T00:00:00.000Z" }],
    ]),
  });
  assert.deepEqual(
    preserved[0]?.records.map((record) => record.id),
    ["atlas", "review"],
  );
});
