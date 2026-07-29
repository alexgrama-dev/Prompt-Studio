import type { EnhancementInputSource } from "./enhancement.ts";
import type { FeatureState } from "./features.ts";
import type { ProjectContextBundle } from "./project-context.ts";
import { sanitizeResearchQuery } from "./research-router.ts";
import { containsLikelySecret } from "./secrets.ts";

const CONTEXT7_ORIGIN = "https://context7.com";
const MAX_QUERY_LENGTH = 500;
const MAX_SOURCE_BYTES = 12_000;
const MAX_TOTAL_BYTES = 30_000;

export const CONTEXT7_PRIVACY_DISCLOSURE =
  "Context7 receives only the displayed documentation query, library name or ID, an API key in the Authorization header, and connection metadata. Context7 says it stores formulated queries for retrieval benchmarking and may pass them to OpenAI, Google Gemini, or Anthropic for reranking. Prompt Studio removes fenced code, obvious local paths, URLs, email addresses, and detected secrets; review the exact displayed query. It does not send the project bundle or conversation, and it never places the key in returned sources.";

export function context7ApiKeyForApprovedRequest(
  state: FeatureState,
  readEnvironment = () => process.env.CONTEXT7_API_KEY,
): string {
  if (state === "disabled") {
    throw new Error("Context7 Research is Disabled.");
  }
  const apiKey = readEnvironment()?.trim();
  if (!apiKey) {
    throw new Error(
      "CONTEXT7_API_KEY is missing. No Context7 request was made.",
    );
  }
  return apiKey;
}

export interface Context7Plan {
  route: "none" | "context7";
  reason: string;
  libraryInput?: string;
  libraryId?: string;
  version?: string;
  query?: string;
}

export interface Context7Options {
  apiKey?: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  origin?: string;
  retryLimit?: number;
  timeoutMs?: number;
}

export interface Context7ResearchResult {
  plan: Context7Plan & { route: "context7"; libraryId: string; query: string };
  sources: EnhancementInputSource[];
  retrievedAt: string;
}

export interface Context7ProjectVersion {
  version: string;
  sourcePath: string;
}

export interface DetectedTechnicalLibrary {
  libraryInput: string;
  version?: string;
  sourcePath?: string;
}

interface LibraryResult {
  id: string;
  title: string;
  description: string;
  trustScore: number;
  benchmarkScore: number;
  totalSnippets: number;
  versions: string[];
}

export function planContext7Research(
  roughThoughts: string,
  researchLevel: "none" | "auto" | "deep",
  libraryInput?: string,
  version?: string,
): Context7Plan {
  if (researchLevel === "none") {
    return { route: "none", reason: "External research is disabled." };
  }
  const library = libraryInput?.trim();
  if (!library) {
    return {
      route: "none",
      reason:
        "No technical library was named. Context7 will not guess and send an unrelated query.",
    };
  }
  if (containsLikelySecret(`${roughThoughts}\n${library}\n${version ?? ""}`)) {
    throw new Error(
      "The Context7 request appears to contain a secret. Replace it with a placeholder before research.",
    );
  }
  const query = formulateDocumentationQuery(roughThoughts, library, version);
  if (library.startsWith("/")) {
    const libraryId = validateLibraryId(
      version ? `${library.replace(/\/$/, "")}/${version}` : library,
    );
    return {
      route: "context7",
      reason: "An explicit Context7 library ID was supplied.",
      libraryInput: library,
      libraryId,
      ...(version ? { version } : {}),
      query,
    };
  }
  return {
    route: "context7",
    reason: "A named technical library requires current documentation.",
    libraryInput: bounded(library, "libraryInput", 1, 200),
    ...(version ? { version: bounded(version, "version", 1, 80) } : {}),
    query,
  };
}

