import {
  compareLibraryCollectionTitles,
  purposeCollectionTitle,
} from "./library-collections.ts";
import { clusterPrompts } from "./library-intelligence.ts";
import type { PromptRecord } from "./prompt-store.ts";

export type BrowseEmptyState =
  | "load-failure"
  | "empty-library"
  | "no-results"
  | "filtered-empty";

export const ENHANCE_PROMPT_ITEM_ID = "studio:enhance-prompt";
export const CAPTURE_INBOX_ITEM_ID = "studio:capture-inbox";
export const NEW_PROMPT_ITEM_ID = "studio:new-prompt";
export const ENHANCE_HISTORY_ITEM_ID = "studio:enhance-history";

export const LIBRARY_GROUP_STORAGE_KEY = "prompt-studio.library-group";
export const LIBRARY_SORT_STORAGE_KEY = "prompt-studio.library-sort";
export const UNCATEGORIZED_LIBRARY_SECTION = "Uncategorized";

export const LIBRARY_GROUP_MODES = ["purpose", "content", "none"] as const;
export const LIBRARY_SORT_MODES = ["used", "updated", "title"] as const;

export type LibraryGroupMode = (typeof LIBRARY_GROUP_MODES)[number];
export type LibrarySortMode = (typeof LIBRARY_SORT_MODES)[number];

export interface LibraryPromptUsage {
  useCount: number;
  lastUsedAt: string;
}

export interface LibraryPromptSection {
  title: string;
  records: PromptRecord[];
}

export function browseEmptyState({
  loading,
  error,
  recordCount,
  visibleCount,
  query,
}: {
  loading: boolean;
  error?: string;
  recordCount: number;
  visibleCount: number;
  query: string;
}): BrowseEmptyState | undefined {
  if (loading) return undefined;
  if (error) return "load-failure";
  if (visibleCount > 0) return undefined;
  if (recordCount === 0) return "empty-library";
  return query.trim() ? "no-results" : "filtered-empty";
}

export function selectedLibraryItemId(
  selectedPromptId: string | null,
  visibleIds: readonly string[],
  studioRowIds: readonly string[],
): string | undefined {
  if (selectedPromptId && studioRowIds.includes(selectedPromptId)) {
    return selectedPromptId;
  }
  if (selectedPromptId && visibleIds.includes(selectedPromptId)) {
    return selectedPromptId;
  }
  return visibleIds[0] ?? studioRowIds[0];
}

export function parseLibraryGroupMode(
  value: string | undefined,
): LibraryGroupMode {
  return LIBRARY_GROUP_MODES.includes(value as LibraryGroupMode)
    ? (value as LibraryGroupMode)
    : "purpose";
}

export function parseLibrarySortMode(
  value: string | undefined,
): LibrarySortMode {
  return LIBRARY_SORT_MODES.includes(value as LibrarySortMode)
    ? (value as LibrarySortMode)
    : "used";
}

/**
 * Orders then buckets the visible library. Purpose uses the fixed collection
 * list. Content uses technology, artifact, problem, shared-vocabulary cluster,
 * or the title text after an em dash.
 */
export function organizeLibraryPrompts(
  records: readonly PromptRecord[],
  options: {
    groupMode: LibraryGroupMode;
    sortMode: LibrarySortMode;
    usage?: ReadonlyMap<string, LibraryPromptUsage>;
    preserveSearchOrder?: boolean;
  },
): LibraryPromptSection[] {
  const clusterById =
    options.groupMode === "content"
      ? contentClusterLabels(records)
      : new Map<string, string>();
  const sorted = sortLibraryPrompts(
    records,
    options.sortMode,
    options.usage ?? new Map(),
    options.preserveSearchOrder === true,
  );
  return groupLibraryPrompts(sorted, options.groupMode, clusterById);
}

function sortLibraryPrompts(
  records: readonly PromptRecord[],
  mode: LibrarySortMode,
  usage: ReadonlyMap<string, LibraryPromptUsage>,
  preserveSearchOrder: boolean,
): PromptRecord[] {
  if (preserveSearchOrder) return [...records];
  return [...records].sort((left, right) => {
    if (mode === "title") return left.title.localeCompare(right.title);
    if (mode === "used") {
      const leftUse = usage.get(left.id);
      const rightUse = usage.get(right.id);
      if (leftUse && rightUse) {
        return (
          rightUse.lastUsedAt.localeCompare(leftUse.lastUsedAt) ||
          rightUse.useCount - leftUse.useCount ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.title.localeCompare(right.title)
        );
      }
      if (leftUse) return -1;
      if (rightUse) return 1;
    }
    return (
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title)
    );
  });
}

function groupLibraryPrompts(
  records: readonly PromptRecord[],
  mode: LibraryGroupMode,
  clusterById: ReadonlyMap<string, string>,
): LibraryPromptSection[] {
  if (mode === "none") return [{ title: "Prompts", records: [...records] }];
  const buckets = new Map<string, LibraryPromptSection>();
  for (const record of records) {
    const title =
      mode === "purpose"
        ? purposeLabel(record)
        : contentLabel(record, clusterById);
    const key = title.toLocaleLowerCase();
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.title = preferDisplayTitle(bucket.title, title);
      bucket.records.push(record);
    } else buckets.set(key, { title, records: [record] });
  }
  const uncategorized = UNCATEGORIZED_LIBRARY_SECTION.toLocaleLowerCase();
  return [...buckets.values()].sort((left, right) => {
    if (mode === "purpose") {
      return compareLibraryCollectionTitles(left.title, right.title);
    }
    const leftUncategorized = left.title.toLocaleLowerCase() === uncategorized;
    const rightUncategorized =
      right.title.toLocaleLowerCase() === uncategorized;
    if (leftUncategorized !== rightUncategorized) {
      return leftUncategorized ? 1 : -1;
    }
    return left.title.localeCompare(right.title);
  });
}

function purposeLabel(record: PromptRecord): string {
  return purposeCollectionTitle(record);
}

function contentLabel(
  record: PromptRecord,
  clusterById: ReadonlyMap<string, string>,
): string {
  return (
    firstFilled(record.taxonomy?.technologies ?? []) ??
    firstFilled(record.taxonomy?.artifacts ?? []) ??
    firstFilled(record.taxonomy?.problems ?? []) ??
    clusterById.get(record.id) ??
    titleCategory(record.title) ??
    UNCATEGORIZED_LIBRARY_SECTION
  );
}

function contentClusterLabels(
  records: readonly PromptRecord[],
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const cluster of clusterPrompts(records)) {
    for (const id of cluster.ids) labels.set(id, cluster.label);
  }
  return labels;
}

function titleCategory(title: string): string | undefined {
  const parts = title.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return undefined;
  const rest = parts.slice(1).join(" — ").trim();
  return rest.length >= 2 ? rest : undefined;
}

function firstFilled(values: readonly string[]): string | undefined {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
}

function preferDisplayTitle(current: string, candidate: string): string {
  if (current.toLocaleLowerCase() !== candidate.toLocaleLowerCase()) {
    return current;
  }
  const currentCased = current !== current.toLocaleLowerCase();
  const candidateCased = candidate !== candidate.toLocaleLowerCase();
  if (candidateCased && !currentCased) return candidate;
  return current;
}
