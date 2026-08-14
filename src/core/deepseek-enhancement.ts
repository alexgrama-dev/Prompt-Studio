import {
  ENHANCEMENT_OUTPUT_SCHEMA_VERSION,
  enhancementCompilerInput,
  enhancementCompilerInstructions,
  enhancementCompilerVersion,
  enhancementResultSchemaForProvider,
  attachCompilerCritique,
  finalizeEnhancementResult,
  REVIEWER_INSTRUCTIONS,
  reviewerInput,
  sumEnhancementUsage,
  validateEnhancementRequest,
  type EnhancementRequest,
  type EnhancementResult,
  type EnhancementRun,
  type EnhancementRunProfile,
  type EnhancementUsage,
} from "./enhancement.ts";
import { getProviderEnhancementProfile } from "./provider-profiles.ts";
import {
  fetchProviderWithRetry,
  providerResponseErrorCode,
  type ProviderTransportOptions,
} from "./provider-transport.ts";

export const DEEPSEEK_CHAT_COMPLETIONS_ENDPOINT =
  "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_PRIVACY_DISCLOSURE_VERSION =
  "deepseek-chat-completions-stateless-v1";

export function deepseekReasoningEffort(effort: string): "low" | "high" | "max" {
  if (effort === "low") return "low";
  if (effort === "max") return "max";
  return "high";
}

export interface DeepSeekEnhancementOptions extends ProviderTransportOptions {
  apiKey: string;
}

interface DeepSeekUsage {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  prompt_cache_hit_tokens?: unknown;
  prompt_cache_miss_tokens?: unknown;
  completion_tokens_details?: { reasoning_tokens?: unknown };
}

interface DeepSeekResponse {
  id?: unknown;
  choices?: unknown;
  usage?: DeepSeekUsage;
}

export function buildDeepSeekChatCompletionRequest(
  request: EnhancementRequest,
  profile: EnhancementRunProfile,
  override?: { system: string; input: string },
): Record<string, unknown> {
  const compiler =
    override?.system ?? enhancementCompilerInstructions(request);
  return {
    model: profile.model,
    messages: [
      {
        role: "system",
        content: `${compiler}\n\nReturn only a JSON object that matches this schema:\n${JSON.stringify(enhancementResultSchemaForProvider())}`,
      },
      {
        role: "user",
        content: override?.input ?? enhancementCompilerInput(request),
      },
    ],
    reasoning_effort: deepseekReasoningEffort(profile.reasoningEffort),
    thinking: { type: "enabled" },
    response_format: { type: "json_object" },
    max_tokens: profile.maxOutputTokens,
    stream: false,
  };
}

export async function enhanceWithDeepSeek(
  unvalidatedRequest: EnhancementRequest,
  options: DeepSeekEnhancementOptions,
): Promise<EnhancementRun> {
  const request = validateEnhancementRequest(unvalidatedRequest);
  if (request.profileId !== "deepseek-v4-pro-v1") {
    throw new Error(
      `Profile ${request.profileId} cannot be sent to DeepSeek. No provider fallback occurred.`,
    );
  }
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Enter a DeepSeek API key for this enhancement run.");
  }
  const profile = getProviderEnhancementProfile(request.profileId);
  const startedAt = new Date();
  const response = await fetchProviderWithRetry(
    "DeepSeek",
    DEEPSEEK_CHAT_COMPLETIONS_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildDeepSeekChatCompletionRequest(request, profile),
      ),
    },
    profile.timeoutMs,
    options,
  );

  if (!response.ok) {
    const code = await providerResponseErrorCode(response);
    throw new Error(
      `DeepSeek rejected the enhancement request (${response.status}${code ? `, ${code}` : ""}). No prompt was saved and no provider fallback occurred.`,
    );
  }

  const parsed = parseDeepSeekResponse(await response.json());
  let result = parseValidatedResult(parsed.outputText, request, "DeepSeek");
  const usages = [calculateDeepSeekUsage(parsed.usage, profile)];
  const responseIds = [parsed.responseId];

  if (profile.passes === 2 || request.selfReview) {
    const reviewResponse = await fetchProviderWithRetry(
      "DeepSeek",
      DEEPSEEK_CHAT_COMPLETIONS_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildDeepSeekChatCompletionRequest(request, profile, {
            system: `${REVIEWER_INSTRUCTIONS}\n\nCompiler contract:\n${enhancementCompilerInstructions(request)}`,
            input: reviewerInput(request, result),
          }),
        ),
      },
      profile.timeoutMs,
      options,
    );
    if (!reviewResponse.ok) {
      const code = await providerResponseErrorCode(reviewResponse);
      throw new Error(
        `DeepSeek rejected the review pass (${reviewResponse.status}${code ? `, ${code}` : ""}). No prompt was saved.`,
      );
    }
    const reviewed = parseDeepSeekResponse(await reviewResponse.json());
    result = parseValidatedResult(reviewed.outputText, request, "DeepSeek");
    usages.push(calculateDeepSeekUsage(reviewed.usage, profile));
    responseIds.push(reviewed.responseId);
  }

  const completedAt = new Date();
  return attachCompilerCritique(
    {
      result,
      profile,
      compilerVersion: enhancementCompilerVersion(request),
      outputSchemaVersion: ENHANCEMENT_OUTPUT_SCHEMA_VERSION,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      usage: sumEnhancementUsage(usages),
      responseIds,
    },
    request,
  );
}

