import assert from "node:assert/strict";
import test from "node:test";
import {
  browsePromptsLaunchContext,
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
