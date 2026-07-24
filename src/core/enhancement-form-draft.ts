import type { EnhancementResearchLevel } from "./enhancement.ts";
import {
  SELECTABLE_ENHANCEMENT_PROFILE_IDS,
  type SelectableEnhancementProfileId,
} from "./provider-profiles.ts";
import type { PromptTarget } from "./prompt-store.ts";

export interface EnhancementFormDraft {
  roughThoughts: string;
  target: PromptTarget;
  project: string;
  repositoryFolder: string[];
  setupMode: "smart" | "custom";
  profileId: SelectableEnhancementProfileId;
  researchLevel: EnhancementResearchLevel;
  oneRunInstruction: string;
}

export function parseEnhancementFormDraft(
  source: string,
): EnhancementFormDraft | undefined {
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const draft = value as Record<string, unknown>;
    if (
      typeof draft.roughThoughts !== "string" ||
      !["generic", "codex", "claude-code"].includes(String(draft.target)) ||
      typeof draft.project !== "string" ||
      !Array.isArray(draft.repositoryFolder) ||
      draft.repositoryFolder.some((path) => typeof path !== "string") ||
      !["smart", "custom"].includes(String(draft.setupMode)) ||
      !SELECTABLE_ENHANCEMENT_PROFILE_IDS.includes(
        draft.profileId as SelectableEnhancementProfileId,
      ) ||
      !["none", "auto", "deep"].includes(String(draft.researchLevel)) ||
      typeof draft.oneRunInstruction !== "string"
    ) {
      return;
    }
    return draft as unknown as EnhancementFormDraft;
  } catch {
    return;
  }
}
