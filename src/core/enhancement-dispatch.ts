import {
  enhanceWithAnthropic,
  type AnthropicEnhancementOptions,
} from "./anthropic-enhancement.ts";
import {
  enhanceWithDeepSeek,
  type DeepSeekEnhancementOptions,
} from "./deepseek-enhancement.ts";
import {
  enhanceWithOpenAI,
  type EnhancementCompilerPolicy,
  type EnhancementRequest,
  type EnhancementRun,
  type EnhancementProvider,
  type OpenAIEnhancementOptions,
} from "./enhancement.ts";
import {
  enhanceWithGoogle,
  type GoogleEnhancementOptions,
} from "./google-enhancement.ts";
import {
  defaultCompilerStatePath,
  loadActiveCompilerPolicy,
} from "./compiler-state.ts";
import { getFeatureStatus, type FeatureStatus } from "./features.ts";
import { localProviderKeyFromEnvironmentName } from "./provider-keys.ts";
import {
  getProviderEnhancementProfile,
  normalizeSelectableEnhancementProfileId,
} from "./provider-profiles.ts";

export interface EnhancementDispatchOptions {
  apiKey: string;
  signal?: AbortSignal;
  fetchers?: Partial<Record<EnhancementProvider, typeof fetch>>;
  compilerPolicy?: EnhancementCompilerPolicy;
}

export async function dispatchEnhancement(
  request: EnhancementRequest,
  options: EnhancementDispatchOptions,
): Promise<EnhancementRun> {
  const effectiveRequest = options.compilerPolicy
    ? { ...request, compilerPolicy: options.compilerPolicy }
    : request;
  const profileId = normalizeSelectableEnhancementProfileId(
    effectiveRequest.profileId,
  );
  if (!profileId) {
    throw new Error(
      `Profile ${effectiveRequest.profileId} is not available for interactive enhancement.`,
    );
  }
  const mappedRequest = { ...effectiveRequest, profileId };
  const profile = getProviderEnhancementProfile(profileId);
  const common = {
    apiKey: options.apiKey,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.fetchers?.[profile.provider]
      ? { fetcher: options.fetchers[profile.provider] }
      : {}),
  };
  if (profile.provider === "openai") {
    return enhanceWithOpenAI(
      mappedRequest,
      common as OpenAIEnhancementOptions,
    );
  }
  if (profile.provider === "anthropic") {
    return enhanceWithAnthropic(
      mappedRequest,
      common as AnthropicEnhancementOptions,
    );
  }
  if (profile.provider === "deepseek") {
    return enhanceWithDeepSeek(
      mappedRequest,
      common as DeepSeekEnhancementOptions,
    );
  }
  if (profile.provider === "google") {
    return enhanceWithGoogle(
      mappedRequest,
      common as GoogleEnhancementOptions,
    );
  }
  throw new Error(
    `Provider ${profile.provider} is not available for interactive enhancement. No provider fallback occurred.`,
  );
}

export async function activeCompilerPolicyForStatuses(
  statuses: FeatureStatus[],
  compilerStatePath = defaultCompilerStatePath(),
): Promise<EnhancementCompilerPolicy | undefined> {
  if (getFeatureStatus(statuses, "optimization").effectiveState !== "active") {
    return undefined;
  }
  return loadActiveCompilerPolicy(compilerStatePath);
}

export function providerKeyFromEnvironment(
  provider: EnhancementProvider,
  env: Readonly<Record<string, string | undefined>> = {},
): { name: string; value: string } {
  const name =
    provider === "anthropic"
      ? "ANTHROPIC_API_KEY"
      : provider === "google"
        ? "GEMINI_API_KEY"
        : provider === "deepseek"
          ? "DEEPSEEK_API_KEY"
          : "OPENAI_API_KEY";
  const value =
    env[name]?.trim() || localProviderKeyFromEnvironmentName(name);
  if (!value) {
    throw new Error(
      `Set ${name} in the current process environment. API keys are not accepted as tool arguments.`,
    );
  }
  return { name, value };
}
