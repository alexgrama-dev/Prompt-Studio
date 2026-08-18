import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  getFeatureStatus,
  loadFeatureStatuses,
} from "./src/core/features.ts";

test("Store ignores a persisted SQLite activation from another build", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-store-"));
  const path = join(directory, "features.json");
  await writeFile(
    path,
    JSON.stringify({
      "sqlite-search": {
        state: "active",
        verification: {
          status: "passed",
          checkedAt: "2026-07-23T00:00:00.000Z",
          command: "prior local verification",
        },
      },
    }),
  );

  const statuses = await loadFeatureStatuses(path);

  assert.equal(
    getFeatureStatus(statuses, "sqlite-search").effectiveState,
    "disabled",
  );
  assert.equal(
    getFeatureStatus(statuses, "openai-enhancement").effectiveState,
    "active",
  );
  assert.equal(
    getFeatureStatus(statuses, "optimization").effectiveState,
    "disabled",
  );
});
