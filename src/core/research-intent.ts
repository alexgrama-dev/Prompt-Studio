import type { EnhancementResearchLevel } from "./enhancement.ts";
import {
  sanitizeResearchQuery,
  type ResearchRoute,
} from "./research-router.ts";
import { containsLikelySecret } from "./secrets.ts";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const FOCUSED_RESEARCH_MODEL = "gpt-5.6-terra";
const MAX_TASK_LENGTH = 2_000;
const MAX_QUERY_LENGTH = 500;
const MAX_OUTPUT_TOKENS = 800;
const MAX_INPUT_TOKENS = 4_000;
const REQUEST_TIMEOUT_MS = 60_000;
const INPUT_COST_PER_MILLION_USD = 2.5;
const OUTPUT_COST_PER_MILLION_USD = 15;

export type FocusedResearchRoute = Extract<ResearchRoute, "web" | "exa">;

export interface FocusedResearchRequest {
  roughThoughts: string;
  researchLevel: Exclude<EnhancementResearchLevel, "none">;
  routes: readonly FocusedResearchRoute[];
  technicalLibrary?: string;
  currentDate?: string;
}

export interface FocusedResearchQuery {
  route: FocusedResearchRoute;
  purpose: string;
  query: string;
}

export interface FocusedResearchPlan {
  objective: string;
  questions: string[];
  queries: FocusedResearchQuery[];
  responseId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    estimatedCostUsd: number;
  };
}

export interface FocusedResearchIntent extends FocusedResearchQuery {
  objective: string;
  questions: string[];
  planningCostUsd: number;
}

export interface FocusedResearchOptions {
  apiKey: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  endpoint?: string;
  retryLimit?: number;
  timeoutMs?: number;
}

interface OpenAIUsage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  output_tokens_details?: {
    reasoning_tokens?: unknown;
  };
}

export const FOCUSED_RESEARCH_PRIVACY_DISCLOSURE =
  "Before any web or Exa search, Prompt Studio sends a privacy-filtered version of the rough task to OpenAI without project files. GPT-5.6 Terra turns it into focused research questions and provider queries. The resulting query is shown for review before it is sent to a search service. The planning request uses store:false; normal OpenAI API abuse-monitoring retention may still apply unless the API project has separately approved controls.";

export const FOCUSED_RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objective", "questions", "queries"],
  properties: {
    objective: { type: "string", minLength: 1, maxLength: 300 },
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 1, maxLength: 300 },
    },
    queries: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["route", "purpose", "query"],
        properties: {
          route: { type: "string", enum: ["web", "exa"] },
          purpose: { type: "string", minLength: 1, maxLength: 240 },
          query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
        },
      },
    },
  },
} as const;

export function maximumFocusedResearchCostUsd(): number {
  const estimate =
    (MAX_INPUT_TOKENS * INPUT_COST_PER_MILLION_USD +
      MAX_OUTPUT_TOKENS * OUTPUT_COST_PER_MILLION_USD) /
    1_000_000;
  return Math.ceil(estimate * 100) / 100;
}

export function buildOpenAIFocusedResearchRequest(
  request: FocusedResearchRequest,
): Record<string, unknown> {
  const safeInput = validatedPlannerInput(request);
  return {
    model: FOCUSED_RESEARCH_MODEL,
    reasoning: { effort: "low" },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "prompt_studio_research_intent",
        strict: true,
        schema: FOCUSED_RESEARCH_SCHEMA,
      },
    },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false,
    service_tier: "default",
    safety_identifier: "prompt-studio-local-user",
    instructions: [
      "You plan evidence gathering; you do not rewrite or execute the user's task.",
      "Extract only the external facts that must be researched before the task can be completed accurately.",
      "Remove implementation instructions, desired visual impact, deliverable wording, local details, and motivational language from search queries.",
      "Preserve named technologies, versions, dates, comparison criteria, and the kind of evidence needed.",
      "Use web for current official or primary facts. Use Exa only for broad papers, case studies, code examples, or comparisons.",
      "Write concise source-oriented queries, not conversational requests to build the final deliverable.",
      "Return exactly one query for each allowed route and no query for any other route.",
    ].join(" "),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(safeInput) }],
      },
    ],
  };
}

