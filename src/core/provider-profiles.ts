import {
  estimatedMaximumCostForProfileUsd,
  getEnhancementProfile,
  privacyDisclosure,
  type EnhancementProviderProfileId,
  type EnhancementRequest,
  type EnhancementRunProfile,
} from "./enhancement.ts";
import type { FeatureState } from "./features.ts";

export const SELECTABLE_ENHANCEMENT_PROFILE_IDS = [
  "openai-standard-v1",
  "openai-deep-v1",
  "anthropic-sonnet-5-v1",
  "google-gemini-3.7-flash-v1",
  "deepseek-v4-pro-v1",
] as const satisfies readonly EnhancementProviderProfileId[];

export type SelectableEnhancementProfileId =
  (typeof SELECTABLE_ENHANCEMENT_PROFILE_IDS)[number];

export interface EnhancementProviderStates {
  anthropic: FeatureState;
  google: FeatureState;
  deepseek: FeatureState;
}

const LEGACY_SELECTABLE_ENHANCEMENT_PROFILE_IDS = {
  "google-gemini-3.5-flash-v1": "google-gemini-3.7-flash-v1",
} as const satisfies Record<string, SelectableEnhancementProfileId>;

export function normalizeSelectableEnhancementProfileId(
  value: string | undefined,
): SelectableEnhancementProfileId | undefined {
  const requested = value?.trim();
  if (!requested) return;
  const mapped =
    requested in LEGACY_SELECTABLE_ENHANCEMENT_PROFILE_IDS
      ? LEGACY_SELECTABLE_ENHANCEMENT_PROFILE_IDS[
          requested as keyof typeof LEGACY_SELECTABLE_ENHANCEMENT_PROFILE_IDS
        ]
      : requested;
  if (
    (SELECTABLE_ENHANCEMENT_PROFILE_IDS as readonly string[]).includes(mapped)
  ) {
    return mapped as SelectableEnhancementProfileId;
  }
}

export function enhancementProfileIsAvailable(
  id: SelectableEnhancementProfileId,
  states: EnhancementProviderStates,
): boolean {
  const provider = getProviderEnhancementProfile(id).provider;
  if (provider === "anthropic") return states.anthropic !== "disabled";
  if (provider === "google") return states.google !== "disabled";
  if (provider === "deepseek") return states.deepseek !== "disabled";
  return true;
}

export const FALLBACK_ENHANCEMENT_PROFILE_ID: SelectableEnhancementProfileId =
  "openai-standard-v1";

/**
 * Resolves the Default Model preference. An unknown value, or a provider whose
 * activation is still Disabled, falls back to OpenAI Standard so the form never
 * opens on a profile the user cannot run.
 */
export function resolveDefaultEnhancementProfileId(
  preference: string | undefined,
  states: EnhancementProviderStates,
): SelectableEnhancementProfileId {
  const requested = normalizeSelectableEnhancementProfileId(preference);
  if (!requested) return FALLBACK_ENHANCEMENT_PROFILE_ID;
  return enhancementProfileIsAvailable(requested, states)
    ? requested
    : FALLBACK_ENHANCEMENT_PROFILE_ID;
}

const SONNET_5_STANDARD_PRICING_START = Date.parse("2026-09-01T00:00:00.000Z");
const GEMINI_37_STANDARD_PRICING_START = Date.parse("2027-01-01T00:00:00.000Z");
const DEEPSEEK_PEAK_PRICING_START = Date.parse("2026-08-16T16:00:00.000Z");

export function getProviderEnhancementProfile(
  id: SelectableEnhancementProfileId,
  at = new Date(),
): EnhancementRunProfile {
  if (id === "openai-standard-v1" || id === "openai-deep-v1") {
    return getEnhancementProfile(id);
  }
  if (id === "anthropic-sonnet-5-v1") {
    const introductoryPricing = at.getTime() < SONNET_5_STANDARD_PRICING_START;
    return {
      id,
      title: "Anthropic · Claude Sonnet 5",
      provider: "anthropic",
      model: "claude-sonnet-5",
      reasoningEffort: "xhigh",
      textVerbosity: "structured",
      maxOutputTokens: 16_000,
      timeoutMs: 300_000,
      passes: 1,
      purpose:
        "Quality challenger using Claude Sonnet 5 with xhigh adaptive thinking.",
      pricing: {
        input: introductoryPricing ? 2 : 3,
        cachedInput: introductoryPricing ? 0.2 : 0.3,
        cacheWrite: introductoryPricing ? 2.5 : 3.75,
        output: introductoryPricing ? 10 : 15,
      },
    };
  }
  if (id === "deepseek-v4-pro-v1") {
    const peakPricing = at.getTime() >= DEEPSEEK_PEAK_PRICING_START;
    return {
      id,
      title: "DeepSeek · V4 Pro",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      reasoningEffort: "max",
      textVerbosity: "structured",
      maxOutputTokens: 16_000,
      timeoutMs: 300_000,
      passes: 1,
      purpose: "DeepSeek V4 Pro with max thinking.",
      pricing: peakPricing
        ? {
            input: 1.32,
            cachedInput: 0.044,
            cacheWrite: 0,
            output: 3.96,
          }
        : {
            input: 0.435,
            cachedInput: 0.003625,
            cacheWrite: 0,
            output: 0.87,
          },
    };
  }
  const introductoryPricing = at.getTime() < GEMINI_37_STANDARD_PRICING_START;
  return {
    id,
    title: "Google · Gemini 3.7 Flash",
    provider: "google",
    model: "gemini-3.7-flash",
    reasoningEffort: "max",
    textVerbosity: "structured",
    maxOutputTokens: 16_000,
    timeoutMs: 300_000,
    passes: 1,
    purpose: "Cost challenger using Gemini 3.7 Flash with max thinking.",
    pricing: {
      input: introductoryPricing ? 0.75 : 1.5,
      cachedInput: introductoryPricing ? 0.075 : 0.15,
      cacheWrite: 0,
      output: introductoryPricing ? 3.75 : 7.5,
    },
  };
}