export async function researchWithContext7(
  unvalidatedPlan: Context7Plan,
  options: Context7Options = {},
): Promise<Context7ResearchResult> {
  if (unvalidatedPlan.route !== "context7" || !unvalidatedPlan.query) {
    throw new Error("A reviewed Context7 research plan is required.");
  }
  const query = bounded(unvalidatedPlan.query, "query", 1, MAX_QUERY_LENGTH);
  const libraryId = unvalidatedPlan.libraryId
    ? validateLibraryId(unvalidatedPlan.libraryId)
    : await resolveLibrary(
        bounded(unvalidatedPlan.libraryInput, "libraryInput", 1, 200),
        query,
        unvalidatedPlan.version,
        options,
      );
  const url = new URL("/api/v2/context", options.origin ?? CONTEXT7_ORIGIN);
  url.searchParams.set("libraryId", libraryId);
  url.searchParams.set("query", query);
  url.searchParams.set("type", "json");
  url.searchParams.set("fast", "false");
  const raw = await requestJson(url, options);
  const retrievedAt = new Date().toISOString();
  const sources = parseContext(raw, retrievedAt, query);
  return {
    plan: {
      ...unvalidatedPlan,
      route: "context7",
      libraryId,
      query,
    },
    sources,
    retrievedAt,
  };
}

export function formulateDocumentationQuery(
  roughThoughts: string,
  library: string,
  version?: string,
): string {
  const prefix = `For ${library}${version ? ` ${version}` : ""}: `;
  const available = MAX_QUERY_LENGTH - prefix.length;
  const concise = sanitizeResearchQuery(roughThoughts, Math.max(1, available));
  return bounded(
    `${prefix}${concise || "retrieve the relevant current API documentation"}`,
    "query",
    1,
    MAX_QUERY_LENGTH,
  );
}

