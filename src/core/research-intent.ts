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

export type FocusedResearchRoute = Extract<
  ResearchRoute,
  "web" | "exa" | "context7"
>;

/**
 * Per-run ceiling on planned queries for each route. Every query is one paid
 * provider request, so these bound the cost the review screen has to disclose.
 */
export const MAX_QUERIES_PER_ROUTE: Readonly<
  Record<FocusedResearchRoute, number>
> = { context7: 5, exa: 4, web: 2 };

export const MAX_PLANNED_QUERIES =
  MAX_QUERIES_PER_ROUTE.context7 +
  MAX_QUERIES_PER_ROUTE.exa +
  MAX_QUERIES_PER_ROUTE.web;

const MAX_AVAILABLE_LIBRARIES = 60;

export interface FocusedResearchRequest {
  roughThoughts: string;
  researchLevel: Exclude<EnhancementResearchLevel, "none">;
  routes: readonly FocusedResearchRoute[];
  technicalLibrary?: string;
  /** Real dependency names from the selected project, so the planner names libraries it can resolve. */
  availableLibraries?: readonly string[];
  currentDate?: string;
}

export interface FocusedResearchQuery {
  route: FocusedResearchRoute;
  purpose: string;
  query: string;
  /** Required for context7; the library the documentation query is about. */
  library?: string;
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
      maxItems: MAX_PLANNED_QUERIES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["route", "purpose", "query", "library"],
        properties: {
          route: { type: "string", enum: ["web", "exa", "context7"] },
          purpose: { type: "string", minLength: 1, maxLength: 240 },
          query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
          library: { type: ["string", "null"], maxLength: 200 },
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
      "Route context7 retrieves official API and library documentation. Set library to the exact package name and write query as a short documentation topic of at most 12 words, for example 'App Router streaming and Suspense boundaries'. Never copy the task description into a context7 query.",
      "Route web retrieves current official or primary facts that change over time.",
      "Route exa retrieves broad papers, case studies, community code examples, and comparisons.",
      `Return at most ${MAX_QUERIES_PER_ROUTE.context7} context7, ${MAX_QUERIES_PER_ROUTE.exa} exa, and ${MAX_QUERIES_PER_ROUTE.web} web queries.`,
      "Return at least one query for every allowed route and no query for any other route.",
      "Each query for the same route must investigate a different question. Do not restate one question in different words.",
      "Choose a library only from availableLibraries when that list is not empty.",
      "Set library for every context7 query and set library to null for every web and exa query.",
      "Write concise source-oriented queries, not conversational requests to build the final deliverable.",
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
  const intent = focusedResearchIntents(plan, route)[0];
  if (!intent) {
    throw new Error(`The focused research plan has no ${route} query.`);
  }
  return intent;
}

/**
 * Every planned query for one route. The planning charge covers the whole plan,
 * so it is attached to the first query of the plan overall — not the first of
 * each route, which double-counted it when two routes were planned together.
 */
export function focusedResearchIntents(
  plan: FocusedResearchPlan,
  route: FocusedResearchRoute,
): FocusedResearchIntent[] {
  const firstOverall = plan.queries[0];
  return plan.queries
    .filter((candidate) => candidate.route === route)
    .map((query) => ({
      ...query,
      objective: plan.objective,
      questions: [...plan.questions],
      planningCostUsd: query === firstOverall ? plan.usage.estimatedCostUsd : 0,
    }));
}

function validatedPlannerInput(request: FocusedResearchRequest): {
  roughThoughts: string;
  researchLevel: FocusedResearchRequest["researchLevel"];
  allowedRoutes: FocusedResearchRoute[];
  technicalLibrary: string | null;
  availableLibraries: string[];
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
    routes.some((route) => !(route in MAX_QUERIES_PER_ROUTE))
  ) {
    throw new Error(
      "Focused research requires a justified Context7, web, or Exa route.",
    );
  }
  return {
    roughThoughts,
    researchLevel: request.researchLevel,
    allowedRoutes: routes,
    technicalLibrary: technicalLibrary
      ? sanitizeResearchQuery(technicalLibrary, 200)
      : null,
    availableLibraries: [...new Set(request.availableLibraries ?? [])]
      .filter((name) => /^@?[a-z0-9._/-]{1,200}$/i.test(name))
      .slice(0, MAX_AVAILABLE_LIBRARIES),
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
    if (typeof route !== "string" || !(route in MAX_QUERIES_PER_ROUTE)) {
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
    if (route !== "context7") {
      return { route: route as FocusedResearchRoute, purpose, query };
    }
    // A Context7 request without a library cannot resolve, so reject the plan
    // instead of guessing a package name.
    const library = boundedText(candidate.library, "query library", 200);
    return { route: "context7" as const, purpose, query, library };
  });

  const counts = new Map<string, number>();
  for (const query of queries) {
    counts.set(query.route, (counts.get(query.route) ?? 0) + 1);
  }
  for (const [route, count] of counts) {
    if (!allowedRoutes.includes(route as FocusedResearchRoute)) {
      throw new Error(
        `The focused research plan returned a ${route} query that was not approved.`,
      );
    }
    const limit = MAX_QUERIES_PER_ROUTE[route as FocusedResearchRoute];
    if (count > limit) {
      throw new Error(
        `The focused research plan returned ${count} ${route} queries; the limit is ${limit}.`,
      );
    }
  }
  const missing = allowedRoutes.filter((route) => !counts.has(route));
  if (missing.length > 0) {
    throw new Error(
      `The focused research plan returned no query for: ${missing.join(", ")}.`,
    );
  }
  const seen = new Set<string>();
  for (const query of queries) {
    const key = `${query.route} ${query.library ?? ""} ${normalize(query.query)}`;
    if (seen.has(key)) {
      throw new Error(
        "The focused research plan repeated the same query twice. No search was started.",
      );
    }
    seen.add(key);
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
