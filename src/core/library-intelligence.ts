import type { PromptRecord } from "./prompt-store.ts";

export const DEFAULT_CLUSTER_THRESHOLD = 0.35;
const MAX_SUGGESTIONS = 10;

export type DriftReason =
  | "commit-moved"
  | "files-changed"
  | "files-missing"
  | "compiler-superseded";

export interface PromptDrift {
  id: string;
  title: string;
  reasons: DriftReason[];
  /** Highest-signal reason first, for a one-line badge. */
  headline: string;
}

export interface ProjectState {
  /** Current HEAD of the bound repository, when it can be read. */
  commit?: string;
  /** Files from the prompt's projectFiles that no longer exist. */
  missingFiles?: string[];
  /** Files from the prompt's projectFiles modified after the prompt was compiled. */
  changedFiles?: string[];
  /** Current compiler version, to flag prompts built by an older compiler. */
  compilerVersion?: string;
}

/**
 * A prompt bound to a repository silently rots when that repository moves. This
 * reports the drift rather than letting a stale prompt read as current.
 */
export function detectPromptDrift(
  record: PromptRecord,
  state: ProjectState,
): PromptDrift | undefined {
  if (!record.project || record.archivedAt) return undefined;
  const reasons: DriftReason[] = [];
  if (
    record.project.commit &&
    state.commit &&
    record.project.commit !== state.commit
  ) {
    reasons.push("commit-moved");
  }
  if (state.missingFiles?.length) reasons.push("files-missing");
  if (state.changedFiles?.length) reasons.push("files-changed");
  if (
    record.enhancement &&
    state.compilerVersion &&
    record.enhancement.compilerVersion !== state.compilerVersion
  ) {
    reasons.push("compiler-superseded");
  }
  if (reasons.length === 0) return undefined;
  return {
    id: record.id,
    title: record.title,
    reasons,
    headline: driftHeadline(reasons[0]!, state),
  };
}

function driftHeadline(reason: DriftReason, state: ProjectState): string {
  switch (reason) {
    case "files-missing":
      return `${state.missingFiles?.length ?? 0} cited file${state.missingFiles?.length === 1 ? "" : "s"} no longer exist`;
    case "files-changed":
      return `${state.changedFiles?.length ?? 0} cited file${state.changedFiles?.length === 1 ? "" : "s"} changed since this was compiled`;
    case "commit-moved":
      return "The bound repository has moved since this was compiled";
    case "compiler-superseded":
      return "Compiled by an older prompt compiler";
  }
}

export interface LineageEntry {
  id: string;
  title: string;
  updatedAt: string;
  /** The compiled draft this prompt was saved from, when it had one. */
  historyId?: string;
}

export interface LineageChain {
  historyId: string;
  entries: LineageEntry[];
}

/**
 * Prompts that came from the same compiled draft. A revision updates a prompt
 * in place, so the shared history id is what links a family together.
 */
export function buildPromptLineage(
  records: readonly PromptRecord[],
): LineageChain[] {
  const byHistory = new Map<string, LineageEntry[]>();
  for (const record of records) {
    const historyId = record.enhancementHistory?.id;
    if (!historyId) continue;
    const entry: LineageEntry = {
      id: record.id,
      title: record.title,
      updatedAt: record.updatedAt,
      historyId,
    };
    const existing = byHistory.get(historyId);
    if (existing) existing.push(entry);
    else byHistory.set(historyId, [entry]);
  }
  return [...byHistory.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([historyId, entries]) => ({
      historyId,
      entries: entries.sort((left, right) =>
        left.updatedAt.localeCompare(right.updatedAt),
      ),
    }))
    .sort((left, right) => right.entries.length - left.entries.length);
}

export interface PromptCluster {
  label: string;
  ids: string[];
  titles: string[];
}

/**
 * Groups active prompts into topic clusters by shared vocabulary. Single-link
 * agglomeration: every prompt joins the first cluster it is close enough to.
 */
export function clusterPrompts(
  records: readonly PromptRecord[],
  threshold = DEFAULT_CLUSTER_THRESHOLD,
): PromptCluster[] {
  if (!(threshold >= 0.1 && threshold <= 0.95)) {
    throw new Error("The cluster threshold must be between 0.1 and 0.95.");
  }
  const active = records.filter((record) => !record.archivedAt);
  const clusters: Array<{ members: PromptRecord[]; tokens: Set<string> }> = [];
  for (const record of active) {
    const tokens = promptTokens(record);
    const home = clusters.find(
      (cluster) => jaccard(cluster.tokens, tokens) >= threshold,
    );
    if (home) {
      home.members.push(record);
      for (const token of tokens) home.tokens.add(token);
    } else {
      clusters.push({ members: [record], tokens: new Set(tokens) });
    }
  }
  return clusters
    .filter((cluster) => cluster.members.length > 1)
    .map((cluster) => ({
      label: clusterLabel(cluster.members),
      ids: cluster.members.map((member) => member.id),
      titles: cluster.members.map((member) => member.title),
    }))
    .sort((left, right) => right.ids.length - left.ids.length);
}

export interface PromptSuggestion {
  id: string;
  title: string;
  score: number;
  reason: string;
}

/**
 * Ranks prompts for the repository the user is currently in. An exact project
 * binding always outranks a tag or vocabulary match, because it is evidence
 * rather than a guess.
 */
export function suggestPromptsForProject(
  records: readonly PromptRecord[],
  projectPath: string,
  options: { usage?: ReadonlyMap<string, number>; limit?: number } = {},
): PromptSuggestion[] {
  const normalizedPath = normalizePath(projectPath);
  if (!normalizedPath) return [];
  const projectName = normalizedPath.split("/").filter(Boolean).at(-1) ?? "";
  const suggestions: PromptSuggestion[] = [];
  for (const record of records) {
    if (record.archivedAt) continue;
    const bound = record.project
      ? normalizePath(record.project.path) === normalizedPath
      : false;
    const namedInTerms =
      projectName.length >= 3 &&
      [...record.tags, ...record.searchTerms, ...record.aliases].some((term) =>
        term.toLocaleLowerCase().includes(projectName.toLocaleLowerCase()),
      );
    if (!bound && !namedInTerms) continue;
    const uses = options.usage?.get(record.id) ?? 0;
    suggestions.push({
      id: record.id,
      title: record.title,
      // Binding dominates; use count only orders prompts of equal evidence.
      score: (bound ? 1_000 : 100) + Math.min(uses, 99),
      reason: bound ? "Bound to this repository" : `Mentions ${projectName}`,
    });
  }
  return suggestions
    .sort(
      (left, right) =>
        right.score - left.score || left.title.localeCompare(right.title),
    )
    .slice(0, Math.max(1, Math.min(options.limit ?? MAX_SUGGESTIONS, 50)));
}

function clusterLabel(members: readonly PromptRecord[]): string {
  const counts = new Map<string, number>();
  for (const member of members) {
    for (const tag of member.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 2)
    .map(([tag]) => tag);
  return top.length > 0 ? top.join(" · ") : (members[0]?.title ?? "Untitled");
}

function normalizePath(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function promptTokens(record: PromptRecord): Set<string> {
  return new Set(
    `${record.title} ${record.summary} ${record.tags.join(" ")}`
      .toLocaleLowerCase()
      .match(/[a-z0-9]{3,}/g) ?? [],
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}