export function detectTechnicalLibrary(
  roughThoughts: string,
  bundle?: ProjectContextBundle,
): DetectedTechnicalLibrary | undefined {
  const text = roughThoughts.toLowerCase();
  const dependencies = projectDependencies(bundle);
  const namedDependency = dependencies
    .sort((left, right) => right.libraryInput.length - left.libraryInput.length)
    .find(({ libraryInput }) => mentionsLibrary(text, libraryInput));
  if (namedDependency) {
    const requestedVersion = versionNextTo(
      text,
      namedDependency.libraryInput.split("/").at(-1) ??
        namedDependency.libraryInput,
    );
    return requestedVersion
      ? {
          libraryInput: namedDependency.libraryInput,
          version: requestedVersion,
        }
      : namedDependency;
  }

  const knownAliases: Array<[string, string]> = [
    ["tanstack query", "@tanstack/react-query"],
    ["testing library", "@testing-library/react"],
    ["react query", "@tanstack/react-query"],
    ["react router", "react-router"],
    ["claude code", "@anthropic-ai/claude-code"],
    ["next.js", "next"],
    ["sveltekit", "@sveltejs/kit"],
    ["typescript", "typescript"],
    ["playwright", "playwright"],
    ["tailwind", "tailwindcss"],
    ["raycast", "@raycast/api"],
    ["fastify", "fastify"],
    ["express", "express"],
    ["nestjs", "@nestjs/core"],
    ["angular", "@angular/core"],
    ["prisma", "prisma"],
    ["drizzle", "drizzle-orm"],
    ["vitest", "vitest"],
    ["react", "react"],
    ["vue", "vue"],
    ["nuxt", "nuxt"],
    ["svelte", "svelte"],
    ["astro", "astro"],
    ["remix", "@remix-run/react"],
    ["vite", "vite"],
    ["zod", "zod"],
  ];
  const known = knownAliases.find(([alias]) => mentionsLibrary(text, alias));
  if (known) {
    const projectMatch = dependencies.find(
      ({ libraryInput }) =>
        libraryInput === known[1] ||
        libraryInput.split("/").at(-1) === known[1].split("/").at(-1),
    );
    const requestedVersion = versionNextTo(text, known[0]);
    return (
      projectMatch ?? {
        libraryInput: known[1],
        ...(requestedVersion ? { version: requestedVersion } : {}),
      }
    );
  }

  const scopedPackage = roughThoughts.match(
    /(?:^|[\s"'`(])(@[a-z0-9._-]+\/[a-z0-9._-]+)(?=$|[\s"'`),.:;])/i,
  )?.[1];
  if (scopedPackage) {
    const requestedVersion = versionNextTo(text, scopedPackage);
    return {
      libraryInput: scopedPackage,
      ...(requestedVersion ? { version: requestedVersion } : {}),
    };
  }

  if (
    /\b(?:api|docs?|documentation|library|framework|sdk|version|upgrade|migrat\w*)\b/i.test(
      roughThoughts,
    )
  ) {
    const primary = [
      "next",
      "nuxt",
      "@angular/core",
      "@sveltejs/kit",
      "astro",
      "@remix-run/react",
      "react",
      "vue",
      "svelte",
      "express",
      "fastify",
    ]
      .map((name) =>
        dependencies.find(({ libraryInput }) => libraryInput === name),
      )
      .find(
        (dependency): dependency is DetectedTechnicalLibrary =>
          dependency !== undefined,
      );
    if (primary) return primary;
  }
  return undefined;
}

export function findContext7ProjectVersion(
  bundle: ProjectContextBundle,
  libraryInput: string,
): Context7ProjectVersion | undefined {
  const wanted = libraryInput.trim().toLowerCase().replace(/^@/, "");
  if (!wanted || libraryInput.startsWith("/")) return undefined;
  for (const record of bundle.records) {
    if (record.path.split("/").at(-1)?.toLowerCase() !== "package.json") {
      continue;
    }
    try {
      const manifest = JSON.parse(record.content) as Record<string, unknown>;
      for (const field of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        const dependencies = manifest[field];
        if (!isObject(dependencies)) continue;
        const match = Object.entries(dependencies).find(([name]) => {
          const normalized = name.toLowerCase().replace(/^@/, "");
          return (
            normalized === wanted ||
            normalized.split("/").at(-1) === wanted ||
            wanted.split("/").at(-1) === normalized.split("/").at(-1)
          );
        });
        if (typeof match?.[1] !== "string") continue;
        const exact = match[1]
          .trim()
          .match(/^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
        if (exact?.[1]) {
          return { version: exact[1], sourcePath: record.path };
        }
      }
    } catch {
      // Invalid manifests remain visible in project context and are not guessed.
    }
  }
  return undefined;
}

function projectDependencies(
  bundle?: ProjectContextBundle,
): DetectedTechnicalLibrary[] {
  if (!bundle) return [];
  const dependencies = new Map<string, DetectedTechnicalLibrary>();
  for (const record of bundle.records) {
    if (record.path.split("/").at(-1)?.toLowerCase() !== "package.json") {
      continue;
    }
    try {
      const manifest = JSON.parse(record.content) as Record<string, unknown>;
      for (const field of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        const values = manifest[field];
        if (!isObject(values)) continue;
        for (const [name, value] of Object.entries(values)) {
          if (typeof value !== "string" || dependencies.has(name)) continue;
          const exact = value
            .trim()
            .match(/^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/)?.[1];
          dependencies.set(name, {
            libraryInput: name,
            ...(exact ? { version: exact } : {}),
            sourcePath: record.path,
          });
        }
      }
    } catch {
      // Invalid manifests stay visible in project review and are not guessed.
    }
  }
  return [...dependencies.values()];
}

function mentionsLibrary(text: string, library: string): boolean {
  const escaped = library
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = escaped.split("/").at(-1) ?? escaped;
  return new RegExp(`(^|[^a-z0-9])(?:${escaped}|${tail})(?=$|[^a-z0-9])`).test(
    text,
  );
}

function versionNextTo(text: string, library: string): string | undefined {
  const escaped = library.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(
    new RegExp(
      `(?:${escaped})\\s+(?:version\\s+|v)?(\\d+(?:\\.\\d+){0,2}(?:-[0-9a-z.-]+)?)\\b`,
      "i",
    ),
  )?.[1];
}

async function resolveLibrary(
  libraryName: string,
  query: string,
  version: string | undefined,
  options: Context7Options,
): Promise<string> {
  const url = new URL("/api/v2/libs/search", options.origin ?? CONTEXT7_ORIGIN);
  url.searchParams.set("libraryName", libraryName);
  url.searchParams.set("query", query);
  url.searchParams.set("fast", "false");
  const raw = await requestJson(url, options);
  if (!isObject(raw) || !Array.isArray(raw.results)) {
    throw new Error("Context7 returned an invalid library-search response.");
  }
  const results = raw.results
    .map(parseLibrary)
    .filter((result): result is LibraryResult => result !== undefined)
    .sort(
      (left, right) =>
        versionMatchScore(right, version) - versionMatchScore(left, version) ||
        libraryMatchScore(right, libraryName) -
          libraryMatchScore(left, libraryName) ||
        right.trustScore - left.trustScore ||
        right.benchmarkScore - left.benchmarkScore ||
        right.totalSnippets - left.totalSnippets,
    );
  const selected = results[0];
  if (!selected) {
    throw new Error(`Context7 found no library matching “${libraryName}”.`);
  }
  if (!version) return validateLibraryId(selected.id);
  const selectedVersion = selected.versions.find(
    (candidate) => normalizeVersion(candidate) === normalizeVersion(version),
  );
  if (!selectedVersion) {
    throw new Error(
      `Context7 does not list ${version} for ${selected.title}. Choose one of: ${selected.versions.join(", ") || "no versioned indexes available"}.`,
    );
  }
  return validateLibraryId(
    `${selected.id.replace(/\/$/, "")}/${selectedVersion}`,
  );
}

async function requestJson(
  url: URL,
  options: Context7Options,
): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const retryLimit = Math.max(0, Math.min(options.retryLimit ?? 2, 3));
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 30_000, 60_000));
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
      const response = await fetcher(url, {
        headers: {
          Accept: "application/json",
          ...(options.apiKey?.trim()
            ? { Authorization: `Bearer ${options.apiKey.trim()}` }
            : {}),
        },
        signal: controller.signal,
      });
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < retryLimit
      ) {
        await response.body?.cancel();
        await delay(retryDelay(response, attempt), options.signal);
        continue;
      }
      if (!response.ok) throw await context7Error(response);
      return (await response.json()) as unknown;
    } catch (error) {
      if (options.signal?.aborted) throw cancelled();
      if (timedOut) {
        if (attempt >= retryLimit) {
          throw new Error(
            "Context7 request timed out. No model request was made.",
          );
        }
        await delay(500 * 2 ** attempt, options.signal);
        continue;
      }
      if (
        attempt >= retryLimit ||
        (!(error instanceof TypeError) && !isRetryableContext7Error(error))
      ) {
        if (error instanceof TypeError) {
          throw new Error(
            "Context7 is offline or unreachable. No model request was made.",
          );
        }
        throw error;
      }
      await delay(500 * 2 ** attempt, options.signal);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  throw new Error("Context7 failed after bounded retries.");
}

