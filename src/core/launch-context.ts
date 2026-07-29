import type { PromptRecord, PromptTarget } from "./prompt-store.ts";
import { extractPlaceholders } from "./placeholders.ts";

export interface BrowsePromptsLaunchContext {
  promptId: string;
}

export interface IdeaStudioLaunchContext {
  idea: string;
  target?: PromptTarget;
}

export interface EnhancePromptLaunchContext {
  thoughts: string;
  target?: PromptTarget;
  seedId?: string;
  revisionOfPromptId?: string;
}

export function browsePromptsLaunchContext(
  promptId: string,
): BrowsePromptsLaunchContext {
  return { promptId };
}

type FallbackPrompt = Pick<
  PromptRecord,
  "id" | "title" | "aliases" | "body" | "archivedAt"
>;

export type FallbackPromptDecision<T extends FallbackPrompt> =
  | { kind: "paste"; record: T }
  | { kind: "review"; record: T }
  | { kind: "none" };

export function fallbackPromptDecision<T extends FallbackPrompt>(
  records: readonly T[],
  fallbackText?: string,
): FallbackPromptDecision<T> {
  const query = normalizeExactText(fallbackText ?? "");
  if (!query) return { kind: "none" };
  const active = records.filter((record) => !record.archivedAt);
  const idMatch = active.find(
    (record) => normalizeExactText(record.id) === query,
  );
  const matches = idMatch
    ? [idMatch]
    : active.filter(
        (record) =>
          normalizeExactText(record.title) === query ||
          record.aliases.some(
            (alias) => normalizeExactText(alias) === query,
          ),
      );
  if (matches.length !== 1) return { kind: "none" };
  const record = matches[0]!;
  return extractPlaceholders(record.body).length > 0
    ? { kind: "review", record }
    : { kind: "paste", record };
}

export function ideaStudioLaunchContext(
  idea: string,
  target?: PromptTarget,
): IdeaStudioLaunchContext {
  return { idea, ...(target ? { target } : {}) };
}

export function ideaStudioInitialIdea(
  launchContext?: IdeaStudioLaunchContext,
  argument?: string,
  fallbackText?: string,
): string {
  return launchContext?.idea ?? argument ?? fallbackText ?? "";
}

export function enhancePromptLaunchContext(
  idea: Pick<PromptRecord, "id" | "body" | "target">,
): EnhancePromptLaunchContext {
  return {
    thoughts: idea.body,
    target: idea.target,
    seedId: idea.id,
  };
}

export function enhancePromptThoughtsLaunchContext(
  thoughts: string,
  target?: PromptTarget,
): EnhancePromptLaunchContext {
  return { thoughts, ...(target ? { target } : {}) };
}

export function retainPromptSelectionWhileLoading(
  currentId: string | null,
  nextId: string | null,
  isLoading: boolean,
): string | null {
  return isLoading && nextId === null ? currentId : nextId;
}

function normalizeExactText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
