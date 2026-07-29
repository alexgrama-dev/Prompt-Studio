import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getFeatureStatus, type FeatureStatus } from "./features.ts";
import {
  listPromptsReadOnly,
  type PromptLibrary,
  type PromptRecord,
  type PromptTarget,
} from "./prompt-store.ts";
import { buildFreshnessWarning } from "./build-freshness.ts";
import { extractPlaceholders } from "./placeholders.ts";
import { containsLikelySecret } from "./secrets.ts";
import {
  inspectSearchIndex,
  searchAvailablePrompts,
  type SearchFilters,
} from "./search-index.ts";

export const MCP_READ_TOOL_NAMES = [
  "prompt_studio_status",
  "prompt_studio_list",
  "prompt_studio_search",
  "prompt_studio_get",
] as const;

export type McpReadToolName = (typeof MCP_READ_TOOL_NAMES)[number];

export const MCP_READ_LIMITS = {
  listResults: 50,
  searchResults: 25,
  queryCharacters: 500,
  bodyCharacters: 20_000,
  textOutputCharacters: 28_000,
  auditBytes: 1_000_000,
} as const;

export interface McpAuditEvent {
  timestamp: string;
  tool: string;
  outcome: "success" | "error" | "authorized";
  durationMs: number;
  resultCount?: number;
  errorCode?: string;
}

export type McpAuditWriter = (event: McpAuditEvent) => Promise<void>;

export interface PromptStudioMcpReadOptions {
  directory: string;
  searchIndexPath: string;
  loadStatuses: () => Promise<FeatureStatus[]>;
  audit: McpAuditWriter;
  mutationToolsEnabled?: boolean;
  now?: () => Date;
  beforeOperation?: (
    tool: McpReadToolName,
    signal: AbortSignal | undefined,
  ) => Promise<void>;
}

export interface McpReadSuccess {
  ok: true;
  tool: McpReadToolName;
  data: Record<string, unknown>;
  text: string;
  resultCount: number;
}

export interface McpReadFailure {
  ok: false;
  tool: McpReadToolName;
  code: string;
  message: string;
  text: string;
}

export type McpReadExecution = McpReadSuccess | McpReadFailure;

interface PublicPromptSummary {
  id: string;
  title: string;
  summary: string;
  target: PromptTarget;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  updatedAt: string;
  project?: {
    name: string;
    branch?: string;
    commit?: string;
  };
}

export async function executePromptStudioReadTool(
  tool: McpReadToolName,
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  signal?: AbortSignal,
): Promise<McpReadExecution> {
  const startedAt = Date.now();
  let featureEnabled = false;
  try {
    const statuses = await options.loadStatuses();
    const feature = getFeatureStatus(statuses, "mcp-read");
    featureEnabled = feature.effectiveState !== "disabled";

    if (tool === "prompt_studio_status" && !featureEnabled) {
      assertStrictObject(rawArguments, []);
      return success(
        tool,
        {
          state: feature.effectiveState,
          requestedState: feature.requestedState,
          ...(feature.reason ? { reason: feature.reason } : {}),
          readOnly: true,
          localOnly: true,
          runtimePolicy: "macbook-primary",
          dataRead: false,
          enabledTools: ["prompt_studio_status"],
        },
        [
          "Prompt Studio read-only MCP: Disabled",
          feature.reason ? `Reason: ${feature.reason}` : "",
          "No prompt files, indexes, credentials, audit logs, or network services were accessed.",
        ]
          .filter(Boolean)
          .join("\n"),
        0,
      );
    }

    if (!featureEnabled) {
      throw new McpReadError(
        "FEATURE_DISABLED",
        `Read-only MCP is Disabled${feature.reason ? `: ${feature.reason}` : "."}`,
      );
    }

    throwIfAborted(signal);
    await options.beforeOperation?.(tool, signal);
    throwIfAborted(signal);

    const result = await runTool(tool, rawArguments, options, statuses, signal);
    throwIfAborted(signal);
    await writeAudit(options, {
      timestamp: (options.now?.() ?? new Date()).toISOString(),
      tool,
      outcome: "success",
      durationMs: Math.max(0, Date.now() - startedAt),
      resultCount: result.resultCount,
    });
    return result;
  } catch (error) {
    const normalized = normalizeMcpReadError(error);
    if (featureEnabled) {
      try {
        await writeAudit(options, {
          timestamp: (options.now?.() ?? new Date()).toISOString(),
          tool,
          outcome: "error",
          durationMs: Math.max(0, Date.now() - startedAt),
          errorCode: normalized.code,
        });
      } catch {
        return failure(
          tool,
          "AUDIT_UNAVAILABLE",
          "The privacy-safe MCP audit log is unavailable, so no prompt content was returned.",
        );
      }
    }
    return failure(tool, normalized.code, normalized.message);
  }
}

