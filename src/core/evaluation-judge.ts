import {
  HUMAN_REVIEW_SCORE_MAXIMUMS,
  type EnhancementEvaluationDocument,
  type EnhancementEvaluationRecord,
  type EnhancementHumanReviewInput,
} from "./evaluation.ts";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const JUDGE_MODEL = "gpt-5.6-terra";
const MAX_OUTPUT_TOKENS = 900;
const MAX_INPUT_TOKENS = 12_000;
const REQUEST_TIMEOUT_MS = 120_000;
const INPUT_COST_PER_MILLION_USD = 2.5;
const OUTPUT_COST_PER_MILLION_USD = 15;
const MAX_NOTES = 500;

export interface EvaluationJudgeOptions {
  apiKey: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}

export interface JudgedRecord {
  caseId: string;
  review: EnhancementHumanReviewInput;
  coverage: FactCoverage;
  estimatedCostUsd: number;
}

export interface FactCoverage {
  requiredFacts: number;
  prohibitedInventions: number;
}

export const EVALUATION_JUDGE_PRIVACY_DISCLOSURE =
  "Judging sends each evaluation case and its compiled result to OpenAI for scoring. The judge never sees which provider or model produced the result. Requests use store:false; normal OpenAI API abuse-monitoring retention may still apply unless the API project has separately approved controls.";

export const EVALUATION_JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "fidelity",
    "completeness",
    "unsupportedFacts",
    "actionability",
    "validation",
    "authorization",
    "appropriateLength",
    "hardFailure",
    "notes",
  ],
  properties: {
    fidelity: { type: "integer" },
    completeness: { type: "integer" },
    unsupportedFacts: { type: "integer" },
    actionability: { type: "integer" },
    validation: { type: "integer" },
    authorization: { type: "integer" },
    appropriateLength: { type: "integer" },
    hardFailure: { type: "boolean" },
    notes: { type: "string" },
  },
} as const;

const JUDGE_INSTRUCTIONS = [
  "You score one compiled prompt against the rough task it came from. You do not rewrite it.",
  "You are blind to which provider or model produced the result. Judge only the material shown.",
  `Award points out of these maximums: fidelity ${HUMAN_REVIEW_SCORE_MAXIMUMS.fidelity} (every explicit user requirement, prohibition, and threshold survives at full strength), completeness ${HUMAN_REVIEW_SCORE_MAXIMUMS.completeness} (the required facts are all present), unsupportedFacts ${HUMAN_REVIEW_SCORE_MAXIMUMS.unsupportedFacts} (nothing invented; award full marks only when no prohibited invention appears), actionability ${HUMAN_REVIEW_SCORE_MAXIMUMS.actionability} (an agent could act without guessing), validation ${HUMAN_REVIEW_SCORE_MAXIMUMS.validation} (the prompt defines how the result would be proven), authorization ${HUMAN_REVIEW_SCORE_MAXIMUMS.authorization} (boundaries for destructive, external, costly, or scope-expanding actions), appropriateLength ${HUMAN_REVIEW_SCORE_MAXIMUMS.appropriateLength} (no padding, no missing substance).`,
  "Set hardFailure to true only for a disqualifying defect: a dropped or softened prohibition, an invented fact from the prohibited list, a changed target, or authorization to act beyond what the task allows.",
  "Score strictly. A prompt that is merely acceptable is not full marks. Deduct for each specific defect you can name.",
  "notes must state the concrete defects you deducted for, or be empty when there are none. Do not restate the prompt.",
].join(" ");

export function maximumJudgeCostUsd(caseCount: number): number {
  const perCase =
    (MAX_INPUT_TOKENS * INPUT_COST_PER_MILLION_USD +
      MAX_OUTPUT_TOKENS * OUTPUT_COST_PER_MILLION_USD) /
    1_000_000;
  return Math.ceil(perCase * Math.max(0, caseCount) * 100) / 100;
}

/**
 * Deterministic coverage of the case's own checklist. This is a supporting
 * signal shown to the judge, not the score: keyword presence cannot tell whether
 * a requirement survived at full strength, which is what fidelity measures.
 */
export function factCoverage(
  record: EnhancementEvaluationRecord,
): FactCoverage {
  const haystack = normalize(
    [
      record.result.enhancedPrompt,
      record.result.summary,
      ...record.result.assumptions,
      ...record.result.validationSteps,
    ].join(" "),
  );
  return {
    requiredFacts: record.requiredFacts.filter((fact) =>
      significantWords(fact).every((word) => haystack.includes(word)),
    ).length,
    prohibitedInventions: record.prohibitedInventions.filter((invention) =>
      significantWords(invention).every((word) => haystack.includes(word)),
    ).length,
  };
}

const MAX_FIELD_CHARS = 8_000;
const MAX_LIST_ITEMS = 20;

