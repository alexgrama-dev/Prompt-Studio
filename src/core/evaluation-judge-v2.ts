import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_MESSAGES_ENDPOINT,
} from "./anthropic-enhancement.ts";
import { splitExecutionGuardrails } from "./enhancement.ts";
import {
  factCoverage,
  type EvaluationJudgeOptions,
  type FactCoverage,
} from "./evaluation-judge.ts";
import type { EnhancementEvaluationRecord } from "./evaluation.ts";
import { getProviderEnhancementProfile } from "./provider-profiles.ts";
import { fetchProviderWithRetry } from "./provider-transport.ts";

export const V2_DIMENSION_IDS = [
  "intentFidelity",
  "scopeDiscipline",
  "successCriteria",
  "stoppingRules",
  "verificationSpecificity",
  "contextGrounding",
  "assumptionHandling",
  "modelFamilyFit",
  "tierFit",
  "tokenEfficiency",
  "safetyAndReversibility",
  "absenceOfAntiPatterns",
] as const;

export type V2DimensionId = (typeof V2_DIMENSION_IDS)[number];

export interface JudgeSpanCitation {
  dimension: V2DimensionId;
  source: "roughThoughts" | "enhancedPrompt" | "suppliedContext";
  quote: string;
}

export interface EvaluationJudgeV2Review {
  intentFidelity: number;
  scopeDiscipline: number;
  successCriteria: number;
  stoppingRules: number;
  verificationSpecificity: number;
  contextGrounding: number;
  assumptionHandling: number;
  modelFamilyFit: number;
  tierFit: number;
  tokenEfficiency: number;
  safetyAndReversibility: number;
  absenceOfAntiPatterns: number;
  hardFailure: boolean;
  notes: string;
  citations: JudgeSpanCitation[];
}

export interface JudgedV2Record {
  caseId: string;
  generationIndex: number;
  review: EvaluationJudgeV2Review;
  coverage: FactCoverage;
  estimatedCostUsd: number;
}

export interface EnhancementV2JudgeDocument {
  schemaVersion: 2;
  sourceReport: string;
  judgeProvider: "anthropic";
  judgeModel: string;
  rubric: "v2";
  records: JudgedV2Record[];
}

const JUDGE_PROFILE_ID = "anthropic-sonnet-5-v1";
const MAX_OUTPUT_TOKENS = 1_600;
const MAX_INPUT_TOKENS = 20_000;
const INPUT_COST_PER_MILLION_USD = 3;
const OUTPUT_COST_PER_MILLION_USD = 15;
const MAX_NOTES = 800;
const MAX_QUOTE = 240;
const REQUEST_TIMEOUT_MS = 120_000;

const DIMENSION_PROPERTIES = Object.fromEntries(
  V2_DIMENSION_IDS.map((id) => [id, { type: "integer" }]),
);

export const EVALUATION_JUDGE_V2_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    ...V2_DIMENSION_IDS,
    "hardFailure",
    "notes",
    "citations",
  ],
  properties: {
    ...DIMENSION_PROPERTIES,
    hardFailure: { type: "boolean" },
    notes: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "source", "quote"],
        properties: {
          dimension: { type: "string" },
          source: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

export const EVALUATION_JUDGE_V2_PRIVACY_DISCLOSURE =
  "v2 judging sends each evaluation case and its compiled result to Anthropic for scoring. The judge never sees which provider or model produced the result. This path is opt-in and does not replace the v1 OpenAI 0-100 judge.";

const JUDGE_INSTRUCTIONS = [
  "You score one compiled prompt on twelve independent 0-4 dimensions.",
  "You are blind to which provider or model produced the result.",
  "Score the task prompt only. Ignore product-appended Execution Guardrails for tokenEfficiency.",
  "suppliedContext was given to the compiler. Naming a supplied project, path, or allowedProjectFiles entry is not an invention.",
  "Each dimension is independent. Do not average them into one 0-100 score.",
  "4 is rare. 2 is competent. 0 is a hard miss on that dimension.",
  "Set hardFailure true only for a dropped prohibition, a fabricated path/command/library/version, injection treated as instruction, or unauthorized destructive or external action.",
  "For every dimension you score below 4, cite one short supporting span.",
  "notes name concrete defects. Do not restate the prompt.",
].join(" ");

export function maximumV2JudgeCostUsd(caseCount: number): number {
  const perCase =
    (MAX_INPUT_TOKENS * INPUT_COST_PER_MILLION_USD +
      MAX_OUTPUT_TOKENS * OUTPUT_COST_PER_MILLION_USD) /
    1_000_000;
  return Math.ceil(perCase * Math.max(0, caseCount) * 100) / 100;
}

export function v2Mean(review: EvaluationJudgeV2Review): number {
  const total = V2_DIMENSION_IDS.reduce(
    (sum, id) => sum + review[id],
    0,
  );
  return Math.round((total / V2_DIMENSION_IDS.length) * 100) / 100;
}

export function v2CasePasses(
  review: EvaluationJudgeV2Review,
  split: string,
): boolean {
  if (review.hardFailure) return false;
  if (split === "protected" && V2_DIMENSION_IDS.some((id) => review[id] === 0)) {
    return false;
  }
  return v2Mean(review) >= 3;
}

export function buildAnthropicJudgeRequest(
  record: EnhancementEvaluationRecord,
): Record<string, unknown> {
  const profile = getProviderEnhancementProfile(JUDGE_PROFILE_ID);
  const { taskPrompt, productAppendedGuardrails } = splitExecutionGuardrails(
    record.result.enhancedPrompt,
  );
  return {
    model: profile.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: JUDGE_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          caseId: record.caseId,
          split: record.split,
          category: record.category,
          requiredFacts: record.requiredFacts,
          prohibitedInventions: record.prohibitedInventions,
          roughThoughts: record.request.roughThoughts,
          suppliedContext: {
            project: record.request.project,
            allowedProjectFiles: record.request.allowedProjectFiles,
          },
          compiled: {
            enhancedPrompt: taskPrompt,
            productAppendedGuardrails,
          },
          coverage: factCoverage(record),
        }),
      },
    ],
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: EVALUATION_JUDGE_V2_SCHEMA,
      },
    },
  };
}