export function estimatedProviderMaximumCostUsd(
  request: EnhancementRequest,
): number {
  const profileId = normalizeSelectableEnhancementProfileId(request.profileId);
  if (!profileId) {
    throw new Error(
      `Profile ${request.profileId} is not available for interactive enhancement.`,
    );
  }
  return estimatedMaximumCostForProfileUsd(
    { ...request, profileId },
    getProviderEnhancementProfile(profileId),
  );
}

export function providerPrivacyDisclosure(
  profile: EnhancementRunProfile,
): string {
  if (profile.provider === "openai") {
    return privacyDisclosure(getEnhancementProfile(profile.id));
  }
  if (profile.provider === "anthropic") {
    return "Anthropic receives the reviewed prompt in one stateless Messages request. Anthropic documents structured-output prompts and responses as zero-data-retention data, while the JSON schema may be cached for up to 24 hours; its separate trust-and-safety rules can still apply. Prompt Studio does not enable prompt caching or tools.";
  }
  if (profile.provider === "deepseek") {
    return "DeepSeek receives the reviewed prompt in one stateless Chat Completions request. DeepSeek documents the API as stateless across turns and isolates automatic disk cache per account. Prompt Studio does not enable tools. DeepSeek's separate content-safety and account terms still apply.";
  }
  return "Google receives the reviewed prompt in one stateless generateContent request with no tools or search. Google says paid Gemini API content is not used to improve its products, while free-tier content may be; limited abuse-monitoring logs can still apply unless the API project has separately approved zero-data-retention controls. Prompt Studio cannot infer whether a key belongs to a free or paid project.";
}

export function providerPricingDisclosure(
  profile: EnhancementRunProfile,
  at = new Date(),
): string {
  if (profile.provider === "anthropic") {
    return at.getTime() < SONNET_5_STANDARD_PRICING_START
      ? "Estimate uses Anthropic's introductory Sonnet 5 price of $2 per million input tokens and $10 per million output tokens through August 31, 2026. The profile automatically uses the announced $3/$15 standard price from September 1, 2026."
      : "Estimate uses Anthropic's announced Sonnet 5 standard price of $3 per million input tokens and $15 per million output tokens from September 1, 2026.";
  }
  if (profile.provider === "google") {
    return at.getTime() < GEMINI_37_STANDARD_PRICING_START
      ? "Estimate uses Google's introductory Gemini 3.7 Flash price of $0.75 per million input tokens and $3.75 per million output tokens through December 31, 2026, including thinking tokens. The profile automatically uses the announced $1.50/$7.50 standard price from January 1, 2027. A free-tier key may not incur token charges."
      : "Estimate uses Google's announced Gemini 3.7 Flash standard price of $1.50 per million input tokens and $7.50 per million output tokens from January 1, 2027, including thinking tokens. A free-tier key may not incur token charges.";
  }
  if (profile.provider === "deepseek") {
    return at.getTime() < DEEPSEEK_PEAK_PRICING_START
      ? "Estimate uses DeepSeek V4 Pro current price of $0.435 per million cache-miss input tokens and $0.87 per million output tokens, including thinking tokens. From 16:00 UTC on August 16, 2026 the estimate uses peak price of $1.32 / $3.96."
      : "Estimate uses DeepSeek V4 Pro peak price of $1.32 per million cache-miss input tokens and $3.96 per million output tokens, including thinking tokens. Off-peak hours are cheaper; Prompt Studio uses peak price for the maximum estimate.";
  }
  return "";
}