export function defaultMcpAuditLogPath(): string {
  return join(
    homedir(),
    "Library",
    "Logs",
    "Prompt Studio",
    "mcp-read-audit.jsonl",
  );
}

export function createFileMcpAuditWriter(
  path = defaultMcpAuditLogPath(),
): McpAuditWriter {
  let queue = Promise.resolve();
  return async (event) => {
    const write = queue.then(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      if ((await fileSize(path)) >= MCP_READ_LIMITS.auditBytes) {
        const rotated = `${path}.1`;
        await rm(rotated, { force: true });
        await rename(path, rotated);
      }
      await appendFile(path, `${JSON.stringify(event)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    });
    queue = write.catch(() => undefined);
    await write;
  };
}

async function runTool(
  tool: McpReadToolName,
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  statuses: FeatureStatus[],
  signal?: AbortSignal,
): Promise<McpReadSuccess> {
  switch (tool) {
    case "prompt_studio_status":
      return statusTool(rawArguments, options, statuses, signal);
    case "prompt_studio_list":
      return listTool(rawArguments, options, signal);
    case "prompt_studio_search":
      return searchTool(rawArguments, options, signal);
    case "prompt_studio_get":
      return getTool(rawArguments, options, signal);
  }
}

async function statusTool(
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  statuses: FeatureStatus[],
  signal?: AbortSignal,
): Promise<McpReadSuccess> {
  assertStrictObject(rawArguments, []);
  const feature = getFeatureStatus(statuses, "mcp-read");
  const staleBuild = buildFreshnessWarning(process.argv[1], "pnpm build:mcp");
  let libraryState: Record<string, unknown>;
  try {
    const library = await readLibrary(options.directory, signal);
    const index = inspectSearchIndex(options.searchIndexPath, library.records);
    libraryState = {
      state: "ready",
      promptCount: library.records.length,
      invalidCount: library.invalid.length,
      exactSearch: {
        state: index.status,
        recordCount: index.recordCount,
        needsRebuild: index.needsRebuild,
      },
    };
  } catch (error) {
    const normalized = normalizeMcpReadError(error);
    if (normalized.code === "CANCELLED") throw normalized;
    libraryState = {
      state: "unavailable",
      code: normalized.code,
      message: normalized.message,
    };
  }
  return success(
    "prompt_studio_status",
    {
      state: feature.effectiveState,
      requestedState: feature.requestedState,
      readOnly: !options.mutationToolsEnabled,
      localOnly: true,
      runtimePolicy: "macbook-primary",
      dataRead: true,
      enabledTools: [
        ...MCP_READ_TOOL_NAMES,
        ...(options.mutationToolsEnabled
          ? [
              "prompt_studio_create",
              "prompt_studio_update",
              "prompt_studio_archive",
              "prompt_studio_enhance",
            ]
          : []),
      ],
      library: libraryState,
      ...(staleBuild ? { staleBuild } : {}),
    },
    [
      `Prompt Studio read-only MCP: ${title(feature.effectiveState)}`,
      `Runtime policy: MacBook primary · local stdio · ${options.mutationToolsEnabled ? "confirmation-gated mutations" : "read-only"}`,
      libraryState.state === "ready"
        ? `Prompts: ${String(libraryState.promptCount)} · invalid files: ${String(libraryState.invalidCount)}`
        : `Library: ${String(libraryState.message)}`,
      ...(staleBuild ? [`Warning: ${staleBuild}`] : []),
    ].join("\n"),
    0,
  );
}

async function listTool(
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  signal?: AbortSignal,
): Promise<McpReadSuccess> {
  const args = assertStrictObject(rawArguments, [
    "limit",
    "target",
    "tag",
    "favoriteOnly",
    "includeArchived",
  ]);
  const limit = integerArgument(
    args.limit,
    "limit",
    1,
    MCP_READ_LIMITS.listResults,
    20,
  );
  const target = targetArgument(args.target);
  const tag = optionalShortText(args.tag, "tag", 80)?.toLocaleLowerCase();
  if (tag && containsLikelySecret(tag)) {
    throw new McpReadError(
      "SENSITIVE_INPUT",
      "The tag filter appears to contain a secret. Replace it with a placeholder.",
    );
  }
  const favoriteOnly = booleanArgument(
    args.favoriteOnly,
    "favoriteOnly",
    false,
  );
  const includeArchived = booleanArgument(
    args.includeArchived,
    "includeArchived",
    false,
  );
  const library = await readLibrary(options.directory, signal);
  let sensitiveExcluded = 0;
  const records = library.records
    .filter((record) => includeArchived || !record.archivedAt)
    .filter((record) => !target || record.target === target)
    .filter((record) => !tag || record.tags.includes(tag))
    .filter((record) => !favoriteOnly || record.favorite)
    .flatMap((record) => {
      const summary = publicSummary(record);
      if (summary) return [summary];
      sensitiveExcluded += 1;
      return [];
    })
    .slice(0, limit);
  return success(
    "prompt_studio_list",
    {
      records,
      count: records.length,
      invalidCount: library.invalid.length,
      sensitiveExcluded,
      limit,
    },
    records.length === 0
      ? "No safe prompts matched."
      : records
          .map(
            (record) =>
              `${record.id}  ${record.title}  [${record.target}]${record.archived ? "  archived" : ""}`,
          )
          .join("\n"),
    records.length,
  );
}

async function searchTool(
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  signal?: AbortSignal,
): Promise<McpReadSuccess> {
  const args = assertStrictObject(rawArguments, [
    "query",
    "limit",
    "target",
    "tag",
    "favoriteOnly",
    "includeArchived",
  ]);
  const query = requiredShortText(
    args.query,
    "query",
    2,
    MCP_READ_LIMITS.queryCharacters,
  );
  if (containsLikelySecret(query)) {
    throw new McpReadError(
      "SENSITIVE_INPUT",
      "The search query appears to contain a secret. Replace it with a placeholder.",
    );
  }
  const limit = integerArgument(
    args.limit,
    "limit",
    1,
    MCP_READ_LIMITS.searchResults,
    10,
  );
  const target = targetArgument(args.target);
  const tag = optionalShortText(args.tag, "tag", 80)?.toLocaleLowerCase();
  if (tag && containsLikelySecret(tag)) {
    throw new McpReadError(
      "SENSITIVE_INPUT",
      "The tag filter appears to contain a secret. Replace it with a placeholder.",
    );
  }
  const favoriteOnly = booleanArgument(
    args.favoriteOnly,
    "favoriteOnly",
    false,
  );
  const includeArchived = booleanArgument(
    args.includeArchived,
    "includeArchived",
    false,
  );
  const library = await readLibrary(options.directory, signal);
  const filters: SearchFilters = {
    includeArchived,
    limit,
    ...(target ? { target } : {}),
    ...(tag ? { tag } : {}),
    ...(favoriteOnly ? { favorite: true } : {}),
  };
  const indexed = searchAvailablePrompts(
    library.records,
    query,
    filters,
    options.searchIndexPath,
  );
  throwIfAborted(signal);
  const byId = new Map(library.records.map((record) => [record.id, record]));
  let sensitiveExcluded = 0;
  const matches = indexed.flatMap((result) => {
    const record = byId.get(result.id);
    if (!record) return [];
    const summary = publicSummary(record);
    if (!summary) {
      sensitiveExcluded += 1;
      return [];
    }
    return [
      {
        ...summary,
        score: result.score,
        matchedBy: result.matchedBy,
      },
    ];
  });
  return success(
    "prompt_studio_search",
    {
      query: redactLocalPaths(query),
      matches,
      count: matches.length,
      sensitiveExcluded,
      limit,
    },
    matches.length === 0
      ? `No safe prompts matched "${redactLocalPaths(query)}".`
      : matches
          .map(
            (match) =>
              `${match.id}  ${match.title}  [${match.matchedBy.join(", ")}]`,
          )
          .join("\n"),
    matches.length,
  );
}

async function getTool(
  rawArguments: unknown,
  options: PromptStudioMcpReadOptions,
  signal?: AbortSignal,
): Promise<McpReadSuccess> {
  const args = assertStrictObject(rawArguments, ["id", "maxBodyCharacters"]);
  const selector = requiredShortText(args.id, "id", 8, 64);
  if (!/^[a-f0-9-]+$/i.test(selector)) {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      "id must be a UUID or an unambiguous hexadecimal UUID prefix.",
    );
  }
  const maxBodyCharacters = integerArgument(
    args.maxBodyCharacters,
    "maxBodyCharacters",
    1_000,
    MCP_READ_LIMITS.bodyCharacters,
    12_000,
  );
  const library = await readLibrary(options.directory, signal);
  const record = selectRecord(library.records, selector);
  const sensitiveCandidate = JSON.stringify({
    title: record.title,
    summary: record.summary,
    body: record.body,
    tags: record.tags,
    aliases: record.aliases,
    searchTerms: record.searchTerms,
    assumptions: record.assumptions,
    missingInformation: record.missingInformation,
    validationSteps: record.validationSteps,
    projectName: record.project?.name,
    projectBranch: record.project?.branch,
    projectCommit: record.project?.commit,
  });
  if (containsLikelySecret(sensitiveCandidate)) {
    throw new McpReadError(
      "SENSITIVE_PROMPT_BLOCKED",
      "This prompt appears to contain a secret, so its content was not returned through MCP.",
    );
  }
  const body = redactLocalPaths(record.body).slice(0, maxBodyCharacters);
  const truncated = body.length < redactLocalPaths(record.body).length;
  const placeholders = extractPlaceholders(record.body);
  const data: Record<string, unknown> = {
    id: record.id,
    title: redactLocalPaths(record.title),
    summary: redactLocalPaths(record.summary),
    body,
    bodyCharacters: record.body.length,
    truncated,
    placeholders,
    target: record.target,
    tags: record.tags.map(redactLocalPaths),
    aliases: record.aliases.map(redactLocalPaths),
    searchTerms: record.searchTerms.map(redactLocalPaths),
    favorite: record.favorite,
    archived: Boolean(record.archivedAt),
    updatedAt: record.updatedAt,
    ...(record.project
      ? {
          project: {
            name: redactLocalPaths(record.project.name),
            ...(record.project.branch
              ? { branch: redactLocalPaths(record.project.branch) }
              : {}),
            ...(record.project.commit ? { commit: record.project.commit } : {}),
          },
        }
      : {}),
    ...(record.assumptions
      ? { assumptions: record.assumptions.map(redactLocalPaths) }
      : {}),
    ...(record.missingInformation
      ? {
          missingInformation: record.missingInformation.map(redactLocalPaths),
        }
      : {}),
    ...(record.validationSteps
      ? { validationSteps: record.validationSteps.map(redactLocalPaths) }
      : {}),
  };
  const text = [
    `# ${String(data.title)}`,
    "",
    `Prompt ID: ${record.id}`,
    `Target: ${record.target}`,
    `Tags: ${record.tags.join(", ") || "(none)"}`,
    placeholders.length
      ? `Placeholders to fill before use: ${placeholders.join(", ")}`
      : "",
    truncated
      ? `Body truncated at ${maxBodyCharacters} of ${record.body.length} characters.`
      : "",
    "",
    body,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return success("prompt_studio_get", data, text, 1);
}

async function readLibrary(
  directory: string,
  signal?: AbortSignal,
): Promise<PromptLibrary> {
  throwIfAborted(signal);
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new McpReadError(
      "LIBRARY_UNAVAILABLE",
      "The MacBook prompt library is unavailable. No directory was created.",
    );
  }
  throwIfAborted(signal);
  try {
    const library = await listPromptsReadOnly(directory);
    throwIfAborted(signal);
    return library;
  } catch (error) {
    if (error instanceof McpReadError) throw error;
    throw new McpReadError(
      "LIBRARY_UNAVAILABLE",
      "The MacBook prompt library could not be read.",
    );
  }
}

function publicSummary(record: PromptRecord): PublicPromptSummary | undefined {
  const candidate = JSON.stringify({
    title: record.title,
    summary: record.summary,
    tags: record.tags,
    projectName: record.project?.name,
    projectBranch: record.project?.branch,
    projectCommit: record.project?.commit,
  });
  if (containsLikelySecret(candidate)) return undefined;
  return {
    id: record.id,
    title: redactLocalPaths(record.title),
    summary: redactLocalPaths(record.summary),
    target: record.target,
    tags: record.tags.map(redactLocalPaths),
    favorite: record.favorite,
    archived: Boolean(record.archivedAt),
    updatedAt: record.updatedAt,
    ...(record.project
      ? {
          project: {
            name: redactLocalPaths(record.project.name),
            ...(record.project.branch
              ? { branch: redactLocalPaths(record.project.branch) }
              : {}),
            ...(record.project.commit ? { commit: record.project.commit } : {}),
          },
        }
      : {}),
  };
}

function selectRecord(records: PromptRecord[], selector: string): PromptRecord {
  const exact = records.find((record) => record.id === selector);
  if (exact) return exact;
  const prefixes = records.filter((record) => record.id.startsWith(selector));
  if (prefixes.length === 1) return prefixes[0]!;
  if (prefixes.length > 1) {
    throw new McpReadError(
      "PROMPT_ID_AMBIGUOUS",
      "The prompt identifier prefix matches more than one prompt.",
    );
  }
  throw new McpReadError(
    "PROMPT_NOT_FOUND",
    "The requested prompt was not found.",
  );
}

function success(
  tool: McpReadToolName,
  data: Record<string, unknown>,
  text: string,
  resultCount: number,
): McpReadSuccess {
  return {
    ok: true,
    tool,
    data,
    text: text.slice(0, MCP_READ_LIMITS.textOutputCharacters),
    resultCount,
  };
}

function failure(
  tool: McpReadToolName,
  code: string,
  message: string,
): McpReadFailure {
  return {
    ok: false,
    tool,
    code,
    message,
    text: `Error [${code}]: ${message}`,
  };
}

async function writeAudit(
  options: PromptStudioMcpReadOptions,
  event: McpAuditEvent,
): Promise<void> {
  try {
    await options.audit(event);
  } catch {
    throw new McpReadError(
      "AUDIT_UNAVAILABLE",
      "The privacy-safe MCP audit log is unavailable, so no prompt content was returned.",
    );
  }
}

function assertStrictObject(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  const selected = value ?? {};
  if (
    typeof selected !== "object" ||
    selected === null ||
    Array.isArray(selected)
  ) {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      "Tool arguments must be one JSON object.",
    );
  }
  const object = selected as Record<string, unknown>;
  const unknown = Object.keys(object).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unknown.length > 0) {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      `Unknown tool argument: ${unknown[0]}.`,
    );
  }
  return object;
}

