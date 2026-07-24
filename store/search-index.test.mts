import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  loadPromptUsage,
  rankRecordsByUsage,
  recordPromptUse,
  shouldTrackPromptUsage,
} from "./src/core/search-index.ts";

test("Store usage cache records use without node:sqlite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-store-"));
  const path = join(directory, "usage.json");

  assert.equal(shouldTrackPromptUsage(false), true);
  recordPromptUse("used", path);
  recordPromptUse("used", path);

  const usage = loadPromptUsage(path);
  assert.equal(usage.get("used")?.useCount, 2);
  assert.deepEqual(
    rankRecordsByUsage(
      [
        { id: "unused", updatedAt: "2026-07-23T01:00:00.000Z" },
        { id: "used", updatedAt: "2026-07-23T00:00:00.000Z" },
      ],
      usage,
    ).map(({ id }) => id),
    ["used", "unused"],
  );

  const stored = JSON.parse(await readFile(path, "utf8")) as {
    schemaVersion: number;
  };
  assert.equal(stored.schemaVersion, 1);
});
