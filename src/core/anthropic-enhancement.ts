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

export const ANTHROPIC_MESSAGES_ENDPOINT =
  "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_API_VERSION = "2023-06-01";
export const ANTHROPIC_PRIVACY_DISCLOSURE_VERSION =
  "anthropic-standard-messages-v1";

export interface AnthropicEnhancementOptions extends ProviderTransportOptions {
  apiKey: string;
}

interface AnthropicUsage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
}

interface AnthropicResponse {
  id?: unknown;
  type?: unknown;
  content?: unknown;
  stop_reason?: unknown;
  stop_details?: unknown;
  usage?: AnthropicUsage;
}

export function buildAnthropicMessageRequest(
  request: EnhancementRequest,
  profile: EnhancementRunProfile,
  override?: { system: string; input: string },
): Record<string, unknown> {
  return {
    model: profile.model,
    max_tokens: profile.maxOutputTokens,
    system: override?.system ?? enhancementCompilerInstructions(request),
    messages: [
      {
        role: "user",
        content: override?.input ?? enhancementCompilerInput(request),
      },
    ],
    output_config: {
      effort: profile.reasoningEffort,
      format: {
        type: "json_schema",
        schema: enhancementResultSchemaForProvider(),
      },
    },
  };
}

export async function enhanceWithAnthropic(
  unvalidatedRequest: EnhancementRequest,
  options: AnthropicEnhancementOptions,
): Promise<EnhancementRun> {
  const request = validateEnhancementRequest(unvalidatedRequest);
  if (request.profileId !== "anthropic-sonnet-5-v1") {
    throw new Error(
      `Profile ${request.profileId} cannot be sent to Anthropic. No provider fallback occurred.`,
    );
  }
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Enter an Anthropic API key for this enhancement run.");
  }
  const profile = getProviderEnhancementProfile(request.profileId);
  const startedAt = new Date();
  const response = await fetchProviderWithRetry(
    "Anthropic",
    ANTHROPIC_MESSAGES_ENDPOINT,
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAnthropicMessageRequest(request, profile)),
    },
    profile.timeoutMs,
    options,
  );

  if (!response.ok) {
    const code = await providerResponseErrorCode(response);
    throw new Error(
      `Anthropic rejected the enhancement request (${response.status}${code ? `, ${code}` : ""}). No prompt was saved and no provider fallback occurred.`,
    );
  }

  const parsed = parseAnthropicResponse(await response.json());
  let result = parseValidatedResult(parsed.outputText, request, "Anthropic");
  const usages = [calculateAnthropicUsage(parsed.usage, profile)];
  const responseIds = [parsed.responseId];

  // Independent reviewer pass: the same contract, applied to the candidate.
  if (profile.passes === 2 || request.selfReview) {
    const reviewResponse = await fetchProviderWithRetry(
      "Anthropic",
      ANTHROPIC_MESSAGES_ENDPOINT,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildAnthropicMessageRequest(request, profile, {
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
        `Anthropic rejected the review pass (${reviewResponse.status}${code ? `, ${code}` : ""}). No prompt was saved.`,
      );
    }
    const reviewed = parseAnthropicResponse(await reviewResponse.json());
    result = parseValidatedResult(reviewed.outputText, request, "Anthropic");
    usages.push(calculateAnthropicUsage(reviewed.usage, profile));
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

function parseAnthropicResponse(value: unknown): {
  responseId: string;
  outputText: string;
  usage: AnthropicUsage;
} {
  if (!isObject(value)) {
    throw new Error("Anthropic returned an invalid response.");
  }
  const response = value as AnthropicResponse;
  const responseId =
    typeof response.id === "string" && response.id
      ? response.id
      : "<unavailable>";
  if (response.type !== "message") {
    throw new Error(
      `Anthropic returned an unexpected response type for ${responseId}. No prompt was saved.`,
    );
  }
  if (response.stop_reason === "refusal") {
    throw new Error(
      `Anthropic declined this enhancement for ${responseId}. No prompt was saved.`,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `Anthropic reached the output limit for ${responseId}. No incomplete prompt was saved.`,
    );
  }
  if (response.stop_reason !== "end_turn") {
    throw new Error(
      `Anthropic returned ${String(response.stop_reason ?? "no completion reason")} for ${responseId}. No prompt was saved.`,
    );
  }
  if (!Array.isArray(response.content)) {
    throw new Error("Anthropic returned no enhancement content.");
  }
  const outputText = response.content
    .filter(
      (block): block is Record<string, unknown> =>
        isObject(block) &&
        block.type === "text" &&
        typeof block.text === "string",
    )
    .map((block) => String(block.text))
    .join("")
    .trim();
  if (!outputText) {
    throw new Error("Anthropic returned no structured text result.");
  }
  return {
    responseId,
    outputText,
    usage: response.usage ?? {},
  };
}

function calculateAnthropicUsage(
  usage: AnthropicUsage,
  profile: EnhancementRunProfile,
): EnhancementUsage {
  const uncachedInputTokens = nonNegativeInteger(usage.input_tokens);
  const cachedInputTokens = nonNegativeInteger(usage.cache_read_input_tokens);
  const cacheWriteTokens = nonNegativeInteger(
    usage.cache_creation_input_tokens,
  );
  const outputTokens = nonNegativeInteger(usage.output_tokens);
  const inputTokens =
    uncachedInputTokens + cachedInputTokens + cacheWriteTokens;
  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningTokens: 0,
    estimatedCostUsd: roundCost(
      (uncachedInputTokens * profile.pricing.input +
        cachedInputTokens * profile.pricing.cachedInput +
        cacheWriteTokens * profile.pricing.cacheWrite +
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
