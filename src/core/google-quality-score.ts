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

const COMPARATIVE_LABELS = ["A", "B", "C", "D", "E"] as const;

const COMPARATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["order", "rationale"],
  properties: {
    order: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 16 },
    },
    rationale: { type: "string" },
  },
} as const;

export interface GeminiComparativeRank {
  order: number[];
  rationale: string;
  estimatedCostUsd: number;
  model: string;
}

export interface BlindQualityCandidate {
  label: string;
  index: number;
  enhancedPrompt: string;
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

export function parseGeminiComparativeRank(
  value: unknown,
  labels: readonly string[],
): { order: string[]; rationale: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini comparative rank must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.order)) {
    throw new Error("Gemini comparative rank needs an order array.");
  }
  const allowed = new Set(labels);
  const order: string[] = [];
  for (const item of record.order) {
    if (typeof item !== "string") {
      throw new Error("Gemini comparative rank order must use prompt labels.");
    }
    const label = normalizeComparativeLabel(item, allowed);
    if (!label) {
      throw new Error(`Gemini comparative rank used an unknown label: ${item}.`);
    }
    if (order.includes(label)) {
      throw new Error("Gemini comparative rank repeated a prompt label.");
    }
    order.push(label);
  }
  if (order.length !== labels.length) {
    throw new Error("Gemini comparative rank must include every prompt once.");
  }
  const rationale =
    typeof record.rationale === "string" ? record.rationale.trim() : "";
  if (!rationale) {
    throw new Error("Gemini comparative rank needs a short rationale.");
  }
  return { order, rationale: rationale.slice(0, 280) };
}

export function mapBlindRankToIndexes(
  order: readonly string[],
  presented: readonly Pick<BlindQualityCandidate, "label" | "index">[],
): number[] {
  const byLabel = new Map(
    presented.map((candidate) => [candidate.label, candidate.index]),
  );
  return order.map((label) => {
    const index = byLabel.get(label);
    if (index === undefined) {
      throw new Error(`Gemini comparative rank used an unknown label: ${label}.`);
    }
    return index;
  });
}

export function presentBlindQualityCandidates(
  prompts: readonly { index: number; enhancedPrompt: string }[],
  shuffle: <T>(items: T[]) => T[] = shuffleCopy,
): BlindQualityCandidate[] {
  return shuffle([...prompts]).map((prompt, position) => ({
    ...prompt,
    label: COMPARATIVE_LABELS[position] ?? `P${position + 1}`,
  }));
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

export async function rankCompiledPrompts(
  input: {
    roughThoughts: string;
    target: string;
    prompts: readonly { index: number; enhancedPrompt: string }[];
  },
  options: GeminiQualityOptions & {
    present?: (
      prompts: readonly { index: number; enhancedPrompt: string }[],
    ) => BlindQualityCandidate[];
  },
): Promise<GeminiComparativeRank> {
  if (input.prompts.length < 2) {
    throw new Error("Comparative ranking needs at least two compiled prompts.");
  }
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Enter a Google Gemini API key to rank these prompts.");
  }
  const presented = (options.present ?? presentBlindQualityCandidates)(
    input.prompts,
  );
  const labels = presented.map((candidate) => candidate.label);
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
          parts: [{ text: COMPARATIVE_SYSTEM }],
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
                  "Rank these compiled prompts from best to worst. Use each label once.",
                  ...presented.map(
                    (candidate) =>
                      `Prompt ${candidate.label}:\n\n${candidate.enhancedPrompt.trim() || "(empty)"}`,
                  ),
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
          responseJsonSchema: COMPARATIVE_SCHEMA,
        },
      }),
    },
    GEMINI_QUALITY_TIMEOUT_MS,
    options,
  );
  if (!response.ok) {
    const code = await providerResponseErrorCode(response);
    throw new Error(
      `Google rejected the comparative rank request (${response.status}${code ? `, ${code}` : ""}).`,
    );
  }
  const parsed = parseGenerateContentText(await response.json());
  const ranked = parseGeminiComparativeRank(
    JSON.parse(parsed.text) as unknown,
    labels,
  );
  return {
    order: mapBlindRankToIndexes(ranked.order, presented),
    rationale: ranked.rationale,
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

const COMPARATIVE_SYSTEM = `Rank compiled coding-agent prompts for the same rough thoughts.
Best means an agent can execute with the least guessing and the fewest extra words.
You see every candidate. Return a strict best-to-worst order with no ties.
Use each prompt label exactly once. Do not rewrite the prompts.
Return JSON with order (array of labels) and one short rationale sentence.`;

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

function normalizeComparativeLabel(
  value: string,
  allowed: ReadonlySet<string>,
): string | undefined {
  const trimmed = value.trim().toUpperCase().replace(/^PROMPT\s+/, "");
  const letter = trimmed.match(/^([A-E])\b/)?.[1];
  if (letter && allowed.has(letter)) return letter;
  if (allowed.has(trimmed)) return trimmed;
}

function shuffleCopy<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) continue;
    next[index] = other;
    next[swap] = current;
  }
  return next;
}
