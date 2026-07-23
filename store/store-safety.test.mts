import assert from "node:assert/strict";
import test from "node:test";
import { assertStoreTextIsCredentialSafe } from "../scripts/store-safety.mts";

test("Store safety rejects credential markers without logging their values", () => {
  assert.doesNotThrow(() =>
    assertStoreTextIsCredentialSafe("README.md", "Prompt Studio does not require an account or API key."),
  );

  for (const contents of [
    ["openai", "ApiKey"].join(""),
    ["OPENAI", "API", "KEY"].join("_"),
    ["sk", "proj", "A".repeat(24)].join("-"),
  ]) {
    let message = "";
    assert.throws(
      () => assertStoreTextIsCredentialSafe("submitted.txt", contents),
      (error: unknown) => {
        message = error instanceof Error ? error.message : String(error);
        return true;
      },
    );
    assert.doesNotMatch(message, new RegExp(contents));
  }
});
