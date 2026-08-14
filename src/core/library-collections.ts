import type { PromptRecord } from "./prompt-store.ts";

export const LIBRARY_INBOX_SECTION = "00. Inbox";
export const LIBRARY_ARCHIVE_SECTION = "01. Archive";

export const LIBRARY_COLLECTION_TITLES = [
  LIBRARY_INBOX_SECTION,
  LIBRARY_ARCHIVE_SECTION,
  "Agent Behavior",
  "Agent Self-Improvement",
  "Atlas Audits",
  "Atlas Builds",
  "Cleanup & De-Slop",
  "Code Review",
  "Codebase Audits",
  "Coding Standards",
  "Design & Frontend",
  "Execution & Handoff",
  "Life & Career",
  "Office Files",
  "Orchestration",
  "Performance & System",
  "Planning & Specs",
  "Security",
  "Thinking & Research",
] as const;

export type LibraryCollectionTitle =
  (typeof LIBRARY_COLLECTION_TITLES)[number];

const IGNORED_COLLECTION_TERMS = new Set([
  "apple-notes-import",
  "seed",
  "smoke-test",
]);

const COLLECTION_ALIASES: Readonly<Record<string, string>> = {
  adr: "codebase-audits",
  architecture: "codebase-audits",
  "browser-compatibility": "performance-system",
  "browser-research": "thinking-research",
  "bug-fix": "code-review",
  "code-investigation": "code-review",
  "codebase-audit": "codebase-audits",
  "component-implementation": "design-frontend",
  "component-integration": "design-frontend",
  ddd: "coding-standards",
  debugging: "thinking-research",
  defects: "code-review",
  diagnosis: "thinking-research",
  "diff-review": "code-review",
  "domain-language": "coding-standards",
  glossary: "coding-standards",
  github: "orchestration",
  "incremental-commits": "planning-specs",
  issues: "orchestration",
  learnings: "agent-self-improvement",
  performance: "performance-system",
  planning: "planning-specs",
  "prompt-compilation": "thinking-research",
  "red-green-refactor": "coding-standards",
  refactoring: "codebase-audits",
  retrospective: "agent-self-improvement",
  review: "code-review",
  rfc: "planning-specs",
  "root-cause": "thinking-research",
  standards: "coding-standards",
  tdd: "coding-standards",
  terminology: "coding-standards",
  testing: "coding-standards",
  triage: "orchestration",
  validation: "code-review",
  workflow: "orchestration",
};

const collectionBySlug = new Map<string, LibraryCollectionTitle>(
  LIBRARY_COLLECTION_TITLES.map((title) => [collectionSlug(title), title]),
);

const collectionOrder = new Map<string, number>(
  LIBRARY_COLLECTION_TITLES.map((title, index) => [title, index]),
);

export function collectionSlug(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase()
    .replace(/^\d+\.\s+/, "")
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function purposeCollectionTitle(
  record: PromptRecord,
): LibraryCollectionTitle {
  if (record.archivedAt) return LIBRARY_ARCHIVE_SECTION;
  return matchLibraryCollection(collectionTerms(record)) ?? LIBRARY_INBOX_SECTION;
}

export function compareLibraryCollectionTitles(
  left: string,
  right: string,
): number {
  const leftOrder = collectionOrder.get(left);
  const rightOrder = collectionOrder.get(right);
  if (leftOrder !== undefined && rightOrder !== undefined) {
    return leftOrder - rightOrder;
  }
  if (leftOrder !== undefined) return -1;
  if (rightOrder !== undefined) return 1;
  return left.localeCompare(right);
}

function collectionTerms(record: PromptRecord): readonly string[] {
  return [
    ...record.tags,
    ...(record.taxonomy?.taskTypes ?? []),
    ...(record.taxonomy?.workflows ?? []),
  ];
}

function matchLibraryCollection(
  terms: readonly string[],
): LibraryCollectionTitle | undefined {
  for (const term of terms) {
    const slug = collectionSlug(term);
    if (!slug || IGNORED_COLLECTION_TERMS.has(slug)) continue;
    const direct = collectionBySlug.get(slug);
    if (direct && direct !== LIBRARY_INBOX_SECTION) return direct;
    const aliased = COLLECTION_ALIASES[slug];
    if (aliased) {
      const mapped = collectionBySlug.get(aliased);
      if (mapped) return mapped;
    }
  }
}
