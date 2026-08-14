import type { PromptTarget } from "./prompt-store.ts";

export const ENHANCE_LAST_SETUP_KEY = "prompt-studio.enhance-last-setup.v1";

export interface EnhanceLastSetup {
  target: PromptTarget;
  project: string;
}

export function parseEnhanceLastSetup(
  source: string | undefined,
): EnhanceLastSetup | undefined {
  if (!source) return;
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (
      !["generic", "codex", "claude-code"].includes(String(record.target)) ||
      typeof record.project !== "string"
    ) {
      return;
    }
    return {
      target: record.target as PromptTarget,
      project: record.project,
    };
  } catch {
    return;
  }
}

export function serializeEnhanceLastSetup(setup: EnhanceLastSetup): string {
  return JSON.stringify({ target: setup.target, project: setup.project });
}
