import { basename } from "node:path";
import type { PromptRecord } from "./prompt-store.ts";
import {
  suggestPromptsForProject,
  type PromptSuggestion,
} from "./library-intelligence.ts";

const CONTEXT_CACHE_TTL_MS = 5 * 60 * 1_000;

export interface AmbientPick {
  suggestion?: PromptSuggestion;
  record?: PromptRecord;
  reason: string;
}

/**
 * The single prompt to paste without asking. Prefers a prompt bound to the
 * repository the user is in, then the one they use most. Returns no record
 * rather than guessing when neither signal exists.
 */
export function pickAmbientPrompt(
  records: readonly PromptRecord[],
  options: {
    projectPath?: string;
    usage?: ReadonlyMap<string, number>;
  } = {},
): AmbientPick {
  const active = records.filter((record) => !record.archivedAt);
  if (active.length === 0) {
    return { reason: "The prompt library is empty." };
  }
  if (options.projectPath?.trim()) {
    const suggestion = suggestPromptsForProject(active, options.projectPath, {
      ...(options.usage ? { usage: options.usage } : {}),
      limit: 1,
    })[0];
    const record = suggestion
      ? active.find((item) => item.id === suggestion.id)
      : undefined;
    if (suggestion && record) {
      return { suggestion, record, reason: suggestion.reason };
    }
  }
  const mostUsed = [...active].sort(
    (left, right) =>
      (options.usage?.get(right.id) ?? 0) -
        (options.usage?.get(left.id) ?? 0) ||
      Number(right.favorite) - Number(left.favorite) ||
      right.updatedAt.localeCompare(left.updatedAt),
  )[0];
  if (!mostUsed) return { reason: "No active prompt is available." };
  const uses = options.usage?.get(mostUsed.id) ?? 0;
  return {
    record: mostUsed,
    reason:
      uses > 0
        ? `Most used prompt (${uses} use${uses === 1 ? "" : "s"})`
        : "Most recently updated prompt",
  };
}

export interface ProjectContextCacheEntry<T> {
  path: string;
  loadedAt: number;
  value: T;
}

/**
 * Keeps the last project bundle in memory so opening Enhance Prompt against
 * the same repository does not re-read it. Entries expire, because a bundle
 * that outlives the working tree is worse than no cache.
 */
export class ProjectContextCache<T> {
  private entry: ProjectContextCacheEntry<T> | undefined;
  private readonly ttlMs: number;
  private readonly now: () => number;

  // Explicit fields, not parameter properties: Node's type stripping rejects
  // parameter properties, and the test runner uses it.
  constructor(
    ttlMs: number = CONTEXT_CACHE_TTL_MS,
    now: () => number = () => Date.now(),
  ) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(path: string): T | undefined {
    if (!this.entry || this.entry.path !== path) return undefined;
    if (this.now() - this.entry.loadedAt > this.ttlMs) {
      this.entry = undefined;
      return undefined;
    }
    return this.entry.value;
  }

  set(path: string, value: T): void {
    this.entry = { path, loadedAt: this.now(), value };
  }

  clear(): void {
    this.entry = undefined;
  }
}

/**
 * The repository a path belongs to, for suggestion matching. Returns the path
 * unchanged when it is already a repository root.
 */
export function projectLabel(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "");
  return trimmed ? basename(trimmed) : "";
}
