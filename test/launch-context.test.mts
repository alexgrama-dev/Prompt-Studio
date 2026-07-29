import assert from "node:assert/strict";
import test from "node:test";
import {
  browsePromptsLaunchContext,
  enhancePromptLaunchContext,
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
});