export function buildJudgeRequest(
  record: EnhancementEvaluationRecord,
): Record<string, unknown> {
  const coverage = factCoverage(record);
  // Bound the request so the cost estimate matches what is actually sent.
  const cap = (value: string) => value.slice(0, MAX_FIELD_CHARS);
  const capList = (values: readonly string[]) =>
    values.slice(0, MAX_LIST_ITEMS).map((item) => item.slice(0, 500));
  return {
    model: JUDGE_MODEL,
    reasoning: { effort: "medium" },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "prompt_studio_evaluation_review",
        strict: true,
        schema: EVALUATION_JUDGE_SCHEMA,
      },
    },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false,
    service_tier: "default",
    safety_identifier: "prompt-studio-local-user",
    instructions: JUDGE_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(
              {
                category: record.category,
                selectedTarget: record.request.target,
                roughThoughts: cap(record.request.roughThoughts),
                requiredFacts: capList(record.requiredFacts),
                prohibitedInventions: capList(record.prohibitedInventions),
                deterministicCoverage: {
                  requiredFactsMatchedByKeyword: coverage.requiredFacts,
                  requiredFactsTotal: record.requiredFacts.length,
                  prohibitedInventionsMatchedByKeyword:
                    coverage.prohibitedInventions,
                },
                compiled: {
                  title: record.result.title,
                  summary: cap(record.result.summary),
                  target: record.result.target,
                  enhancedPrompt: cap(record.result.enhancedPrompt),
                  assumptions: capList(record.result.assumptions),
                  missingInformation: capList(record.result.missingInformation),
                  validationSteps: capList(record.result.validationSteps),
                },
              },
              null,
              2,
            ),
          },
        ],
      },
    ],
  };
}

export async function judgeEvaluationRecord(
  record: EnhancementEvaluationRecord,
  options: EvaluationJudgeOptions,
): Promise<JudgedRecord> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Add an OpenAI API key before judging an evaluation run.");
  }
  // A caller that already cancelled must not cause a request at all.
  if (options.signal?.aborted) {
    throw new Error("Judging was cancelled before any request was made.");
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Math.min(options.timeoutMs ?? REQUEST_TIMEOUT_MS, 240_000)),
  );
  try {
    const response = await (options.fetcher ?? fetch)(
      options.endpoint ?? OPENAI_RESPONSES_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildJudgeRequest(record)),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        `OpenAI rejected the judging request for ${record.caseId} (${response.status}). No score was recorded.`,
      );
    }
    const parsed = parseJudgeResponse(await response.json(), record.caseId);
    return {
      caseId: record.caseId,
      review: clampReview(JSON.parse(parsed.outputText) as unknown),
      coverage: factCoverage(record),
      estimatedCostUsd: parsed.estimatedCostUsd,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export function pendingJudgeRecords(
  document: EnhancementEvaluationDocument,
): EnhancementEvaluationRecord[] {
  return document.records.filter(
    (record) => record.humanReview.status !== "reviewed",
  );
}

function parseJudgeResponse(
  value: unknown,
  caseId: string,
): { outputText: string; estimatedCostUsd: number } {
  if (!isObject(value)) {
    throw new Error(
      `OpenAI returned an invalid judging response for ${caseId}.`,
    );
  }
  if (value.status !== "completed") {
    throw new Error(
      `OpenAI returned ${String(value.status ?? "an incomplete status")} while judging ${caseId}.`,
    );
  }
  if (!Array.isArray(value.output)) {
    throw new Error(`OpenAI returned no judging output for ${caseId}.`);
  }
  const usage = isObject(value.usage) ? value.usage : {};
  const estimatedCostUsd =
    (numberOr(usage.input_tokens) * INPUT_COST_PER_MILLION_USD +
      numberOr(usage.output_tokens) * OUTPUT_COST_PER_MILLION_USD) /
    1_000_000;
  for (const item of value.output) {
    if (
      !isObject(item) ||
      item.type !== "message" ||
      !Array.isArray(item.content)
    ) {
      continue;
    }
    for (const content of item.content) {
      if (!isObject(content)) continue;
      if (content.type === "refusal" && typeof content.refusal === "string") {
        throw new Error(
          `OpenAI declined to judge ${caseId}: ${content.refusal.slice(0, 200)}`,
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return { outputText: content.text, estimatedCostUsd };
      }
    }
  }
  throw new Error(`OpenAI returned no structured judgement for ${caseId}.`);
}

/**
 * A judge that returns an out-of-range score must not silently inflate a run.
 * Clamping to the published maximums keeps the existing gate meaningful.
 */
function clampReview(value: unknown): EnhancementHumanReviewInput {
  if (!isObject(value)) {
    throw new Error("The judge returned an invalid review object.");
  }
  const dimension = (key: keyof typeof HUMAN_REVIEW_SCORE_MAXIMUMS): number => {
    const raw = value[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`The judge returned no ${key} score.`);
    }
    return Math.max(
      0,
      Math.min(Math.round(raw), HUMAN_REVIEW_SCORE_MAXIMUMS[key]),
    );
  };
  return {
    fidelity: dimension("fidelity"),
    completeness: dimension("completeness"),
    unsupportedFacts: dimension("unsupportedFacts"),
    actionability: dimension("actionability"),
    validation: dimension("validation"),
    authorization: dimension("authorization"),
    appropriateLength: dimension("appropriateLength"),
    hardFailure: value.hardFailure === true,
    notes:
      typeof value.notes === "string" ? value.notes.slice(0, MAX_NOTES) : "",
  };
}

function significantWords(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((word) => word.length >= 5)
    .slice(0, 4);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOr(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
