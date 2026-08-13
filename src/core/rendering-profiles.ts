import type { PromptTarget } from "./prompt-store.ts";

export const RENDERING_PROFILE_IDS = [
  "anthropic-reasoning-v1",
  "openai-reasoning-v1",
  "openai-codex-reasoning-v1",
  "openai-nonreasoning-v1",
  "generic-fallback-v1",
] as const;

export type RenderingProfileId = (typeof RENDERING_PROFILE_IDS)[number];
export type RenderingVendor = "anthropic" | "openai" | "none";
export type RenderingTier = "reasoning" | "non-reasoning" | "conservative";
export type IdentifierMarkup = "xml" | "markdown-backticks";
export type ContextPlacement = "evidence-first" | "instructions-first";
export type InstructionDensity =
  | "complete-spec"
  | "outcome-constraints"
  | "explicit-steps";
export type VerificationPolicy =
  | "named-checks-only"
  | "named-validation-after-changes"
  | "persist-through-verification"
  | "explicit-check-lists";
export type FrontendPolicy =
  | "anti-slop-no-named-stack"
  | "preserve-existing"
  | "never-named-stack";

export interface ProvenancedField<T> {
  value: T;
  source: string;
  verified: string;
}

export interface RenderingProfile {
  id: RenderingProfileId;
  vendor: RenderingVendor;
  tier: RenderingTier;
  identifierMarkup: IdentifierMarkup;
  contextPlacement: ProvenancedField<ContextPlacement>;
  density: ProvenancedField<InstructionDensity>;
  verification: ProvenancedField<VerificationPolicy>;
  frontend: ProvenancedField<FrontendPolicy>;
  measuredAgainstFallback: false;
}

const VERIFIED = "2026-08-13";

export const RENDERING_PROFILES: Readonly<
  Record<RenderingProfileId, RenderingProfile>
> = {
  "anthropic-reasoning-v1": {
    id: "anthropic-reasoning-v1",
    vendor: "anthropic",
    tier: "reasoning",
    identifierMarkup: "xml",
    contextPlacement: {
      value: "evidence-first",
      source: "A-BP-04",
      verified: VERIFIED,
    },
    density: {
      value: "complete-spec",
      source: "A-O5-01",
      verified: VERIFIED,
    },
    verification: {
      value: "named-checks-only",
      source: "A-O5-02",
      verified: VERIFIED,
    },
    frontend: {
      value: "anti-slop-no-named-stack",
      source: "A-S5-04",
      verified: VERIFIED,
    },
    measuredAgainstFallback: false,
  },
  "openai-reasoning-v1": {
    id: "openai-reasoning-v1",
    vendor: "openai",
    tier: "reasoning",
    identifierMarkup: "markdown-backticks",
    contextPlacement: {
      value: "instructions-first",
      source: "O-56-09",
      verified: VERIFIED,
    },
    density: {
      value: "outcome-constraints",
      source: "O-56-01",
      verified: VERIFIED,
    },
    verification: {
      value: "named-validation-after-changes",
      source: "O-56-08",
      verified: VERIFIED,
    },
    frontend: {
      value: "preserve-existing",
      source: "O-56-07",
      verified: VERIFIED,
    },
    measuredAgainstFallback: false,
  },
  "openai-codex-reasoning-v1": {
    id: "openai-codex-reasoning-v1",
    vendor: "openai",
    tier: "reasoning",
    identifierMarkup: "markdown-backticks",
    contextPlacement: {
      value: "instructions-first",
      source: "O-56-09",
      verified: VERIFIED,
    },
    density: {
      value: "outcome-constraints",
      source: "O-CDX-01",
      verified: VERIFIED,
    },
    verification: {
      value: "persist-through-verification",
      source: "O-CDX-02",
      verified: VERIFIED,
    },
    frontend: {
      value: "anti-slop-no-named-stack",
      source: "O-CDX-04",
      verified: VERIFIED,
    },
    measuredAgainstFallback: false,
  },
  "openai-nonreasoning-v1": {
    id: "openai-nonreasoning-v1",
    vendor: "openai",
    tier: "non-reasoning",
    identifierMarkup: "markdown-backticks",
    contextPlacement: {
      value: "instructions-first",
      source: "O-PE-01",
      verified: VERIFIED,
    },
    density: {
      value: "explicit-steps",
      source: "O-PE-01",
      verified: VERIFIED,
    },
    verification: {
      value: "explicit-check-lists",
      source: "O-PE-01",
      verified: VERIFIED,
    },
    frontend: {
      value: "preserve-existing",
      source: "O-56-07",
      verified: VERIFIED,
    },
    measuredAgainstFallback: false,
  },
  "generic-fallback-v1": {
    id: "generic-fallback-v1",
    vendor: "none",
    tier: "conservative",
    identifierMarkup: "markdown-backticks",
    contextPlacement: {
      value: "instructions-first",
      source: "generic-intersection",
      verified: VERIFIED,
    },
    density: {
      value: "outcome-constraints",
      source: "generic-intersection",
      verified: VERIFIED,
    },
    verification: {
      value: "named-checks-only",
      source: "generic-intersection",
      verified: VERIFIED,
    },
    frontend: {
      value: "never-named-stack",
      source: "generic-intersection",
      verified: VERIFIED,
    },
    measuredAgainstFallback: false,
  },
};

