import {
  GOOGLE_GENERATE_CONTENT_BASE_ENDPOINT,
  googleThinkingLevel,
} from "./google-enhancement.ts";
import { getProviderEnhancementProfile } from "./provider-profiles.ts";
import {
  fetchProviderWithRetry,
  providerResponseErrorCode,
  type ProviderTransportOptions,
} from "./provider-transport.ts";

export const GEMINI_QUALITY_PROFILE_ID = "google-gemini-3.7-flash-v1";
export const GEMINI_QUALITY_MAX_OUTPUT_TOKENS = 512;
export const GEMINI_QUALITY_TIMEOUT_MS = 60_000;
export const GEMINI_QUALITY_SCORE_MINIMUM = 1;
export const GEMINI_QUALITY_SCORE_MAXIMUM = 10;

const QUALITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "rationale"],
  properties: {
    score: {
      type: "integer",
      minimum: GEMINI_QUALITY_SCORE_MINIMUM,
      maximum: GEMINI_QUALITY_SCORE_MAXIMUM,
    },
    rationale: { type: "string" },
  },
} as const;

export interface GeminiQualityScore {
  score: number;
  rationale: string;
  estimatedCostUsd: number;
  model: string;
}

export interface GeminiQualityOptions extends ProviderTransportOptions {
  apiKey: string;
}

export function parseGeminiQualityScore(value: unknown): {
  score: number;
  rationale: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini quality score must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  const rawScore =
    typeof record.score === "number" ? record.score : Number(record.score);
  if (!Number.isFinite(rawScore)) {
    throw new Error("Gemini quality score must be a number from 1 to 10.");
  }
  const score = Math.min(
    GEMINI_QUALITY_SCORE_MAXIMUM,
    Math.max(GEMINI_QUALITY_SCORE_MINIMUM, Math.round(rawScore)),
  );
  const rationale =
    typeof record.rationale === "string" ? record.rationale.trim() : "";
  if (!rationale) {
    throw new Error("Gemini quality score needs a short rationale.");
  }
  return { score, rationale: rationale.slice(0, 280) };
}

export function maximumGeminiQualityCostUsd(count = 1): number {
  const profile = getProviderEnhancementProfile(GEMINI_QUALITY_PROFILE_ID);
  const inputTokens = 1_500;
  const outputTokens = GEMINI_QUALITY_MAX_OUTPUT_TOKENS;
  return roundCost(
    ((inputTokens * profile.pricing.input +
      outputTokens * profile.pricing.output) /
      1_000_000) *
      Math.max(1, count),
  );
}

export async function ratePromptQuality(
  input: {
    roughThoughts: string;
    enhancedPrompt: string;
    target: string;
  },
  options: GeminiQualityOptions,
): Promise<GeminiQualityScore> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Enter a Google Gemini API key to score this prompt.");
  }
  const profile = getProviderEnhancementProfile(GEMINI_QUALITY_PROFILE_ID);
  const endpoint = `${GOOGLE_GENERATE_CONTENT_BASE_ENDPOINT}/${encodeURIComponent(profile.model)}:generateContent`;
  const response = await fetchProviderWithRetry(
    "Google",
    endpoint,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: QUALITY_SYSTEM }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  `Target: ${input.target}`,
                  "Rough thoughts:",
                  input.roughThoughts.trim() || "(empty)",
                  "Compiled prompt:",
                  input.enhancedPrompt.trim() || "(empty)",
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: GEMINI_QUALITY_MAX_OUTPUT_TOKENS,
          thinkingConfig: {
            thinkingLevel: googleThinkingLevel("low"),
          },
          responseMimeType: "application/json",
          responseJsonSchema: QUALITY_SCHEMA,
        },
      }),
    },
    GEMINI_QUALITY_TIMEOUT_MS,
    options,
  );
  if (!response.ok) {
    const code = await providerResponseErrorCode(response);
    throw new Error(
      `Google rejected the quality score request (${response.status}${code ? `, ${code}` : ""}).`,
    );
  }
  const parsed = parseGenerateContentText(await response.json());
  const score = parseGeminiQualityScore(JSON.parse(parsed.text) as unknown);
  return {
    ...score,
    model: profile.model,
    estimatedCostUsd: calculateQualityCost(parsed.usage, profile.pricing),
  };
}

const QUALITY_SYSTEM = `Score a compiled coding-agent prompt from 1 to 10.
10 means an agent can execute it without guessing missing constraints.
1 means the prompt is unusable or contradicts the rough thoughts.
Judge only the compiled prompt against the rough thoughts.
Return JSON with integer score and one short rationale sentence.
Do not rewrite the prompt.`;

interface GoogleUsage {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
  cachedContentTokenCount?: unknown;
}

function parseGenerateContentText(value: unknown): {
  text: string;
  usage: GoogleUsage;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Google returned an invalid quality score response.");
  }
  const response = value as {
    candidates?: unknown;
    promptFeedback?: { blockReason?: unknown };
    usageMetadata?: GoogleUsage;
  };
  if (response.promptFeedback?.blockReason) {
    throw new Error(
      `Google blocked the quality score (${String(response.promptFeedback.blockReason).slice(0, 100)}).`,
    );
  }
  if (!Array.isArray(response.candidates) || response.candidates.length !== 1) {
    throw new Error("Google returned an unexpected quality score candidate count.");
  }
  const candidate = response.candidates[0];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Google returned an invalid quality score candidate.");
  }
  const content = (candidate as { content?: { parts?: unknown } }).content;
  if (!content || !Array.isArray(content.parts)) {
    throw new Error("Google returned no quality score content.");
  }
  const text = content.parts
    .filter(
      (part): part is { text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        !Array.isArray(part) &&
        (part as { thought?: unknown }).thought !== true &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error("Google returned no quality score text.");
  return { text, usage: response.usageMetadata ?? {} };
}

function calculateQualityCost(
  usage: GoogleUsage,
  pricing: { input: number; cachedInput: number; output: number },
): number {
  const promptTokens = nonNegativeInteger(usage.promptTokenCount);
  const cachedInputTokens = Math.min(
    promptTokens,
    nonNegativeInteger(usage.cachedContentTokenCount),
  );
  const uncachedInputTokens = Math.max(0, promptTokens - cachedInputTokens);
  const outputTokens =
    nonNegativeInteger(usage.candidatesTokenCount) +
    nonNegativeInteger(usage.thoughtsTokenCount);
  return roundCost(
    (uncachedInputTokens * pricing.input +
      cachedInputTokens * pricing.cachedInput +
      outputTokens * pricing.output) /
      1_000_000,
  );
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
