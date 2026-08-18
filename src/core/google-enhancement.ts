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
import { googleVisionContentPart } from "./enhancement-vision.ts";
import { getProviderEnhancementProfile } from "./provider-profiles.ts";
import {
  fetchProviderWithRetry,
  providerResponseErrorCode,
  type ProviderTransportOptions,
} from "./provider-transport.ts";

export const GOOGLE_GENERATE_CONTENT_BASE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";
export const GOOGLE_PRIVACY_DISCLOSURE_VERSION =
  "gemini-generate-content-tier-aware-v1";

export interface GoogleEnhancementOptions extends ProviderTransportOptions {
  apiKey: string;
}

interface GoogleUsage {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
  cachedContentTokenCount?: unknown;
  totalTokenCount?: unknown;
}

interface GoogleResponse {
  responseId?: unknown;
  modelVersion?: unknown;
  candidates?: unknown;
  promptFeedback?: unknown;
  usageMetadata?: GoogleUsage;
}

export function buildGoogleGenerateContentRequest(
  request: EnhancementRequest,
  profile: EnhancementRunProfile,
  override?: { system: string; input: string },
): Record<string, unknown> {
  return {
    systemInstruction: {
      parts: [
        { text: override?.system ?? enhancementCompilerInstructions(request) },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: override?.input ?? enhancementCompilerInput(request) },
          ...(request.vision ? [googleVisionContentPart(request.vision)] : []),
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: profile.maxOutputTokens,
      thinkingConfig: {
        thinkingLevel: profile.reasoningEffort,
      },
      responseMimeType: "application/json",
      responseSchema: withoutAdditionalProperties(
        enhancementResultSchemaForProvider(),
      ),
    },
  };
}

export async function enhanceWithGoogle(
  unvalidatedRequest: EnhancementRequest,
  options: GoogleEnhancementOptions,
): Promise<EnhancementRun> {
  const request = validateEnhancementRequest(unvalidatedRequest);
  if (
    request.profileId !== "google-gemini-3.5-flash-v1" &&
    request.profileId !== "google-gemini-3.7-flash-v1"
  ) {
    throw new Error(
      `Profile ${request.profileId} cannot be sent to Google. No provider fallback occurred.`,
    );
  }
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Enter a Google Gemini API key for this enhancement run.");
  }
  const profile = getProviderEnhancementProfile(request.profileId);
  const endpoint = `${GOOGLE_GENERATE_CONTENT_BASE_ENDPOINT}/${encodeURIComponent(profile.model)}:generateContent`;
  const startedAt = new Date();
  const response = await fetchProviderWithRetry(
    "Google",
    endpoint,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGoogleGenerateContentRequest(request, profile)),
    },
    profile.timeoutMs,
    options,
  );

  if (!response.ok) {
    const code = await providerResponseErrorCode(response);
    throw new Error(
      `Google rejected the enhancement request (${response.status}${code ? `, ${code}` : ""}). No prompt was saved and no provider fallback occurred.`,
    );
  }

  const parsed = parseGoogleResponse(await response.json());
  let result = parseValidatedResult(parsed.outputText, request, "Google");
  const usages = [calculateGoogleUsage(parsed.usage, profile)];
  const responseIds = [parsed.responseId];

  // Independent reviewer pass: the same contract, applied to the candidate.
  if (profile.passes === 2 || request.selfReview) {
    const reviewResponse = await fetchProviderWithRetry(
      "Google",
      endpoint,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildGoogleGenerateContentRequest(request, profile, {
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
        `Google rejected the review pass (${reviewResponse.status}${code ? `, ${code}` : ""}). No prompt was saved.`,
      );
    }
    const reviewed = parseGoogleResponse(await reviewResponse.json());
    result = parseValidatedResult(reviewed.outputText, request, "Google");
    usages.push(calculateGoogleUsage(reviewed.usage, profile));
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

function parseGoogleResponse(value: unknown): {
  responseId: string;
  outputText: string;
  usage: GoogleUsage;
} {
  if (!isObject(value)) {
    throw new Error("Google returned an invalid response.");
  }
  const response = value as GoogleResponse;
  const responseId =
    typeof response.responseId === "string" && response.responseId
      ? response.responseId
      : typeof response.modelVersion === "string" && response.modelVersion
        ? response.modelVersion
        : "<unavailable>";
  if (
    isObject(response.promptFeedback) &&
    response.promptFeedback.blockReason
  ) {
    throw new Error(
      `Google blocked this enhancement (${String(response.promptFeedback.blockReason).slice(0, 100)}). No prompt was saved.`,
    );
  }
  if (!Array.isArray(response.candidates) || response.candidates.length !== 1) {
    throw new Error(
      "Google returned an unexpected candidate count. No prompt was saved.",
    );
  }
  const candidate = response.candidates[0];
  if (!isObject(candidate)) {
    throw new Error("Google returned an invalid enhancement candidate.");
  }
  if (candidate.finishReason === "MAX_TOKENS") {
    throw new Error(
      `Google reached the output limit for ${responseId}. No incomplete prompt was saved.`,
    );
  }
  if (candidate.finishReason !== "STOP") {
    throw new Error(
      `Google returned ${String(candidate.finishReason ?? "no completion reason")} for ${responseId}. No prompt was saved.`,
    );
  }
  if (!isObject(candidate.content) || !Array.isArray(candidate.content.parts)) {
    throw new Error("Google returned no enhancement content.");
  }
  const outputText = candidate.content.parts
    .filter(
      (part): part is Record<string, unknown> =>
        isObject(part) &&
        part.thought !== true &&
        typeof part.text === "string",
    )
    .map((part) => String(part.text))
    .join("")
    .trim();
  if (!outputText) {
    throw new Error("Google returned no structured text result.");
  }
  return {
    responseId,
    outputText,
    usage: response.usageMetadata ?? {},
  };
}

function calculateGoogleUsage(
  usage: GoogleUsage,
  profile: EnhancementRunProfile,
): EnhancementUsage {
  const promptTokens = nonNegativeInteger(usage.promptTokenCount);
  const cachedInputTokens = Math.min(
    promptTokens,
    nonNegativeInteger(usage.cachedContentTokenCount),
  );
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const candidateTokens = nonNegativeInteger(usage.candidatesTokenCount);
  const reasoningTokens = nonNegativeInteger(usage.thoughtsTokenCount);
  const outputTokens = candidateTokens + reasoningTokens;
  return {
    inputTokens: promptTokens,
    cachedInputTokens,
    cacheWriteTokens: 0,
    outputTokens,
    reasoningTokens,
    estimatedCostUsd: roundCost(
      (uncachedInputTokens * profile.pricing.input +
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

// Gemini generateContent rejects additionalProperties on response_schema.
function withoutAdditionalProperties(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutAdditionalProperties);
  }
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, child]) => [key, withoutAdditionalProperties(child)]),
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
