import type { PromptRecord, PromptTarget } from "./prompt-store.ts";

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

export function retainPromptSelectionWhileLoading(
  currentId: string | null,
  nextId: string | null,
  isLoading: boolean,
): string | null {
  return isLoading && nextId === null ? currentId : nextId;
}