function integerArgument(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      `${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function booleanArgument(
  value: unknown,
  name: string,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      `${name} must be true or false.`,
    );
  }
  return value;
}

function targetArgument(value: unknown): PromptTarget | undefined {
  if (value === undefined) return undefined;
  if (value === "generic" || value === "codex" || value === "claude-code") {
    return value;
  }
  throw new McpReadError(
    "INVALID_ARGUMENTS",
    "target must be generic, codex, or claude-code.",
  );
}

function optionalShortText(
  value: unknown,
  name: string,
  maximum: number,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredShortText(value, name, 1, maximum);
}

function requiredShortText(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new McpReadError("INVALID_ARGUMENTS", `${name} must be text.`);
  }
  const normalized = Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new McpReadError(
      "INVALID_ARGUMENTS",
      `${name} must contain ${minimum}-${maximum} characters.`,
    );
  }
  return normalized;
}

function redactLocalPaths(value: string): string {
  const home = homedir();
  return home ? value.split(home).join("~") : value;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new McpReadError(
      "CANCELLED",
      "The MCP request was cancelled. No prompt content was returned.",
    );
  }
}

function normalizeMcpReadError(error: unknown): McpReadError {
  if (error instanceof McpReadError) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return new McpReadError(
      "CANCELLED",
      "The MCP request was cancelled. No prompt content was returned.",
    );
  }
  return new McpReadError(
    "OPERATION_FAILED",
    "The local MCP read operation failed without returning prompt content.",
  );
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

class McpReadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "McpReadError";
    this.code = code;
  }
}