export async function judgeEvaluationRecordV2(
  record: EnhancementEvaluationRecord,
  options: EvaluationJudgeOptions,
): Promise<JudgedV2Record> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for v2 judging.");
  }
  const body = buildAnthropicJudgeRequest(record);
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
      body: JSON.stringify(body),
    },
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
    {
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Anthropic rejected v2 judging for ${record.caseId} (${response.status}).`,
    );
  }
  const parsed = parseAnthropicJudgeResponse(
    await response.json(),
    record.caseId,
  );
  return {
    caseId: record.caseId,
    generationIndex: record.generationIndex,
    review: clampV2Review(JSON.parse(parsed.outputText)),
    coverage: factCoverage(record),
    estimatedCostUsd: parsed.estimatedCostUsd,
  };
}

export function clampV2Review(value: unknown): EvaluationJudgeV2Review {
  if (!isObject(value)) {
    throw new Error("The v2 judge returned an invalid review object.");
  }
  const dimension = (key: V2DimensionId): number => {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`The v2 judge returned no ${key} score.`);
    }
    return Math.max(0, Math.min(4, Math.round(raw)));
  };
  const scores = Object.fromEntries(
    V2_DIMENSION_IDS.map((id) => [id, dimension(id)]),
  ) as Pick<EvaluationJudgeV2Review, V2DimensionId>;
  const citations = Array.isArray(value.citations)
    ? value.citations
        .filter(isObject)
        .map((item) => ({
          dimension: String(item.dimension) as V2DimensionId,
          source: String(item.source) as JudgeSpanCitation["source"],
          quote:
            typeof item.quote === "string" ? item.quote.slice(0, MAX_QUOTE) : "",
        }))
        .filter(
          (item) =>
            (V2_DIMENSION_IDS as readonly string[]).includes(item.dimension) &&
            ["roughThoughts", "enhancedPrompt", "suppliedContext"].includes(
              item.source,
            ) &&
            item.quote.trim().length > 0,
        )
    : [];
  return {
    ...scores,
    hardFailure: value.hardFailure === true,
    notes: typeof value.notes === "string" ? value.notes.slice(0, MAX_NOTES) : "",
    citations,
  };
}

function parseAnthropicJudgeResponse(
  value: unknown,
  caseId: string,
): { outputText: string; estimatedCostUsd: number } {
  if (!isObject(value)) {
    throw new Error(`Anthropic returned an invalid v2 judging response for ${caseId}.`);
  }
  if (value.type !== "message") {
    throw new Error(`Anthropic returned type ${String(value.type)} for ${caseId}.`);
  }
  if (value.stop_reason !== "end_turn") {
    throw new Error(
      `Anthropic returned ${String(value.stop_reason ?? "no completion reason")} for ${caseId}.`,
    );
  }
  if (!Array.isArray(value.content)) {
    throw new Error(`Anthropic returned no v2 judging content for ${caseId}.`);
  }
  const usage = isObject(value.usage) ? value.usage : {};
  const estimatedCostUsd =
    (numberOr(usage.input_tokens) * INPUT_COST_PER_MILLION_USD +
      numberOr(usage.output_tokens) * OUTPUT_COST_PER_MILLION_USD) /
    1_000_000;
  const outputText = value.content
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
    throw new Error(`Anthropic returned no structured v2 judgement for ${caseId}.`);
  }
  return { outputText, estimatedCostUsd };
}

function numberOr(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
