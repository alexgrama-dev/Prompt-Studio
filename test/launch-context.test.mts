import assert from "node:assert/strict";
import test from "node:test";
import { browsePromptsLaunchContext } from "../src/core/launch-context.ts";

test("menu-bar launch context keeps the selected prompt identity", () => {
  assert.deepEqual(browsePromptsLaunchContext("prompt-123"), {
    promptId: "prompt-123",
  });
});