export async function planFocusedResearch(
  request: FocusedResearchRequest,
  options: FocusedResearchOptions,
): Promise<FocusedResearchPlan> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error(
      "Add an OpenAI API key before creating a focused research plan.",
    );
  }
  const body = buildOpenAIFocusedResearchRequest(request);
  const response = await requestWithRetry(
    options.endpoint ?? OPENAI_RESPONSES_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    options,
  );
  if (!response.ok) {
    throw new Error(
      `OpenAI rejected the research-planning request (${response.status}). No search was started.`,
    );
  }
  const parsed = parseOpenAIResponse(await response.json());
  const safeTask = validatedPlannerInput(request).roughThoughts;
  const plan = validateFocusedResearchPlan(
    JSON.parse(parsed.outputText) as unknown,
    request.routes,
    safeTask,
  );
  const inputTokens = nonNegativeInteger(parsed.usage.input_tokens);
  const outputTokens = nonNegativeInteger(parsed.usage.output_tokens);
  const reasoningTokens = nonNegativeInteger(
    parsed.usage.output_tokens_details?.reasoning_tokens,
  );
  return {
    ...plan,
    responseId: parsed.responseId,
    usage: {
      inputTokens,
      outputTokens,
      reasoningTokens,
      estimatedCostUsd:
        (inputTokens * INPUT_COST_PER_MILLION_USD +
          outputTokens * OUTPUT_COST_PER_MILLION_USD) /
        1_000_000,
    },
  };
}

export function focusedResearchIntent(
  plan: FocusedResearchPlan,
  route: FocusedResearchRoute,
): FocusedResearchIntent {
  const query = plan.queries.find((candidate) => candidate.route === route);
  if (!query) {
    throw new Error(`The focused research plan has no ${route} query.`);
  }
  return {
    ...query,
    objective: plan.objective,
    questions: [...plan.questions],
    planningCostUsd: plan.usage.estimatedCostUsd,
  };
}

function validatedPlannerInput(request: FocusedResearchRequest): {
  roughThoughts: string;
  researchLevel: FocusedResearchRequest["researchLevel"];
  allowedRoutes: FocusedResearchRoute[];
  technicalLibrary: string | null;
  currentDate: string;
} {
  const technicalLibrary = request.technicalLibrary?.trim() ?? "";
  if (containsLikelySecret(`${request.roughThoughts}\n${technicalLibrary}`)) {
    throw new Error(
      "The research-planning request appears to contain a secret. Replace it with a placeholder first.",
    );
  }
  const roughThoughts = sanitizeResearchQuery(
    request.roughThoughts,
    MAX_TASK_LENGTH,
  );
  if (!roughThoughts) {
    throw new Error(
      "Nothing safe remained after privacy-filtering the research task.",
    );
  }
  const routes = [...new Set(request.routes)];
  if (
    routes.length === 0 ||
    routes.length > 2 ||
    routes.some((route) => route !== "web" && route !== "exa")
  ) {
    throw new Error("Focused research requires a justified web or Exa route.");
  }
  return {
    roughThoughts,
    researchLevel: request.researchLevel,
    allowedRoutes: routes,
    technicalLibrary: technicalLibrary
      ? sanitizeResearchQuery(technicalLibrary, 200)
      : null,
    currentDate:
      request.currentDate ??
      new Date().toISOString().slice(0, "YYYY-MM-DD".length),
  };
}