function parseContext(
  value: unknown,
  retrievedAt: string,
  query: string,
): EnhancementInputSource[] {
  if (
    !isObject(value) ||
    !Array.isArray(value.codeSnippets) ||
    !Array.isArray(value.infoSnippets)
  ) {
    throw new Error("Context7 returned an invalid documentation response.");
  }
  const candidates: EnhancementInputSource[] = [];
  for (const item of value.infoSnippets) {
    if (!isObject(item)) continue;
    const url = validUrl(item.pageId);
    const content = optionalText(item.content);
    if (!url || !content) continue;
    candidates.push({
      title: shortText(item.breadcrumb, 300) ?? "Context7 documentation",
      url,
      retrievedAt,
      supports: shortText(`Documentation relevant to: ${query}`, 500)!,
      content,
    });
  }
  for (const item of value.codeSnippets) {
    if (!isObject(item) || !Array.isArray(item.codeList)) continue;
    const url = validUrl(item.codeId);
    const code = item.codeList
      .flatMap((entry) =>
        isObject(entry) && typeof entry.code === "string"
          ? [entry.code.trim()]
          : [],
      )
      .filter(Boolean)
      .join("\n\n");
    if (!url || !code) continue;
    const description = shortText(item.codeDescription, 500);
    candidates.push({
      title:
        shortText(item.codeTitle, 300) ??
        shortText(item.pageTitle, 300) ??
        "Context7 code example",
      url,
      retrievedAt,
      supports: description ?? shortText(`Code relevant to: ${query}`, 500)!,
      content: code,
    });
  }
  const sources: EnhancementInputSource[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  for (const source of candidates) {
    const sourceBytes = new TextEncoder().encode(source.content).length;
    if (
      seen.has(`${source.url}\0${source.title}`) ||
      sourceBytes > MAX_SOURCE_BYTES ||
      bytes + sourceBytes > MAX_TOTAL_BYTES
    ) {
      continue;
    }
    seen.add(`${source.url}\0${source.title}`);
    sources.push(source);
    bytes += sourceBytes;
    if (sources.length === 8) break;
  }
  if (sources.length === 0) {
    throw new Error("Context7 returned no bounded documentation snippets.");
  }
  return sources;
}

function parseLibrary(value: unknown): LibraryResult | undefined {
  if (!isObject(value)) return undefined;
  const id = shortText(value.id, 500);
  const title = shortText(value.title, 300);
  if (!id || !title) return undefined;
  return {
    id,
    title,
    description: shortText(value.description, 1_000) ?? "",
    trustScore: numberOrZero(value.trustScore),
    benchmarkScore: numberOrZero(value.benchmarkScore),
    totalSnippets: numberOrZero(value.totalSnippets),
    versions: Array.isArray(value.versions)
      ? value.versions.filter(
          (version): version is string =>
            typeof version === "string" && Boolean(version.trim()),
        )
      : [],
  };
}

function libraryMatchScore(result: LibraryResult, input: string): number {
  const normalized = input
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "");
  const title = result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const idName =
    result.id
      .split("/")
      .at(-1)
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ?? "";
  return title === normalized || idName === normalized
    ? 100
    : title.includes(normalized) || idName.includes(normalized)
      ? 50
      : 0;
}

