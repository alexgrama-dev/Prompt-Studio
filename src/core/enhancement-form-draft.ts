import type { EnhancementResearchLevel } from "./enhancement.ts";
import {
  normalizeSelectableEnhancementProfileId,
  type SelectableEnhancementProfileId,
} from "./provider-profiles.ts";
import type { PromptTarget } from "./prompt-store.ts";

export type EnhanceQualityScoreMode = "off" | "gemini-3.7";

export interface EnhancementFormDraft {
  roughThoughts: string;
  target: PromptTarget;
  project: string;
  repositoryFolder: string[];
  setupMode: "smart" | "custom";
  profileId: SelectableEnhancementProfileId;
  researchLevel: EnhancementResearchLevel;
  oneRunInstruction: string;
  passCount: string;
  qualityScore: EnhanceQualityScoreMode;
  seedId?: string;
}

export function parseEnhancementFormDraft(
  source: string,
): EnhancementFormDraft | undefined {
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const draft = value as Record<string, unknown>;
    const profileId = normalizeSelectableEnhancementProfileId(
      String(draft.profileId),
    );
    if (
      typeof draft.roughThoughts !== "string" ||
      !["generic", "codex", "claude-code"].includes(String(draft.target)) ||
      typeof draft.project !== "string" ||
      !Array.isArray(draft.repositoryFolder) ||
      draft.repositoryFolder.some((path) => typeof path !== "string") ||
      !["smart", "custom"].includes(String(draft.setupMode)) ||
      !profileId ||
      !["none", "auto", "deep"].includes(String(draft.researchLevel)) ||
      typeof draft.oneRunInstruction !== "string"
    ) {
      return;
    }
    const passCount =
      draft.passCount === undefined
        ? "1"
        : ["1", "2", "3", "4", "5"].includes(String(draft.passCount))
          ? String(draft.passCount)
          : undefined;
    const qualityScore =
      draft.qualityScore === undefined
        ? "gemini-3.7"
        : draft.qualityScore === "off" || draft.qualityScore === "gemini-3.7"
          ? draft.qualityScore
          : undefined;
    if (!passCount || !qualityScore) return;
    if (
      draft.seedId !== undefined &&
      (typeof draft.seedId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          draft.seedId,
        ))
    ) {
      return;
    }
    return {
      ...draft,
      profileId,
      passCount,
      qualityScore,
    } as unknown as EnhancementFormDraft;
  } catch {
    return;
  }
}

export function restorableEnhancementFormDraft(
  stored: string | undefined,
  explicitThoughts: string,
): EnhancementFormDraft | undefined {
  if (explicitThoughts.trim() || !stored) return;
  return parseEnhancementFormDraft(stored);
}
