import {
  estimatedMaximumCostForProfileUsd,
  getEnhancementProfile,
  privacyDisclosure,
  type EnhancementProviderProfileId,
  type EnhancementRequest,
  type EnhancementRunProfile,
} from "./enhancement.ts";

export const SELECTABLE_ENHANCEMENT_PROFILE_IDS = [
  "openai-standard-v1",
  "openai-deep-v1",
  "anthropic-sonnet-5-v1",
  "google-gemini-3.5-flash-v1",
] as const satisfies readonly EnhancementProviderProfileId[];

export type SelectableEnhancementProfileId =
  (typeof SELECTABLE_ENHANCEMENT_PROFILE_IDS)[number];

const SONNET_5_STANDARD_PRICING_START = Date.parse("2026-09-01T00:00:00.000Z");

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
      reasoningEffort: "medium",
      textVerbosity: "structured",
      maxOutputTokens: 8_000,
      timeoutMs: 180_000,
      passes: 1,
      purpose:
        "Quality challenger using Claude Sonnet 5 with balanced adaptive thinking.",
      pricing: {
        input: introductoryPricing ? 2 : 3,
        cachedInput: introductoryPricing ? 0.2 : 0.3,
        cacheWrite: introductoryPricing ? 2.5 : 3.75,
        output: introductoryPricing ? 10 : 15,
      },
    };
  }
  return {
    id,
    title: "Google · Gemini 3.5 Flash",
    provider: "google",
    model: "gemini-3.5-flash",
    reasoningEffort: "medium",
    textVerbosity: "structured",
    maxOutputTokens: 8_000,
    timeoutMs: 180_000,
    passes: 1,
    purpose: "Cost challenger using Gemini 3.5 Flash with balanced thinking.",
    pricing: {
      input: 1.5,
      cachedInput: 0.15,
      cacheWrite: 0,
      output: 9,
    },
  };
}

export function estimatedProviderMaximumCostUsd(
  request: EnhancementRequest,
): number {
  if (
    !(SELECTABLE_ENHANCEMENT_PROFILE_IDS as readonly string[]).includes(
      request.profileId,
    )
  ) {
    throw new Error(
      `Profile ${request.profileId} is not available for interactive enhancement.`,
    );
  }
  return estimatedMaximumCostForProfileUsd(
    request,
    getProviderEnhancementProfile(
      request.profileId as SelectableEnhancementProfileId,
    ),
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
    return "Estimate uses Google Gemini 3.5 Flash paid-tier standard pricing: $1.50 per million input tokens and $9 per million output tokens, including thinking tokens. A free-tier key may not incur token charges.";
  }
  return "";
}