function validateFocusedResearchPlan(
  value: unknown,
  allowedRoutes: readonly FocusedResearchRoute[],
  safeTask: string,
): Pick<FocusedResearchPlan, "objective" | "questions" | "queries"> {
  if (!isObject(value)) {
    throw new Error("OpenAI returned an invalid focused research plan.");
  }
  const objective = boundedText(value.objective, "research objective", 300);
  if (!Array.isArray(value.questions)) {
    throw new Error("The focused research plan has no research questions.");
  }
  const questions = value.questions
    .map((question) => boundedText(question, "research question", 300))
    .filter((question, index, all) => all.indexOf(question) === index);
  if (questions.length < 1 || questions.length > 5) {
    throw new Error(
      "The focused research plan must contain one to five distinct questions.",
    );
  }
  if (!Array.isArray(value.queries)) {
    throw new Error("The focused research plan has no provider queries.");
  }
  const queries: FocusedResearchQuery[] = value.queries.map((candidate) => {
    if (!isObject(candidate)) {
      throw new Error("OpenAI returned an invalid provider query.");
    }
    const route = candidate.route;
    if (route !== "web" && route !== "exa") {
      throw new Error("OpenAI returned an unsupported research route.");
    }
    const purpose = boundedText(candidate.purpose, "query purpose", 240);
    const query = sanitizeResearchQuery(
      boundedText(candidate.query, "provider query", MAX_QUERY_LENGTH),
      MAX_QUERY_LENGTH,
    );
    if (!query || containsLikelySecret(query)) {
      throw new Error("OpenAI returned an unsafe provider query.");
    }
    if (
      normalize(query) === normalize(safeTask) &&
      safeTask.split(/\s+/).length >= 12
    ) {
      throw new Error(
        "OpenAI repeated the rough task instead of producing a focused search query. No search was started.",
      );
    }
    return { route: route as FocusedResearchRoute, purpose, query };
  });
  const returnedRoutes = queries.map((query) => query.route);
  if (
    queries.length !== allowedRoutes.length ||
    new Set(returnedRoutes).size !== returnedRoutes.length ||
    allowedRoutes.some((route) => !returnedRoutes.includes(route))
  ) {
    throw new Error(
      "The focused research plan did not return exactly the approved research routes.",
    );
  }
  return { objective, questions, queries };
}

async function requestWithRetry(
  endpoint: string,
  init: RequestInit,
  options: FocusedResearchOptions,
): Promise<Response> {
  const fetcher = options.fetcher ?? fetch;
  const retryLimit = Math.max(0, Math.min(options.retryLimit ?? 2, 3));
  const timeoutMs = Math.max(
    1,
    Math.min(options.timeoutMs ?? REQUEST_TIMEOUT_MS, 120_000),
  );
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    if (options.signal?.aborted) throw cancelled();
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetcher(endpoint, {
        ...init,
        signal: controller.signal,
      });
      if (
        ![408, 429, 500, 502, 503, 504].includes(response.status) ||
        attempt === retryLimit
      ) {
        return response;
      }
      await response.body?.cancel();
    } catch (error) {
      if (options.signal?.aborted) throw cancelled();
      if (timedOut) {
        throw new Error("Research planning timed out. No search was started.");
      }
      if (attempt === retryLimit) throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  throw new Error("Research planning failed after retrying.");
}

function parseOpenAIResponse(value: unknown): {
  responseId: string;
  outputText: string;
  usage: OpenAIUsage;
} {
  if (!isObject(value)) {
    throw new Error("OpenAI returned an invalid research-planning response.");
  }
  const responseId =
    typeof value.id === "string" && value.id ? value.id : "<unavailable>";
  if (value.status !== "completed") {
    throw new Error(
      `OpenAI returned ${String(value.status ?? "an incomplete status")} for research planning. No search was started.`,
    );
  }
  if (!Array.isArray(value.output)) {
    throw new Error("OpenAI returned no focused research plan.");
  }
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
          `OpenAI declined research planning: ${content.refusal.slice(0, 300)}`,
        );
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return {
          responseId,
          outputText: content.text,
          usage: isObject(value.usage) ? (value.usage as OpenAIUsage) : {},
        };
      }
    }
  }
  throw new Error("OpenAI returned no structured research plan.");
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") {
    throw new Error(`The focused ${label} is invalid.`);
  }
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || containsLikelySecret(text)) {
    throw new Error(`The focused ${label} is empty, too long, or unsafe.`);
  }
  return text;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cancelled(): Error {
  return new Error("Research planning cancelled. No search was started.");
}