const TARGET_RENDERING_PROFILE: Readonly<Record<PromptTarget, RenderingProfileId>> =
  {
    "claude-code": "anthropic-reasoning-v1",
    codex: "openai-codex-reasoning-v1",
    generic: "generic-fallback-v1",
  };

export function isRenderingProfileId(value: string): value is RenderingProfileId {
  return (RENDERING_PROFILE_IDS as readonly string[]).includes(value);
}

export function getRenderingProfile(id: RenderingProfileId): RenderingProfile {
  return RENDERING_PROFILES[id];
}

export function resolveRenderingProfileId(target: PromptTarget): RenderingProfileId {
  return TARGET_RENDERING_PROFILE[target];
}

export function resolveRenderingProfile(target: PromptTarget): RenderingProfile {
  return getRenderingProfile(resolveRenderingProfileId(target));
}

export function renderingProfileIsStale(
  profile: RenderingProfile,
  now = new Date(),
): boolean {
  const verified = Date.parse(`${profile.contextPlacement.verified}T00:00:00Z`);
  if (!Number.isFinite(verified)) return true;
  const ageMs = now.getTime() - verified;
  return ageMs > 90 * 24 * 60 * 60 * 1000;
}

export function validateRenderingProfile(value: unknown): RenderingProfile {
  if (!isObject(value)) {
    throw new Error("Rendering profile must be an object.");
  }
  const id = String(value.id ?? "");
  if (!isRenderingProfileId(id)) {
    throw new Error(`Unknown rendering profile: ${id}.`);
  }
  const expected = RENDERING_PROFILES[id];
  if (value.vendor !== expected.vendor || value.tier !== expected.tier) {
    throw new Error(`Rendering profile ${value.id} vendor or tier drifted.`);
  }
  return expected;
}

const ADDENDA: Readonly<Record<RenderingProfileId, string>> = {
  "anthropic-reasoning-v1": `
Rendering profile: anthropic-reasoning-v1 (vendor=anthropic, tier=reasoning).
C1 context placement: put long evidence and documents above the task statement (A-BP-04).
C2 density: give a complete specification, then stop. Do not emit a step-by-step workflow (A-O5-01).
C3 verification: emit named checks only. Do not emit process scaffolding (A-O5-02).
C4 frontend: forbid generic AI aesthetics. Do not name a default component library (A-S5-04).
Use XML delimiters for mixed untrusted content (A-BP-03).
Do not merge these branches with OpenAI ordering or density.
`.trim(),
  "openai-reasoning-v1": `
Rendering profile: openai-reasoning-v1 (vendor=openai, tier=reasoning).
C1 context placement: state outcome and constraints first, then per-request evidence (O-56-09).
C2 density: outcome plus constraints, not a step list (O-56-01).
C3 verification: named validation after changes (O-56-08).
C4 frontend: preserve the existing design system. Do not name a default stack (O-56-07).
Do not use Anthropic evidence-first ordering.
`.trim(),
  "openai-codex-reasoning-v1": `
Rendering profile: openai-codex-reasoning-v1 (vendor=openai, tier=reasoning).
C1 context placement: state outcome and constraints first, then per-request evidence (O-56-09).
C2 density: outcome-first with Codex-Max tactical additions (O-CDX-01).
C3 verification: persist through named verification. Do not add preamble prompting (O-CDX-02).
C4 frontend: anti-slop; preserve existing systems. Do not emit a named default stack (O-CDX-04).
Do not use Anthropic evidence-first ordering.
`.trim(),
  "openai-nonreasoning-v1": `
Rendering profile: openai-nonreasoning-v1 (vendor=openai, tier=non-reasoning).
C1 context placement: precise instructions first, then data (O-PE-01).
C2 density: explicit steps. Prompted planning matters at low reasoning (O-PE-01).
C3 verification: explicit check lists (O-PE-01).
C4 frontend: preserve the existing design system. Do not name a default stack (O-56-07).
Do not use Anthropic evidence-first ordering.
`.trim(),
  "generic-fallback-v1": `
Rendering profile: generic-fallback-v1 (vendor=none, tier=conservative intersection).
C1 context placement: instructions first, then ordinary-size evidence. Do not claim a long-context quality ordering.
C2 density: outcome, constraints, and one stop rule. No step-by-step workflow.
C3 verification: named checks only. No double-check scaffolding.
C4 frontend: never emit a named default frontend stack.
Do not average vendor-specific opposing directives.
`.trim(),
};

export function compilerRenderingAddendum(target: PromptTarget): string {
  return ADDENDA[resolveRenderingProfileId(target)];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