function parseDeepSeekResponse(value: unknown): {
  responseId: string;
  outputText: string;
  usage: DeepSeekUsage;
} {
  if (!isObject(value)) {
    throw new Error("DeepSeek returned an invalid response.");
  }
  const response = value as DeepSeekResponse;
  const responseId =
    typeof response.id === "string" && response.id
      ? response.id
      : "<unavailable>";
  if (!Array.isArray(response.choices) || response.choices.length !== 1) {
    throw new Error(
      "DeepSeek returned an unexpected choice count. No prompt was saved.",
    );
  }
  const choice = response.choices[0];
  if (!isObject(choice)) {
    throw new Error("DeepSeek returned an invalid enhancement choice.");
  }
  if (choice.finish_reason === "length") {
    throw new Error(
      `DeepSeek reached the output limit for ${responseId}. No incomplete prompt was saved.`,
    );
  }
  if (choice.finish_reason !== "stop") {
    throw new Error(
      `DeepSeek returned ${String(choice.finish_reason ?? "no completion reason")} for ${responseId}. No prompt was saved.`,
    );
  }
  if (!isObject(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("DeepSeek returned no enhancement content.");
  }
  const outputText = choice.message.content.trim();
  if (!outputText) {
    throw new Error(
      "DeepSeek returned no structured text result. Thinking tokens may have exhausted max_tokens. No prompt was saved.",
    );
  }
  return {
    responseId,
    outputText,
    usage: response.usage ?? {},
  };
}

function calculateDeepSeekUsage(
  usage: DeepSeekUsage,
  profile: EnhancementRunProfile,
): EnhancementUsage {
  const cachedInputTokens = nonNegativeInteger(usage.prompt_cache_hit_tokens);
  const uncachedInputTokens = nonNegativeInteger(
    usage.prompt_cache_miss_tokens,
  );
  const promptTokens = nonNegativeInteger(usage.prompt_tokens);
  const inputTokens =
    cachedInputTokens + uncachedInputTokens > 0
      ? cachedInputTokens + uncachedInputTokens
      : promptTokens;
  const billedUncached = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = nonNegativeInteger(usage.completion_tokens);
  const reasoningTokens = nonNegativeInteger(
    isObject(usage.completion_tokens_details)
      ? usage.completion_tokens_details.reasoning_tokens
      : 0,
  );
  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens: 0,
    outputTokens,
    reasoningTokens,
    estimatedCostUsd: roundCost(
      (billedUncached * profile.pricing.input +
        cachedInputTokens * profile.pricing.cachedInput +
        outputTokens * profile.pricing.output) /
        1_000_000,
    ),
  };
}

function parseValidatedResult(
  text: string,
  request: EnhancementRequest,
  provider: string,
): EnhancementResult {
  try {
    return finalizeEnhancementResult(JSON.parse(text) as unknown, request);
  } catch (error) {
    throw new Error(
      `${provider} returned an invalid structured result: ${error instanceof Error ? error.message : String(error)} No prompt was saved.`,
    );
  }
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : 0;
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
