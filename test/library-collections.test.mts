import assert from "node:assert/strict";
import test from "node:test";
import {
  LIBRARY_COLLECTION_TITLES,
  LIBRARY_ARCHIVE_SECTION,
  LIBRARY_INBOX_SECTION,
  collectionSlug,
  compareLibraryCollectionTitles,
  purposeCollectionTitle,
} from "../src/core/library-collections.ts";
import type { PromptRecord } from "../src/core/prompt-store.ts";

function record(over: Partial<PromptRecord> = {}): PromptRecord {
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
  };
}

test("purpose collections use the fixed folder list and skip import tags", () => {
  assert.deepEqual(
    LIBRARY_COLLECTION_TITLES.slice(0, 5),
    [
      LIBRARY_INBOX_SECTION,
      LIBRARY_ARCHIVE_SECTION,
      "Agent Behavior",
      "Agent Self-Improvement",
      "Atlas Audits",
    ],
  );
  assert.equal(collectionSlug("Cleanup & De-Slop"), "cleanup-de-slop");
  assert.equal(collectionSlug("Design & Frontend"), "design-frontend");
  assert.equal(collectionSlug("00. Inbox"), "inbox");
  assert.equal(
    purposeCollectionTitle(
      record({ tags: ["apple-notes-import", "atlas-builds"] }),
    ),
    "Atlas Builds",
  );
  assert.equal(
    purposeCollectionTitle(record({ tags: ["apple-notes-import"] })),
    LIBRARY_INBOX_SECTION,
  );
  assert.equal(
    purposeCollectionTitle(
      record({
        tags: ["atlas-builds"],
        archivedAt: "2026-08-01T00:00:00.000Z",
      }),
    ),
    LIBRARY_ARCHIVE_SECTION,
  );
  assert.equal(
    purposeCollectionTitle(
      record({
        taxonomy: {
          taskTypes: ["Review"],
          technologies: [],
          artifacts: [],
          problems: [],
          workflows: [],
        },
      }),
    ),
    "Code Review",
  );
  assert.ok(
    compareLibraryCollectionTitles(LIBRARY_INBOX_SECTION, "Atlas Builds") < 0,
  );
  assert.ok(
    compareLibraryCollectionTitles("Atlas Audits", "Atlas Builds") < 0,
  );
});