function versionMatchScore(
  result: LibraryResult,
  version: string | undefined,
): number {
  if (!version) return 0;
  return result.versions.some(
    (candidate) => normalizeVersion(candidate) === normalizeVersion(version),
  )
    ? 1
    : 0;
}

function validateLibraryId(value: string): string {
  const id = bounded(value, "libraryId", 1, 500);
  if (!/^\/[^/]+\/[^/]+(?:[/@][^/]+)?$/.test(id)) {
    throw new Error(
      "Context7 library ID must look like /owner/repository with an optional version.",
    );
  }
  return id;
}

function normalizeVersion(value: string): string {
  return value.trim().toLowerCase().replace(/^v/, "");
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter >= 0
    ? Math.min(retryAfter * 1_000, 10_000)
    : 500 * 2 ** attempt;
}

async function context7Error(response: Response): Promise<Error> {
  let message = "";
  try {
    const body: unknown = await response.json();
    if (isObject(body) && typeof body.message === "string") {
      message = body.message.slice(0, 300);
    }
  } catch {
    // The status remains enough for a recoverable error.
  }
  const guidance =
    response.status === 401
      ? " Public access was rejected; a secure Context7 credential is required before retrying."
      : response.status === 429
        ? " Wait for the displayed reset time before retrying."
        : "";
  const error = new Error(
    `Context7 request failed (${response.status})${message ? `: ${message}` : "."}${guidance}`,
  );
  Object.assign(error, { retryable: response.status >= 500 });
  return error;
}

function isRetryableContext7Error(error: unknown): boolean {
  return isObject(error) && error.retryable === true;
}

function cancelled(): Error {
  return new Error("Context7 research cancelled. No model request was made.");
}

async function delay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw cancelled();
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(cancelled());
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function validUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function shortText(value: unknown, maximum: number): string | undefined {
  const text = optionalText(value);
  return text ? text.slice(0, maximum) : undefined;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function bounded(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new Error(`${field} must contain ${minimum}-${maximum} characters.`);
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
