import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import {
  enhancementResultToPromptDraft,
  type EnhancementRequest,
  type EnhancementRun,
} from "./enhancement.ts";
import {
  activeCompilerPolicyForStatuses,
  dispatchEnhancement,
} from "./enhancement-dispatch.ts";
import {
  defaultCompilerStatePath,
  loadCompilerState,
  rollbackCompilerPolicy,
} from "./compiler-state.ts";
import {
  featureConfigPath,
  getFeatureStatus,
  loadFeatureStatuses,
  type FeatureId,
  type FeatureStatus,
} from "./features.ts";
import {
  createPromptUseFeedback,
  deletePromptUseFeedback,
  exportPromptUseFeedback,
  getPromptUseFeedback,
  listPromptUseFeedback,
  updatePromptUseFeedback,
  type FeedbackExportFormat,
  type FeedbackOutcomeStatus,
  type FeedbackTargetAgent,
  type FeedbackVerdict,
  type PromptUseFeedbackDraft,
  type PromptUseFeedbackPatch,
} from "./feedback-store.ts";
import {
  createPrompt,
  listPrompts,
  rebuildPromptSearchIndex,
  resolvePromptDirectory,
  updatePrompt,
  type PromptDraft,
  type PromptRecord,
  type PromptTarget,
  type PromptUpdate,
} from "./prompt-store.ts";
import {
  defaultMcpConfirmationDirectory,
  issueMcpConfirmation,
  MCP_MUTATION_ACTIONS,
  type McpMutationAction,
} from "./mcp-confirmation.ts";
import {
  getProviderEnhancementProfile,
  providerPricingDisclosure,
  providerPrivacyDisclosure,
  SELECTABLE_ENHANCEMENT_PROFILE_IDS,
  type SelectableEnhancementProfileId,
} from "./provider-profiles.ts";
import {
  listMissedSearches,
  tallyMissedSearches,
} from "./missed-searches.ts";
import {
  DEFAULT_OVERLAP_THRESHOLD,
  findPromptOverlaps,
} from "./overlap.ts";
import { fusePromptSearch, rebuildQmd, searchQmd } from "./qmd-search.ts";
import {
  defaultSearchIndexPath,
  inspectSearchIndex,
  recordPromptUse,
  searchPrompts,
  type SearchFilters,
  loadPromptUsage,
  type SearchResult,
} from "./search-index.ts";
import { buildFreshnessWarning } from "./build-freshness.ts";
import { extractPlaceholders } from "./placeholders.ts";
import {
  approveOptimizationCandidate,
  createOptimizationProposal,
  defaultOptimizationDirectory,
  deleteOptimizationProposal,
  exportOptimizationProposal,
  getOptimizationProposal,
  listOptimizationProposals,
  optimizationCandidatePolicy,
  recordOptimizationScores,
  type OptimizationCaseScore,
  type OptimizationCriteria,
  type OptimizationProposalDraft,
} from "./optimization.ts";
import {
  generateOptimizationCandidates,
  planOptimizationCandidateGeneration,
} from "./optimization-generation.ts";

export const CLI_EXIT_CODES = {
  success: 0,
  usage: 2,
  disabled: 3,
  notFound: 4,
  validation: 5,
  operation: 6,
  cancelled: 130,
} as const;

export interface PromptStudioCliOptions {
  env?: Readonly<Record<string, string | undefined>>;
  featureStatuses?: FeatureStatus[];
  readStdin?: () => Promise<string>;
  writeClipboard?: (value: string) => Promise<void>;
  providerFetchers?: Partial<
    Record<"openai" | "anthropic" | "google", typeof fetch>
  >;
  signal?: AbortSignal;
}

export interface PromptStudioCliExecution {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ParsedArguments {
  command?: string;
  positionals: string[];
  options: Map<string, string | true>;
}

interface CommandContext {
  parsed: ParsedArguments;
  json: boolean;
  directory: string;
  searchIndexPath: string;
  confirmationDirectory: string;
  optimizationDirectory: string;
  compilerStatePath: string;
  qmdExecutable?: string;
  statuses: FeatureStatus[];
  options: PromptStudioCliOptions;
}

interface CommandOutcome {
  data: unknown;
  human: string;
  exitCode?: number;
}

interface PromptRecordSummary {
  id: string;
  title: string;
  summary: string;
  target: PromptTarget;
  tags: string[];
  updatedAt: string;
  favorite: boolean;
  archived: boolean;
  project?: {
    name: string;
    path: string;
  };
}

const GLOBAL_OPTIONS = new Set([
  "json",
  "help",
  "library",
  "search-index",
  "qmd-executable",
  "feature-config",
  "confirmation-dir",
  "optimization-dir",
  "compiler-state",
]);

const BOOLEAN_OPTIONS = new Set([
  "json",
  "help",
  "yes",
  "all",
  "meaning",
  "qmd",
  "save",
  "body-only",
  "favorite",
  "unarchive",
]);

const COMMAND_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  status: new Set(),
  list: new Set(["all", "limit", "target", "tag", "project", "favorite"]),
  search: new Set([
    "all",
    "limit",
    "target",
    "tag",
    "project",
    "favorite",
    "meaning",
  ]),
  get: new Set(["body-only"]),
  copy: new Set(),
  stats: new Set(),
  overlap: new Set(["threshold"]),
  create: new Set([
    "yes",
    "input",
    "title",
    "summary",
    "body",
    "body-file",
    "target",
    "tags",
    "aliases",
    "search-terms",
  ]),
  update: new Set([
    "yes",
    "input",
    "title",
    "summary",
    "body",
    "body-file",
    "target",
    "tags",
    "aliases",
    "search-terms",
    "favorite",
    "unarchive",
  ]),
  archive: new Set(["yes"]),
  validate: new Set(),
  reindex: new Set(["yes", "qmd"]),
  "authorize-mcp": new Set(["yes", "ttl"]),
  feedback: new Set(["yes", "input", "format", "limit"]),
  optimization: new Set([
    "yes",
    "input",
    "format",
    "limit",
    "max-cost",
    "digest",
  ]),
  enhance: new Set([
    "yes",
    "save",
    "rough",
    "rough-file",
    "target",
    "profile",
    "one-run-instruction",
  ]),
};

export async function executePromptStudioCli(
  argv: readonly string[],
  options: PromptStudioCliOptions = {},
): Promise<PromptStudioCliExecution> {
  let command = "help";
  let json = false;
  try {
    const parsed = parseArguments(argv);
    command = parsed.command ?? "help";
    json = parsed.options.has("json");
    if (
      parsed.options.has("help") ||
      command === "help" ||
      command === "--help"
    ) {
      return execution(0, json, "help", { usage: helpText() }, helpText());
    }
    if (!COMMAND_OPTIONS[command]) {
      throw new CliError(
        "UNKNOWN_COMMAND",
        `Unknown command: ${command}. Run prompt-studio --help.`,
        CLI_EXIT_CODES.usage,
      );
    }
    assertKnownOptions(command, parsed.options);

    const featurePath = optionalPath(
      optionString(parsed, "feature-config"),
      featureConfigPath(),
    );
    const statuses =
      options.featureStatuses ?? (await loadFeatureStatuses(featurePath));
    const qmdExecutable = optionString(parsed, "qmd-executable");
    const context: CommandContext = {
      parsed,
      json,
      directory: resolvePromptDirectory(optionString(parsed, "library")),
      searchIndexPath: optionalPath(
        optionString(parsed, "search-index"),
        defaultSearchIndexPath(),
      ),
      confirmationDirectory: optionalPath(
        optionString(parsed, "confirmation-dir"),
        defaultMcpConfirmationDirectory(),
      ),
      optimizationDirectory: optionalPath(
        optionString(parsed, "optimization-dir"),
        defaultOptimizationDirectory(),
      ),
      compilerStatePath: optionalPath(
        optionString(parsed, "compiler-state"),
        defaultCompilerStatePath(),
      ),
      ...(qmdExecutable ? { qmdExecutable } : {}),
      statuses,
      options,
    };

    const outcome =
      command === "status"
        ? await statusCommand(context)
        : await runEnabledCommand(command, context);
    return execution(
      outcome.exitCode ?? 0,
      json,
      command,
      outcome.data,
      outcome.human,
    );
  } catch (error) {
    const normalized = normalizeCliError(error);
    const payload = {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
    };
    return {
      exitCode: normalized.exitCode,
      stdout: json
        ? `${JSON.stringify({ ok: false, command, error: payload }, null, 2)}\n`
        : "",
      stderr: json ? "" : `Error [${normalized.code}]: ${normalized.message}\n`,
    };
  }
}

async function runEnabledCommand(
  command: string,
  context: CommandContext,
): Promise<CommandOutcome> {
  requireFeature(context.statuses, "local-cli", "Local CLI");
  switch (command) {
    case "list":
      return listCommand(context);
    case "search":
      return searchCommand(context);
    case "get":
      return getCommand(context);
    case "copy":
      return copyCommand(context);
    case "create":
      return createCommand(context);
    case "update":
      return updateCommand(context);
    case "archive":
      return archiveCommand(context);
    case "validate":
      return validateCommand(context);
    case "reindex":
      return reindexCommand(context);
    case "authorize-mcp":
      return authorizeMcpCommand(context);
    case "feedback":
      return feedbackCommand(context);
    case "optimization":
      return optimizationCommand(context);
    case "stats":
      return statsCommand(context);
    case "overlap":
      return overlapCommand(context);
    case "enhance":
      return enhanceCommand(context);
    default:
      throw new CliError(
        "UNKNOWN_COMMAND",
        `Unknown command: ${command}.`,
        CLI_EXIT_CODES.usage,
      );
  }
}

async function statusCommand(context: CommandContext): Promise<CommandOutcome> {
  const localCli = getFeatureStatus(context.statuses, "local-cli");
  const base = {
    cli: featureSummary(localCli),
    libraryDirectory: context.directory,
    searchIndexPath: context.searchIndexPath,
    features: context.statuses.map(featureSummary),
  };
  if (localCli.effectiveState === "disabled") {
    return {
      data: base,
      human: [
        `Local CLI: ${title(localCli.effectiveState)}`,
        localCli.reason ? `Reason: ${localCli.reason}` : "",
        `Library: ${context.directory}`,
        "No prompt files, indexes, credentials, or providers were read.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const library = await listPrompts(context.directory);
  const index = inspectSearchIndex(context.searchIndexPath, library.records);
  const staleBuild = buildFreshnessWarning(process.argv[1], "pnpm build:cli");
  return {
    data: {
      ...base,
      library: {
        promptCount: library.records.length,
        invalidCount: library.invalid.length,
      },
      exactSearch: index,
      ...(staleBuild ? { staleBuild } : {}),
    },
    human: [
      `Local CLI: ${title(localCli.effectiveState)}`,
      `Library: ${context.directory}`,
      `Prompts: ${library.records.length}`,
      `Invalid files: ${library.invalid.length}`,
      `Exact search: ${index.status}${index.needsRebuild ? " (rebuild needed)" : ""}`,
      staleBuild ? `Warning: ${staleBuild}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function listCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  const library = await listPrompts(context.directory);
  const limit = optionLimit(context.parsed, 50);
  const target = optionalTarget(optionString(context.parsed, "target"));
  const tag = optionString(context.parsed, "tag")?.toLocaleLowerCase();
  const project = optionString(context.parsed, "project");
  const includeArchived = context.parsed.options.has("all");
  const favoriteOnly = context.parsed.options.has("favorite");
  const records = library.records
    .filter((record) => includeArchived || !record.archivedAt)
    .filter((record) => !target || record.target === target)
    .filter((record) => !tag || record.tags.includes(tag))
    .filter((record) => !project || record.project?.path === project)
    .filter((record) => !favoriteOnly || record.favorite)
    .slice(0, limit);
  return {
    data: {
      records: records.map(recordSummary),
      count: records.length,
      invalidCount: library.invalid.length,
    },
    human:
      records.length === 0
        ? "No prompts matched."
        : records.map(humanRecordLine).join("\n"),
  };
}

async function searchCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 1, 1);
  const query = context.parsed.positionals[0]!.trim();
  if (!query) {
    throw new CliError(
      "QUERY_REQUIRED",
      "Search requires a non-empty query.",
      CLI_EXIT_CODES.usage,
    );
  }
  const library = await listPrompts(context.directory);
  await ensureExactSearch(context, library.records);
  const target = optionalTarget(optionString(context.parsed, "target"));
  const projectPath = optionString(context.parsed, "project");
  const filters: SearchFilters = {
    includeArchived: context.parsed.options.has("all"),
    limit: optionLimit(context.parsed, 20),
    ...(target ? { target } : {}),
    ...(optionString(context.parsed, "tag")
      ? { tag: optionString(context.parsed, "tag")!.toLocaleLowerCase() }
      : {}),
    ...(projectPath ? { projectPath } : {}),
    ...(context.parsed.options.has("favorite") ? { favorite: true } : {}),
  };
  const exact = searchPrompts(query, filters, context.searchIndexPath);
  let results: SearchResult[] = exact;
  if (context.parsed.options.has("meaning")) {
    requireFeature(context.statuses, "qmd-discovery", "QMD Semantic Discovery");
    const semantic = await searchQmd(query, context.qmdExecutable);
    results = fusePromptSearch(exact, semantic).slice(0, filters.limit);
  }
  const byId = new Map(library.records.map((record) => [record.id, record]));
  const matches = results.flatMap((result) => {
    const record = byId.get(result.id);
    return record ? [{ ...recordSummary(record), ...result }] : [];
  });
  return {
    data: { query, matches, count: matches.length },
    human:
      matches.length === 0
        ? `No prompts matched "${query}".`
        : matches
            .map(
              (match) =>
                `${match.id}  ${match.title}  [${match.matchedBy.join(", ")}]`,
            )
            .join("\n"),
  };
}

async function getCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 1, 1);
  const record = await selectedRecord(context);
  return {
    data: { ...record, placeholders: extractPlaceholders(record.body) },
    human: context.parsed.options.has("body-only")
      ? record.body
      : humanRecord(record),
  };
}

async function copyCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 1, 1);
  if (!context.options.writeClipboard) {
    throw new CliError(
      "CLIPBOARD_UNAVAILABLE",
      "Clipboard access is unavailable in this CLI runtime.",
      CLI_EXIT_CODES.operation,
    );
  }
  const record = await selectedRecord(context);
  await context.options.writeClipboard(record.body);
  try {
    recordPromptUse(record.id, context.searchIndexPath);
  } catch {
    // Copy remains successful when the disposable usage index is unavailable.
  }
  const placeholders = extractPlaceholders(record.body);
  return {
    data: { id: record.id, copied: true, placeholders },
    human: [
      `Copied "${record.title}" to the clipboard.`,
      placeholders.length
        ? `Warning: unfilled placeholders remain: ${placeholders.map((name) => `{{${name}}}`).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function statsCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  const library = await listPrompts(context.directory);
  const active = library.records.filter((record) => !record.archivedAt);
  const usage = loadPromptUsage(context.searchIndexPath);
  const usageAvailable = usage.size > 0 || activeIndexReadable(context);
  const feedback = await listPromptUseFeedback(context.directory);
  const missedSearches = tallyMissedSearches(
    await listMissedSearches(context.directory),
  );

  const ranked = active
    .map((record) => ({
      id: record.id,
      title: record.title,
      useCount: usage.get(record.id)?.useCount ?? 0,
      lastUsedAt: usage.get(record.id)?.lastUsedAt,
    }))
    .sort(
      (left, right) =>
        right.useCount - left.useCount ||
        (right.lastUsedAt ?? "").localeCompare(left.lastUsedAt ?? ""),
    );
  const unused = ranked.filter((entry) => entry.useCount === 0);
  const verdicts: Record<string, number> = {};
  const outcomes: Record<string, number> = {};
  for (const record of feedback.records) {
    verdicts[record.verdict] = (verdicts[record.verdict] ?? 0) + 1;
    const status = record.outcome?.status ?? "unrecorded";
    outcomes[status] = (outcomes[status] ?? 0) + 1;
  }

  const tally = (counts: Record<string, number>) =>
    Object.entries(counts)
      .sort((left, right) => right[1] - left[1])
      .map(([key, count]) => `${key} ${count}`)
      .join(", ") || "(none)";

  return {
    data: {
      prompts: {
        total: library.records.length,
        active: active.length,
        archived: library.records.length - active.length,
      },
      usageAvailable,
      usage: ranked,
      zeroUse: unused.map((entry) => entry.id),
      feedback: {
        total: feedback.records.length,
        verdicts,
        outcomes,
      },
      missedSearches: missedSearches.slice(0, 20),
    },
    human: [
      `Prompts: ${active.length} active, ${library.records.length - active.length} archived`,
      usageAvailable
        ? `Used: ${ranked.filter((entry) => entry.useCount > 0).length} of ${active.length}`
        : "Usage: index unavailable, counts show zero",
      ...ranked
        .filter((entry) => entry.useCount > 0)
        .slice(0, 10)
        .map(
          (entry) =>
            `  ${entry.useCount}x  ${entry.title}  (last ${entry.lastUsedAt ?? "unknown"})`,
        ),
      `Zero use: ${unused.length ? unused.map((entry) => entry.title).join(", ") : "(none)"}`,
      `Feedback: ${feedback.records.length} records`,
      `  Verdicts: ${tally(verdicts)}`,
      `  Outcomes: ${tally(outcomes)}`,
      `Missed searches: ${missedSearches.length ? `${missedSearches.length} distinct queries with no match` : "(none)"}`,
      ...missedSearches
        .slice(0, 5)
        .map(
          (entry) =>
            `  ${entry.count}x  "${entry.query}"  (last ${entry.lastAt})`,
        ),
    ].join("\n"),
  };
}

async function overlapCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  const rawThreshold = optionString(context.parsed, "threshold");
  const threshold = rawThreshold
    ? Number(rawThreshold)
    : DEFAULT_OVERLAP_THRESHOLD;
  if (!Number.isFinite(threshold)) {
    throw new CliError(
      "INVALID_THRESHOLD",
      "The --threshold option must be a number between 0.2 and 0.95.",
      CLI_EXIT_CODES.usage,
    );
  }
  const library = await listPrompts(context.directory);
  let overlaps;
  try {
    overlaps = findPromptOverlaps(library.records, threshold);
  } catch (error) {
    throw new CliError(
      "INVALID_THRESHOLD",
      error instanceof Error ? error.message : String(error),
      CLI_EXIT_CODES.usage,
    );
  }
  return {
    data: { threshold, overlaps, count: overlaps.length },
    human: overlaps.length
      ? [
          `${overlaps.length} overlapping pair${overlaps.length === 1 ? "" : "s"} at similarity >= ${threshold}:`,
          ...overlaps.map(
            (overlap) =>
              `  ${Math.round(overlap.similarity * 100)}%  ${overlap.leftTitle}  <->  ${overlap.rightTitle}`,
          ),
          "Review each pair, then merge or `archive <id> --yes` the weaker prompt.",
        ].join("\n")
      : `No overlapping prompts at similarity >= ${threshold}.`,
  };
}

function activeIndexReadable(context: CommandContext): boolean {
  try {
    return inspectSearchIndex(context.searchIndexPath).status !== "missing";
  } catch {
    return false;
  }
}

async function createCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  requireYes(context.parsed, "create a prompt");
  const draft = await createDraft(context);
  const record = await createPrompt(context.directory, draft);
  return {
    data: record,
    human: `Created ${record.id}  ${record.title}`,
  };
}

async function updateCommand(context: CommandContext): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 1, 1);
  requireYes(context.parsed, "update a prompt");
  const current = await selectedRecord(context);
  const patch = await updatePatch(context);
  const update: PromptUpdate = {
    title: stringValue(patch.title, current.title),
    summary: stringValue(patch.summary, current.summary),
    body: stringValue(patch.body, current.body),
    target: targetValue(patch.target, current.target),
    tags: stringArrayValue(patch.tags, current.tags),
    aliases: stringArrayValue(patch.aliases, current.aliases),
    searchTerms: stringArrayValue(patch.searchTerms, current.searchTerms),
    ...(patch.favorite === true ? { favorite: true } : {}),
    ...(patch.archived === false ? { archived: false } : {}),
  };
  const record = await updatePrompt(context.directory, current.id, update);
  return {
    data: record,
    human: `Updated ${record.id}  ${record.title}`,
  };
}

async function archiveCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 1, 1);
  requireYes(context.parsed, "archive a prompt");
  const current = await selectedRecord(context);
  const record = await updatePrompt(context.directory, current.id, {
    title: current.title,
    summary: current.summary,
    body: current.body,
    target: current.target,
    tags: current.tags,
    aliases: current.aliases,
    searchTerms: current.searchTerms,
    archived: true,
  });
  return {
    data: { id: record.id, archivedAt: record.archivedAt },
    human: `Archived ${record.id}  ${record.title}`,
  };
}

async function validateCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  const library = await listPrompts(context.directory);
  const data = {
    validCount: library.records.length,
    invalidCount: library.invalid.length,
    invalid: library.invalid,
  };
  return {
    data,
    ...(library.invalid.length > 0
      ? { exitCode: CLI_EXIT_CODES.validation }
      : {}),
    human:
      library.invalid.length === 0
        ? `Valid prompt files: ${library.records.length}\nInvalid prompt files: 0`
        : [
            `Valid prompt files: ${library.records.length}`,
            `Invalid prompt files: ${library.invalid.length}`,
            ...library.invalid.map((item) => `${item.filePath}: ${item.error}`),
          ].join("\n"),
  };
}

async function reindexCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  requireYes(context.parsed, "rebuild disposable search indexes");
  const exact = await rebuildPromptSearchIndex(
    context.directory,
    context.searchIndexPath,
  );
  let qmd: unknown;
  if (context.parsed.options.has("qmd")) {
    requireFeature(context.statuses, "qmd-discovery", "QMD Semantic Discovery");
    const library = await listPrompts(context.directory);
    qmd = await rebuildQmd(
      context.directory,
      library.records,
      context.qmdExecutable,
    );
  }
  return {
    data: { exact, ...(qmd ? { qmd } : {}) },
    human: [
      `Exact search: ${exact.status} · ${exact.recordCount} prompts`,
      qmd ? "QMD semantic index: rebuilt" : "QMD semantic index: unchanged",
    ].join("\n"),
  };
}

async function authorizeMcpCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 2, 2);
  requireFeature(context.statuses, "mcp-write", "MCP Mutations");
  requireYes(context.parsed, "issue a one-time MCP mutation confirmation");
  const action = context.parsed.positionals[0] as McpMutationAction;
  if (!MCP_MUTATION_ACTIONS.includes(action)) {
    throw new CliError(
      "INVALID_MCP_ACTION",
      `MCP action must be one of: ${MCP_MUTATION_ACTIONS.join(", ")}.`,
      CLI_EXIT_CODES.usage,
    );
  }
  const requestDigest = context.parsed.positionals[1]!;
  if (!/^[a-f0-9]{64}$/.test(requestDigest)) {
    throw new CliError(
      "INVALID_MCP_DIGEST",
      "The MCP request digest must be 64 lowercase hexadecimal characters.",
      CLI_EXIT_CODES.usage,
    );
  }
  const ttlSeconds = boundedIntegerOption(context.parsed, "ttl", 30, 900, 300);
  const issued = await issueMcpConfirmation(
    context.confirmationDirectory,
    action,
    requestDigest,
    ttlSeconds,
  );
  return {
    data: issued,
    human: [
      `One-time MCP confirmation for ${action}:`,
      issued.token,
      `Expires: ${issued.expiresAt}`,
      "It is bound to the exact request digest and is consumed on the first attempt.",
    ].join("\n"),
  };
}

async function feedbackCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  requireFeature(context.statuses, "feedback", "Outcome Feedback");
  assertPositionals(context.parsed, 1, 2);
  const operation = context.parsed.positionals[0]!;

  if (operation === "list") {
    const promptId = context.parsed.positionals[1];
    const library = await listPromptUseFeedback(context.directory);
    const limit = optionLimit(context.parsed, 100);
    const records = library.records
      .filter(
        (record) =>
          !promptId ||
          record.prompt.promptId === promptId ||
          (promptId.length >= 8 && record.prompt.promptId.startsWith(promptId)),
      )
      .slice(0, limit);
    return {
      data: {
        records: records.map(feedbackPublicRecord),
        count: records.length,
        invalidCount: library.invalid.length,
      },
      human:
        records.length === 0
          ? "No feedback records matched."
          : records.map(feedbackHumanLine).join("\n"),
    };
  }

  if (operation === "get") {
    assertPositionals(context.parsed, 2, 2);
    const record = await getPromptUseFeedback(
      context.directory,
      context.parsed.positionals[1]!,
    );
    return {
      data: feedbackPublicRecord(record),
      human: exportPromptUseFeedback([record], "markdown"),
    };
  }

  if (operation === "add") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "record prompt-use feedback");
    const input = await requiredJsonInput(context, "feedback add");
    const prompt = await findPromptRecord(
      context.directory,
      context.parsed.positionals[1]!,
    );
    const record = await createPromptUseFeedback(
      context.directory,
      feedbackDraftFromInput(prompt, input),
    );
    return {
      data: feedbackPublicRecord(record),
      human: `Recorded ${record.id}  ${record.verdict}  ${record.prompt.title}`,
    };
  }

  if (operation === "update") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "update feedback");
    const input = await requiredJsonInput(context, "feedback update");
    const record = await updatePromptUseFeedback(
      context.directory,
      context.parsed.positionals[1]!,
      feedbackPatchFromInput(input),
    );
    return {
      data: feedbackPublicRecord(record),
      human: `Updated feedback ${record.id}  revision ${record.revision}`,
    };
  }

  if (operation === "delete") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "delete this feedback record");
    const id = context.parsed.positionals[1]!;
    await deletePromptUseFeedback(context.directory, id);
    return {
      data: { id, deleted: true },
      human: `Deleted feedback ${id}. The linked prompt was not changed.`,
    };
  }

  if (operation === "export") {
    const promptId = context.parsed.positionals[1];
    const format = feedbackExportFormat(
      optionString(context.parsed, "format") ?? "json",
    );
    const library = await listPromptUseFeedback(context.directory);
    const records = library.records.filter(
      (record) =>
        !promptId ||
        record.prompt.promptId === promptId ||
        (promptId.length >= 8 && record.prompt.promptId.startsWith(promptId)),
    );
    const exported = exportPromptUseFeedback(records, format);
    return {
      data: {
        format,
        count: records.length,
        content: exported,
      },
      human: exported,
    };
  }

  throw new CliError(
    "UNKNOWN_FEEDBACK_OPERATION",
    "Feedback operation must be list, get, add, update, delete, or export.",
    CLI_EXIT_CODES.usage,
  );
}

async function optimizationCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  requireFeature(context.statuses, "optimization", "Prompt Optimization");
  assertPositionals(context.parsed, 1, 3);
  const operation = context.parsed.positionals[0]!;

  if (operation === "status") {
    assertPositionals(context.parsed, 1, 1);
    const [library, compilerState] = await Promise.all([
      listOptimizationProposals(context.optimizationDirectory),
      loadCompilerState(context.compilerStatePath),
    ]);
    const active = compilerState.policies.find(
      (policy) => policy.digest === compilerState.currentDigest,
    )!;
    return {
      data: {
        activeCompiler: active,
        compilerRevision: compilerState.revision,
        proposalCount: library.proposals.length,
        invalidCount: library.invalid.length,
      },
      human: [
        `Active compiler: ${active.version}`,
        `Digest: ${active.digest}`,
        `Proposals: ${library.proposals.length}`,
        `Needs repair: ${library.invalid.length}`,
      ].join("\n"),
    };
  }

  if (operation === "list") {
    assertPositionals(context.parsed, 1, 1);
    const library = await listOptimizationProposals(
      context.optimizationDirectory,
    );
    const limit = optionLimit(context.parsed, 100);
    const proposals = library.proposals.slice(0, limit);
    return {
      data: {
        proposals: proposals.map(optimizationPublicProposal),
        count: proposals.length,
        invalidCount: library.invalid.length,
      },
      human:
        proposals.length === 0
          ? "No optimization proposals found."
          : proposals
              .map(
                (proposal) =>
                  `${proposal.id}  ${proposal.status}  ${proposal.title}`,
              )
              .join("\n"),
    };
  }

  if (operation === "get") {
    assertPositionals(context.parsed, 2, 2);
    const proposal = await getOptimizationProposal(
      context.optimizationDirectory,
      context.parsed.positionals[1]!,
    );
    return {
      data: optimizationPublicProposal(proposal),
      human: exportOptimizationProposal(proposal, "markdown"),
    };
  }

  if (operation === "create") {
    assertPositionals(context.parsed, 1, 1);
    requireYes(context.parsed, "create this local optimization proposal");
    const input = await requiredJsonInput(context, "optimization create");
    assertInputKeys(input, "optimization create", [
      "title",
      "feedbackIds",
      "evaluationCaseIds",
      "candidates",
      "criteria",
    ]);
    const feedback = await optimizationFeedbackRecords(
      context.directory,
      stringArrayValue(input.feedbackIds, []),
    );
    const compilerState = await loadCompilerState(context.compilerStatePath);
    const proposal = await createOptimizationProposal(
      context.optimizationDirectory,
      {
        title: stringValue(input.title, ""),
        feedback,
        approvedEvidence: true,
        evaluationCaseIds: stringArrayValue(input.evaluationCaseIds, []),
        candidates: input.candidates as OptimizationProposalDraft["candidates"],
        ...(input.criteria
          ? {
              criteria: input.criteria as Partial<
                Omit<OptimizationCriteria, "protectedCasesMayRegress">
              >,
            }
          : {}),
        baseline: compilerState.policies.find(
          (policy) => policy.digest === compilerState.currentDigest,
        )!,
      },
    );
    return {
      data: optimizationPublicProposal(proposal),
      human: `Created optimization proposal ${proposal.id}. It cannot change the active compiler before evaluation and approval.`,
    };
  }

  if (operation === "generate") {
    assertPositionals(context.parsed, 1, 1);
    const input = await requiredJsonInput(context, "optimization generate");
    assertInputKeys(input, "optimization generate", [
      "title",
      "feedbackIds",
      "evaluationCaseIds",
      "candidateCount",
      "criteria",
    ]);
    const feedback = await optimizationFeedbackRecords(
      context.directory,
      stringArrayValue(input.feedbackIds, []),
    );
    const compilerState = await loadCompilerState(context.compilerStatePath);
    const currentCompiler = compilerState.policies.find(
      (policy) => policy.digest === compilerState.currentDigest,
    )!;
    const plan = planOptimizationCandidateGeneration({
      feedback,
      evaluationCaseIds: stringArrayValue(input.evaluationCaseIds, []),
      candidateCount: requiredInputInteger(
        input.candidateCount,
        "candidateCount",
        2,
        4,
      ),
      currentCompiler,
    });
    if (!context.parsed.options.has("yes")) {
      throw new CliError(
        "CONFIRMATION_REQUIRED",
        `Review optimization request ${plan.requestDigest}. Maximum estimate: $${plan.maximumCostUsd.toFixed(6)}. ${plan.privacyDisclosure} Re-run with --yes --max-cost <usd> to transmit only this reviewed evidence.`,
        CLI_EXIT_CODES.usage,
        {
          requestDigest: plan.requestDigest,
          maximumCostUsd: plan.maximumCostUsd,
          privacyDisclosure: plan.privacyDisclosure,
        },
      );
    }
    const confirmedMaximumUsd = requiredPositiveOption(
      context.parsed,
      "max-cost",
    );
    const generated = await generateOptimizationCandidates(plan, {
      apiKey: selectedProviderKey("openai", context.options.env),
      confirmedMaximumUsd,
      ...(context.options.signal ? { signal: context.options.signal } : {}),
      ...(context.options.providerFetchers?.openai
        ? { fetcher: context.options.providerFetchers.openai }
        : {}),
    });
    const proposal = await createOptimizationProposal(
      context.optimizationDirectory,
      {
        title: stringValue(input.title, ""),
        feedback,
        approvedEvidence: true,
        evaluationCaseIds: stringArrayValue(input.evaluationCaseIds, []),
        candidates: generated.candidates,
        ...(input.criteria
          ? {
              criteria: input.criteria as Partial<
                Omit<OptimizationCriteria, "protectedCasesMayRegress">
              >,
            }
          : {}),
        baseline: currentCompiler,
      },
    );
    return {
      data: {
        proposal: optimizationPublicProposal(proposal),
        generation: generated,
      },
      human: [
        `Generated ${generated.candidates.length} candidates and saved proposal ${proposal.id}.`,
        `Actual generation estimate: $${generated.usage.estimatedCostUsd.toFixed(6)}`,
        "The proposal remains separate from the active compiler until evaluation and human approval.",
      ].join("\n"),
    };
  }

  if (operation === "evaluate") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "record these human-reviewed evaluation scores");
    const input = await requiredJsonInput(context, "optimization evaluate");
    assertInputKeys(input, "optimization evaluate", ["scores"]);
    if (!Array.isArray(input.scores)) {
      throw new CliError(
        "INVALID_OPTIMIZATION_SCORES",
        "optimization evaluate requires a scores array.",
        CLI_EXIT_CODES.validation,
      );
    }
    const proposal = await recordOptimizationScores(
      context.optimizationDirectory,
      context.parsed.positionals[1]!,
      input.scores as OptimizationCaseScore[],
    );
    return {
      data: optimizationPublicProposal(proposal),
      human: exportOptimizationProposal(proposal, "markdown"),
    };
  }

  if (operation === "approve") {
    assertPositionals(context.parsed, 3, 3);
    const proposal = await getOptimizationProposal(
      context.optimizationDirectory,
      context.parsed.positionals[1]!,
    );
    const candidateId = context.parsed.positionals[2]!;
    const policy = optimizationCandidatePolicy(proposal, candidateId);
    const suppliedDigest = optionString(context.parsed, "digest");
    if (!context.parsed.options.has("yes") || !suppliedDigest) {
      throw new CliError(
        "CONFIRMATION_REQUIRED",
        `Review candidate ${candidateId}, its evaluation, and instruction diff. Re-run with --yes --digest ${policy.digest} to accept exactly this compiler version. The previous version remains available for rollback.`,
        CLI_EXIT_CODES.usage,
        {
          proposalId: proposal.id,
          candidateId,
          policyDigest: policy.digest,
        },
      );
    }
    const compilerState = await loadCompilerState(context.compilerStatePath);
    const state = await approveOptimizationCandidate(
      context.optimizationDirectory,
      proposal.id,
      candidateId,
      suppliedDigest,
      context.compilerStatePath,
      {
        expectedCurrentDigest: compilerState.currentDigest,
        confirmed: true,
      },
    );
    return {
      data: {
        activeCompiler: state.policies.find(
          (item) => item.digest === state.currentDigest,
        ),
        revision: state.revision,
      },
      human: `Accepted ${candidateId} as compiler revision ${state.revision}. It is used only when Prompt Optimization is Active.`,
    };
  }

  if (operation === "rollback") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "roll back to this reviewed compiler digest");
    const state = await loadCompilerState(context.compilerStatePath);
    const rolledBack = await rollbackCompilerPolicy(
      context.compilerStatePath,
      context.parsed.positionals[1]!,
      {
        expectedCurrentDigest: state.currentDigest,
        confirmed: true,
      },
    );
    const active = rolledBack.policies.find(
      (policy) => policy.digest === rolledBack.currentDigest,
    )!;
    return {
      data: { activeCompiler: active, revision: rolledBack.revision },
      human: `Rolled back to ${active.version}. Later policies and evaluation evidence were preserved.`,
    };
  }

  if (operation === "export") {
    assertPositionals(context.parsed, 2, 2);
    const proposal = await getOptimizationProposal(
      context.optimizationDirectory,
      context.parsed.positionals[1]!,
    );
    const format = optionString(context.parsed, "format") ?? "json";
    if (format !== "json" && format !== "markdown") {
      throw new CliError(
        "INVALID_EXPORT_FORMAT",
        "Optimization export format must be json or markdown.",
        CLI_EXIT_CODES.validation,
      );
    }
    const content = exportOptimizationProposal(proposal, format);
    return {
      data: { format, content },
      human: content,
    };
  }

  if (operation === "delete") {
    assertPositionals(context.parsed, 2, 2);
    requireYes(context.parsed, "delete this unaccepted optimization proposal");
    const compilerState = await loadCompilerState(context.compilerStatePath);
    const acceptedProposalIds = new Set(
      compilerState.policies
        .map((policy) => policy.proposalId)
        .filter((id): id is string => Boolean(id)),
    );
    const id = context.parsed.positionals[1]!;
    await deleteOptimizationProposal(
      context.optimizationDirectory,
      id,
      acceptedProposalIds,
    );
    return {
      data: { id, deleted: true },
      human: `Deleted unaccepted optimization proposal ${id}. Compiler state and feedback were unchanged.`,
    };
  }

  throw new CliError(
    "UNKNOWN_OPTIMIZATION_OPERATION",
    "Optimization operation must be status, list, get, create, generate, evaluate, approve, rollback, export, or delete.",
    CLI_EXIT_CODES.usage,
  );
}

async function enhanceCommand(
  context: CommandContext,
): Promise<CommandOutcome> {
  assertPositionals(context.parsed, 0, 0);
  const profileId = selectedProfileId(
    optionString(context.parsed, "profile") ?? "openai-standard-v1",
  );
  const profile = getProviderEnhancementProfile(profileId);
  requireFeature(
    context.statuses,
    providerFeature(profile.provider),
    `${title(profile.provider)} Provider`,
  );
  const roughThoughts = await requiredTextInput(
    context,
    "rough",
    "rough-file",
    "Rough thoughts",
  );
  const target =
    optionalTarget(optionString(context.parsed, "target") ?? "codex") ??
    "codex";
  const oneRunInstruction = optionString(
    context.parsed,
    "one-run-instruction",
  )?.trim();
  const request: EnhancementRequest = {
    roughThoughts,
    target,
    profileId,
    researchLevel: "none",
    ...(oneRunInstruction ? { oneRunInstruction } : {}),
  };
  if (!context.parsed.options.has("yes")) {
    throw new CliError(
      "CONFIRMATION_REQUIRED",
      `Enhancement sends the reviewed input to ${title(profile.provider)} and may incur cost. Re-run with --yes after reviewing this profile: ${profile.title}. ${providerPricingDisclosure(profile)} ${providerPrivacyDisclosure(profile)}`,
      CLI_EXIT_CODES.usage,
    );
  }
  const apiKey = selectedProviderKey(profile.provider, context.options.env);
  const run = await runSelectedProvider(request, apiKey, context);
  let saved: PromptRecord | undefined;
  if (context.parsed.options.has("save")) {
    saved = await createPrompt(
      context.directory,
      enhancementResultToPromptDraft(run, request),
    );
  }
  return {
    data: {
      run,
      saved: saved ? recordSummary(saved) : null,
    },
    human: [
      run.result.enhancedPrompt,
      "",
      `Provider: ${title(run.profile.provider)} · ${run.profile.model} · ${run.profile.reasoningEffort}`,
      `Estimated actual cost: $${run.usage.estimatedCostUsd.toFixed(6)}`,
      saved
        ? `Saved: ${saved.id}  ${saved.title}`
        : "Not saved. Add --save --yes to write the validated result.",
    ].join("\n"),
  };
}

async function runSelectedProvider(
  request: EnhancementRequest,
  apiKey: string,
  context: CommandContext,
): Promise<EnhancementRun> {
  const profile = getProviderEnhancementProfile(
    request.profileId as SelectableEnhancementProfileId,
  );
  const compilerPolicy = await activeCompilerPolicyForStatuses(
    context.statuses,
    context.compilerStatePath,
  );
  return dispatchEnhancement(request, {
    apiKey,
    ...(context.options.signal ? { signal: context.options.signal } : {}),
    ...(context.options.providerFetchers?.[profile.provider]
      ? {
          fetchers: {
            [profile.provider]:
              context.options.providerFetchers[profile.provider],
          },
        }
      : {}),
    ...(compilerPolicy ? { compilerPolicy } : {}),
  });
}

async function createDraft(context: CommandContext): Promise<PromptDraft> {
  const input = await optionalJsonInput(context);
  const titleValue =
    unknownString(input?.title) ?? optionString(context.parsed, "title");
  const bodyValue =
    unknownString(input?.body) ??
    optionString(context.parsed, "body") ??
    (optionString(context.parsed, "body-file")
      ? await readTextSource(
          optionString(context.parsed, "body-file")!,
          context.options,
        )
      : undefined);
  if (!titleValue?.trim() || !bodyValue?.trim()) {
    throw new CliError(
      "PROMPT_FIELDS_REQUIRED",
      "Create requires title and body through --input JSON or --title plus --body/--body-file.",
      CLI_EXIT_CODES.usage,
    );
  }
  const target = targetValue(
    input?.target ?? optionString(context.parsed, "target"),
    "generic",
  );
  const summary =
    unknownString(input?.summary) ?? optionString(context.parsed, "summary");
  return {
    title: titleValue,
    body: bodyValue,
    target,
    ...(summary ? { summary } : {}),
    tags: input?.tags
      ? stringArrayValue(input.tags, [])
      : commaTerms(optionString(context.parsed, "tags")),
    aliases: input?.aliases
      ? stringArrayValue(input.aliases, [])
      : commaTerms(optionString(context.parsed, "aliases")),
    searchTerms: input?.searchTerms
      ? stringArrayValue(input.searchTerms, [])
      : commaTerms(optionString(context.parsed, "search-terms")),
    ...(input?.project !== undefined
      ? { project: input.project as NonNullable<PromptDraft["project"]> }
      : {}),
    ...(input?.projectFiles !== undefined
      ? {
          projectFiles: input.projectFiles as NonNullable<
            PromptDraft["projectFiles"]
          >,
        }
      : {}),
    ...(input?.assumptions !== undefined
      ? {
          assumptions: input.assumptions as NonNullable<
            PromptDraft["assumptions"]
          >,
        }
      : {}),
    ...(input?.missingInformation !== undefined
      ? {
          missingInformation: input.missingInformation as NonNullable<
            PromptDraft["missingInformation"]
          >,
        }
      : {}),
    ...(input?.validationSteps !== undefined
      ? {
          validationSteps: input.validationSteps as NonNullable<
            PromptDraft["validationSteps"]
          >,
        }
      : {}),
    ...(input?.taxonomy !== undefined
      ? { taxonomy: input.taxonomy as NonNullable<PromptDraft["taxonomy"]> }
      : {}),
    ...(input?.sources !== undefined
      ? { sources: input.sources as NonNullable<PromptDraft["sources"]> }
      : {}),
    ...(input?.enhancement !== undefined
      ? {
          enhancement: input.enhancement as NonNullable<
            PromptDraft["enhancement"]
          >,
        }
      : {}),
  };
}

async function updatePatch(
  context: CommandContext,
): Promise<Record<string, unknown>> {
  const input = (await optionalJsonInput(context)) ?? {};
  return {
    ...input,
    ...(optionString(context.parsed, "title")
      ? { title: optionString(context.parsed, "title") }
      : {}),
    ...(optionString(context.parsed, "summary")
      ? { summary: optionString(context.parsed, "summary") }
      : {}),
    ...(optionString(context.parsed, "body")
      ? { body: optionString(context.parsed, "body") }
      : {}),
    ...(optionString(context.parsed, "body-file")
      ? {
          body: await readTextSource(
            optionString(context.parsed, "body-file")!,
            context.options,
          ),
        }
      : {}),
    ...(optionString(context.parsed, "target")
      ? { target: optionString(context.parsed, "target") }
      : {}),
    ...(optionString(context.parsed, "tags")
      ? { tags: commaTerms(optionString(context.parsed, "tags")) }
      : {}),
    ...(optionString(context.parsed, "aliases")
      ? { aliases: commaTerms(optionString(context.parsed, "aliases")) }
      : {}),
    ...(optionString(context.parsed, "search-terms")
      ? {
          searchTerms: commaTerms(optionString(context.parsed, "search-terms")),
        }
      : {}),
    ...(context.parsed.options.has("favorite") ? { favorite: true } : {}),
    ...(context.parsed.options.has("unarchive") ? { archived: false } : {}),
  };
}

async function optionalJsonInput(
  context: CommandContext,
): Promise<Record<string, unknown> | undefined> {
  const source = optionString(context.parsed, "input");
  if (!source) return undefined;
  const text = await readTextSource(source, context.options);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CliError(
      "INVALID_INPUT_JSON",
      "The input document is not valid JSON.",
      CLI_EXIT_CODES.validation,
    );
  }
  if (!isObject(value)) {
    throw new CliError(
      "INVALID_INPUT_JSON",
      "The input JSON must be one object.",
      CLI_EXIT_CODES.validation,
    );
  }
  return value;
}

async function requiredJsonInput(
  context: CommandContext,
  operation: string,
): Promise<Record<string, unknown>> {
  const input = await optionalJsonInput(context);
  if (!input) {
    throw new CliError(
      "INPUT_REQUIRED",
      `${operation} requires --input <file|-> containing one JSON object.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return input;
}

async function requiredTextInput(
  context: CommandContext,
  valueOption: string,
  fileOption: string,
  label: string,
): Promise<string> {
  const inline = optionString(context.parsed, valueOption)?.trim();
  const source = optionString(context.parsed, fileOption);
  const value =
    inline ?? (source ? await readTextSource(source, context.options) : "");
  if (!value.trim()) {
    throw new CliError(
      "TEXT_INPUT_REQUIRED",
      `${label} require --${valueOption} or --${fileOption}.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return value.trim();
}

async function readTextSource(
  source: string,
  options: PromptStudioCliOptions,
): Promise<string> {
  if (source === "-") {
    if (!options.readStdin) {
      throw new CliError(
        "STDIN_UNAVAILABLE",
        "Standard input is unavailable.",
        CLI_EXIT_CODES.usage,
      );
    }
    return options.readStdin();
  }
  return readFile(optionalPath(source), "utf8");
}

async function selectedRecord(context: CommandContext): Promise<PromptRecord> {
  return findPromptRecord(context.directory, context.parsed.positionals[0]!);
}

async function findPromptRecord(
  directory: string,
  selector: string,
): Promise<PromptRecord> {
  const library = await listPrompts(directory);
  const exact = library.records.find((record) => record.id === selector);
  if (exact) return exact;
  const prefix = library.records.filter(
    (record) => selector.length >= 8 && record.id.startsWith(selector),
  );
  if (prefix.length === 1) return prefix[0]!;
  throw new CliError(
    "PROMPT_NOT_FOUND",
    prefix.length > 1
      ? `Prompt identifier prefix is ambiguous: ${selector}.`
      : `Prompt not found: ${selector}.`,
    CLI_EXIT_CODES.notFound,
  );
}

function feedbackDraftFromInput(
  prompt: PromptRecord,
  input: Record<string, unknown>,
): PromptUseFeedbackDraft {
  assertInputKeys(input, "feedback add", [
    "usedAt",
    "targetAgent",
    "targetApplication",
    "projectCommit",
    "verdict",
    "rating",
    "critique",
    "correction",
    "finalPrompt",
    "outcomeStatus",
    "outcomeSummary",
    "notes",
  ]);
  return {
    prompt,
    targetAgent: feedbackTargetAgent(input.targetAgent ?? prompt.target),
    verdict: feedbackVerdict(input.verdict ?? "not-rated"),
    ...optionalInputText(input, "usedAt"),
    ...optionalInputText(input, "targetApplication"),
    ...optionalInputText(input, "projectCommit", prompt.project?.commit),
    ...optionalInputNumber(input, "rating"),
    ...optionalInputText(input, "critique"),
    ...optionalInputText(input, "correction"),
    ...optionalInputText(input, "finalPrompt"),
    ...optionalFeedbackOutcome(input),
    ...optionalInputText(input, "notes"),
  };
}

function feedbackPatchFromInput(
  input: Record<string, unknown>,
): PromptUseFeedbackPatch {
  assertInputKeys(input, "feedback update", [
    "usedAt",
    "targetAgent",
    "targetApplication",
    "projectCommit",
    "verdict",
    "rating",
    "critique",
    "correction",
    "finalPrompt",
    "outcomeStatus",
    "outcomeSummary",
    "notes",
  ]);
  const patch: PromptUseFeedbackPatch = {
    ...(input.usedAt === undefined
      ? {}
      : { usedAt: inputText(input.usedAt, "usedAt") }),
    ...(input.targetAgent === undefined
      ? {}
      : { targetAgent: feedbackTargetAgent(input.targetAgent) }),
    ...nullableInputText(input, "targetApplication"),
    ...nullableInputText(input, "projectCommit"),
    ...(input.verdict === undefined
      ? {}
      : { verdict: feedbackVerdict(input.verdict) }),
    ...nullableInputNumber(input, "rating"),
    ...nullableInputText(input, "critique"),
    ...nullableInputText(input, "correction"),
    ...nullableInputText(input, "finalPrompt"),
    ...(input.outcomeStatus === undefined
      ? {}
      : {
          outcomeStatus:
            input.outcomeStatus === null
              ? null
              : feedbackOutcomeStatus(input.outcomeStatus),
        }),
    ...nullableInputText(input, "outcomeSummary"),
    ...nullableInputText(input, "notes"),
  };
  if (Object.keys(patch).length === 0) {
    throw new CliError(
      "EMPTY_FEEDBACK_UPDATE",
      "Feedback update input must contain at least one editable field.",
      CLI_EXIT_CODES.validation,
    );
  }
  return patch;
}

async function ensureExactSearch(
  context: CommandContext,
  records: PromptRecord[],
): Promise<void> {
  const health = inspectSearchIndex(context.searchIndexPath, records);
  if (!health.needsRebuild) return;
  await rebuildPromptSearchIndex(context.directory, context.searchIndexPath);
}

function requireFeature(
  statuses: FeatureStatus[],
  id: FeatureId,
  label: string,
): void {
  const feature = getFeatureStatus(statuses, id);
  if (feature.effectiveState === "disabled") {
    throw new CliError(
      "FEATURE_DISABLED",
      `${label} is Disabled${feature.reason ? `: ${feature.reason}` : "."}`,
      CLI_EXIT_CODES.disabled,
      { featureId: id, state: feature.effectiveState },
    );
  }
}

function providerFeature(
  provider: "openai" | "anthropic" | "google",
): FeatureId {
  if (provider === "anthropic") return "anthropic-provider";
  if (provider === "google") return "google-provider";
  return "openai-enhancement";
}

function selectedProviderKey(
  provider: "openai" | "anthropic" | "google",
  env: PromptStudioCliOptions["env"] = {},
): string {
  const name =
    provider === "anthropic"
      ? "ANTHROPIC_API_KEY"
      : provider === "google"
        ? "GEMINI_API_KEY"
        : "OPENAI_API_KEY";
  const value = env?.[name]?.trim();
  if (!value) {
    throw new CliError(
      "PROVIDER_KEY_REQUIRED",
      `Set ${name} in the current process environment. API keys are not accepted as command-line arguments.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return value;
}

function requireYes(parsed: ParsedArguments, action: string): void {
  if (parsed.options.has("yes")) return;
  throw new CliError(
    "CONFIRMATION_REQUIRED",
    `Re-run with --yes to ${action}. Nothing changed.`,
    CLI_EXIT_CODES.usage,
  );
}

function parseArguments(argv: readonly string[]): ParsedArguments {
  const positionals: string[] = [];
  const options = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token === "-j") {
      options.set("json", true);
      continue;
    }
    if (token === "-y") {
      options.set("yes", true);
      continue;
    }
    if (token === "-h") {
      options.set("help", true);
      continue;
    }
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const separator = token.indexOf("=");
    const name = token.slice(2, separator === -1 ? undefined : separator);
    if (!name) {
      throw new CliError(
        "INVALID_OPTION",
        `Invalid option: ${token}.`,
        CLI_EXIT_CODES.usage,
      );
    }
    if (options.has(name)) {
      throw new CliError(
        "DUPLICATE_OPTION",
        `Option --${name} was supplied more than once.`,
        CLI_EXIT_CODES.usage,
      );
    }
    if (separator !== -1) {
      options.set(name, token.slice(separator + 1));
      continue;
    }
    if (BOOLEAN_OPTIONS.has(name)) {
      options.set(name, true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliError(
        "OPTION_VALUE_REQUIRED",
        `Option --${name} requires a value.`,
        CLI_EXIT_CODES.usage,
      );
    }
    options.set(name, value);
    index += 1;
  }
  const command = positionals.shift();
  return { ...(command ? { command } : {}), positionals, options };
}

function assertKnownOptions(
  command: string,
  options: Map<string, string | true>,
): void {
  const allowed = COMMAND_OPTIONS[command]!;
  const unknown = [...options.keys()].filter(
    (name) => !GLOBAL_OPTIONS.has(name) && !allowed.has(name),
  );
  if (unknown.length > 0) {
    throw new CliError(
      "UNKNOWN_OPTION",
      `Unsupported option for ${command}: ${unknown.map((name) => `--${name}`).join(", ")}.`,
      CLI_EXIT_CODES.usage,
    );
  }
}

function assertPositionals(
  parsed: ParsedArguments,
  minimum: number,
  maximum: number,
): void {
  if (
    parsed.positionals.length < minimum ||
    parsed.positionals.length > maximum
  ) {
    throw new CliError(
      "INVALID_ARGUMENT_COUNT",
      `Expected ${minimum === maximum ? minimum : `${minimum}-${maximum}`} positional argument${maximum === 1 ? "" : "s"}; received ${parsed.positionals.length}.`,
      CLI_EXIT_CODES.usage,
    );
  }
}

function optionString(
  parsed: ParsedArguments,
  name: string,
): string | undefined {
  const value = parsed.options.get(name);
  return typeof value === "string" ? value : undefined;
}

function optionLimit(parsed: ParsedArguments, fallback: number): number {
  const raw = optionString(parsed, "limit");
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new CliError(
      "INVALID_LIMIT",
      "--limit must be an integer from 1 to 500.",
      CLI_EXIT_CODES.usage,
    );
  }
  return value;
}

function boundedIntegerOption(
  parsed: ParsedArguments,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const raw = optionString(parsed, name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new CliError(
      "INVALID_INTEGER_OPTION",
      `--${name} must be an integer from ${minimum} to ${maximum}.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return value;
}

function optionalTarget(value?: string): PromptTarget | undefined {
  if (!value) return undefined;
  if (value === "generic" || value === "codex" || value === "claude-code") {
    return value;
  }
  throw new CliError(
    "INVALID_TARGET",
    "Target must be generic, codex, or claude-code.",
    CLI_EXIT_CODES.usage,
  );
}

function targetValue(value: unknown, fallback: PromptTarget): PromptTarget {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new CliError(
      "INVALID_TARGET",
      "Target must be text.",
      CLI_EXIT_CODES.validation,
    );
  }
  return optionalTarget(value) ?? fallback;
}

function selectedProfileId(value: string): SelectableEnhancementProfileId {
  if (
    (SELECTABLE_ENHANCEMENT_PROFILE_IDS as readonly string[]).includes(value)
  ) {
    return value as SelectableEnhancementProfileId;
  }
  throw new CliError(
    "INVALID_PROFILE",
    `Unknown enhancement profile: ${value}.`,
    CLI_EXIT_CODES.usage,
  );
}

function optionalPath(value?: string, fallback?: string): string {
  const selected = value?.trim() || fallback;
  if (!selected) {
    throw new CliError(
      "PATH_REQUIRED",
      "An absolute or ~/ path is required.",
      CLI_EXIT_CODES.usage,
    );
  }
  const expanded =
    selected === "~"
      ? homedir()
      : selected.startsWith("~/")
        ? `${homedir()}/${selected.slice(2)}`
        : selected;
  if (!isAbsolute(expanded)) {
    throw new CliError(
      "INVALID_PATH",
      `Path must be absolute or start with ~/: ${selected}.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return resolve(expanded);
}

function commaTerms(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/,|\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CliError(
      "INVALID_STRING_ARRAY",
      "Expected a JSON array containing only text values.",
      CLI_EXIT_CODES.validation,
    );
  }
  return value.map((item) => String(item));
}

function stringValue(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new CliError(
      "INVALID_TEXT_VALUE",
      "Expected a text value.",
      CLI_EXIT_CODES.validation,
    );
  }
  return value;
}

function unknownString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function feedbackTargetAgent(value: unknown): FeedbackTargetAgent {
  if (
    value === "generic" ||
    value === "codex" ||
    value === "claude-code" ||
    value === "other"
  ) {
    return value;
  }
  throw new CliError(
    "INVALID_FEEDBACK_TARGET",
    "Feedback targetAgent must be generic, codex, claude-code, or other.",
    CLI_EXIT_CODES.validation,
  );
}

function feedbackVerdict(value: unknown): FeedbackVerdict {
  if (value === "not-rated" || value === "useful" || value === "not-useful") {
    return value;
  }
  throw new CliError(
    "INVALID_FEEDBACK_VERDICT",
    "Feedback verdict must be not-rated, useful, or not-useful.",
    CLI_EXIT_CODES.validation,
  );
}

function feedbackOutcomeStatus(value: unknown): FeedbackOutcomeStatus {
  if (
    value === "succeeded" ||
    value === "partial" ||
    value === "failed" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new CliError(
    "INVALID_FEEDBACK_OUTCOME",
    "Feedback outcomeStatus must be succeeded, partial, failed, or unknown.",
    CLI_EXIT_CODES.validation,
  );
}

function feedbackExportFormat(value: string): FeedbackExportFormat {
  if (value === "json" || value === "markdown") return value;
  throw new CliError(
    "INVALID_FEEDBACK_FORMAT",
    "Feedback export format must be json or markdown.",
    CLI_EXIT_CODES.usage,
  );
}

function optionalFeedbackOutcome(
  input: Record<string, unknown>,
): Pick<PromptUseFeedbackDraft, "outcomeStatus" | "outcomeSummary"> {
  return {
    ...(input.outcomeStatus === undefined
      ? {}
      : { outcomeStatus: feedbackOutcomeStatus(input.outcomeStatus) }),
    ...optionalInputText(input, "outcomeSummary"),
  };
}

function optionalInputText<K extends string>(
  input: Record<string, unknown>,
  key: K,
  fallback?: string,
): { [P in K]?: string } {
  const value = input[key];
  if (value === undefined) {
    return fallback ? ({ [key]: fallback } as { [P in K]: string }) : {};
  }
  return { [key]: inputText(value, key) } as { [P in K]: string };
}

function nullableInputText<K extends string>(
  input: Record<string, unknown>,
  key: K,
): { [P in K]?: string | null } {
  const value = input[key];
  if (value === undefined) return {};
  if (value === null) return { [key]: null } as { [P in K]: null };
  return { [key]: inputText(value, key) } as { [P in K]: string };
}

function inputText(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new CliError(
      "INVALID_FEEDBACK_TEXT",
      `${field} must be text.`,
      CLI_EXIT_CODES.validation,
    );
  }
  return value;
}

function optionalInputNumber<K extends string>(
  input: Record<string, unknown>,
  key: K,
): { [P in K]?: number } {
  const value = input[key];
  if (value === undefined) return {};
  if (typeof value !== "number") {
    throw new CliError(
      "INVALID_FEEDBACK_NUMBER",
      `${key} must be a number.`,
      CLI_EXIT_CODES.validation,
    );
  }
  return { [key]: value } as { [P in K]: number };
}

function nullableInputNumber<K extends string>(
  input: Record<string, unknown>,
  key: K,
): { [P in K]?: number | null } {
  const value = input[key];
  if (value === undefined) return {};
  if (value === null) return { [key]: null } as { [P in K]: null };
  if (typeof value !== "number") {
    throw new CliError(
      "INVALID_FEEDBACK_NUMBER",
      `${key} must be a number or null.`,
      CLI_EXIT_CODES.validation,
    );
  }
  return { [key]: value } as { [P in K]: number };
}

function assertInputKeys(
  input: Record<string, unknown>,
  operation: string,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new CliError(
      "UNKNOWN_INPUT_FIELD",
      `${operation} input contains unknown field: ${unknown}.`,
      CLI_EXIT_CODES.validation,
    );
  }
}

function feedbackPublicRecord(
  record: Awaited<ReturnType<typeof getPromptUseFeedback>>,
): Omit<typeof record, "filePath"> {
  const value = { ...record };
  delete (value as Partial<typeof record>).filePath;
  return value;
}

function feedbackHumanLine(
  record: Awaited<ReturnType<typeof getPromptUseFeedback>>,
): string {
  return `${record.id}  ${record.prompt.title}  [${record.verdict}]  ${record.use.usedAt}`;
}

async function optimizationFeedbackRecords(
  promptDirectory: string,
  feedbackIds: string[],
) {
  if (feedbackIds.length < 2) {
    throw new CliError(
      "INSUFFICIENT_OPTIMIZATION_EVIDENCE",
      "Select at least two feedback record identifiers.",
      CLI_EXIT_CODES.validation,
    );
  }
  const records = [];
  for (const id of feedbackIds) {
    records.push(await getPromptUseFeedback(promptDirectory, id));
  }
  return records;
}

function optimizationPublicProposal(
  proposal: Awaited<ReturnType<typeof getOptimizationProposal>>,
): Omit<typeof proposal, "filePath"> {
  const value = { ...proposal };
  delete (value as Partial<typeof proposal>).filePath;
  return value;
}

function requiredInputInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new CliError(
      "INVALID_INTEGER",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
      CLI_EXIT_CODES.validation,
    );
  }
  return value as number;
}

function requiredPositiveOption(parsed: ParsedArguments, name: string): number {
  const value = optionString(parsed, name);
  const number = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number <= 0) {
    throw new CliError(
      "INVALID_COST_LIMIT",
      `--${name} must be a positive USD amount.`,
      CLI_EXIT_CODES.usage,
    );
  }
  return number;
}

function recordSummary(record: PromptRecord): PromptRecordSummary {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    target: record.target,
    tags: record.tags,
    updatedAt: record.updatedAt,
    favorite: record.favorite,
    archived: Boolean(record.archivedAt),
    ...(record.project
      ? { project: { name: record.project.name, path: record.project.path } }
      : {}),
  };
}

function humanRecordLine(record: PromptRecord): string {
  return `${record.id}  ${record.title}  [${record.target}]${record.archivedAt ? "  archived" : ""}`;
}

function humanRecord(record: PromptRecord): string {
  const placeholders = extractPlaceholders(record.body);
  return [
    `# ${record.title}`,
    "",
    `ID: ${record.id}`,
    `Target: ${record.target}`,
    `Tags: ${record.tags.join(", ") || "(none)"}`,
    ...(placeholders.length
      ? [`Placeholders: ${placeholders.join(", ")}`]
      : []),
    `Updated: ${record.updatedAt}`,
    `Archived: ${record.archivedAt ?? "no"}`,
    "",
    record.body,
  ].join("\n");
}

function featureSummary(feature: FeatureStatus): Record<string, unknown> {
  return {
    id: feature.id,
    title: feature.title,
    requestedState: feature.requestedState,
    effectiveState: feature.effectiveState,
    ...(feature.reason ? { reason: feature.reason } : {}),
    ...(feature.verification
      ? { lastVerifiedAt: feature.verification.checkedAt }
      : {}),
  };
}

function execution(
  exitCode: number,
  json: boolean,
  command: string,
  data: unknown,
  human: string,
): PromptStudioCliExecution {
  return {
    exitCode,
    stdout: json
      ? `${JSON.stringify({ ok: exitCode === 0, command, data }, null, 2)}\n`
      : `${human.replace(/\s+$/, "")}\n`,
    stderr: "",
  };
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function helpText(): string {
  return `
Prompt Studio CLI

Usage:
  prompt-studio [global options] <command> [arguments] [options]

Commands:
  status                       Show activation state without touching disabled features
  list                         List prompt summaries
  search <query>               Search exact metadata and text; add --meaning for QMD
  get <id>                     Print one prompt
  copy <id>                    Copy one prompt body to the macOS clipboard
  create --input <file|->      Create from JSON; requires --yes
  update <id> --input <file|-> Update fields; requires --yes
  archive <id>                 Archive without deleting; requires --yes
  validate                     Validate every Markdown prompt file
  reindex                      Rebuild disposable exact search; requires --yes
  authorize-mcp <action> <digest>
                               Issue a five-minute one-time mutation token
  feedback <operation>         Add, list, get, update, delete, or export feedback
  optimization <operation>     Generate, evaluate, inspect, approve, or roll back proposals
  stats                        Show use counts, feedback tallies, zero-use prompts, and missed searches
  overlap                      Report near-duplicate active prompts; --threshold 0.2-0.95
  enhance                      Enhance rough thoughts; requires --yes

Global options:
  --json, -j                   Stable JSON envelope
  --library <absolute|~/>      Override the Markdown prompt directory
  --search-index <absolute|~/> Override the SQLite index
  --qmd-executable <path>      Override qmd executable discovery
  --feature-config <path>      Override feature state file
  --confirmation-dir <path>    Override one-time MCP confirmation storage
  --optimization-dir <path>    Override local optimization proposal storage
  --compiler-state <path>      Override accepted compiler and rollback history
  --help, -h                   Show this help

Mutation and external-action rules:
  create, update, archive, and reindex require --yes.
  enhance requires --yes before a provider call; add --save to persist the
  validated result. Provider keys are read only from OPENAI_API_KEY,
  ANTHROPIC_API_KEY, or GEMINI_API_KEY after activation and confirmation.
  API keys are never accepted as command-line options.
  feedback add, update, and delete require --yes. Feedback records stay local,
  preserve an immutable prompt-version snapshot, and never infer an outcome.
  optimization generation requires --yes, --max-cost, and OPENAI_API_KEY.
  Evaluation scores require completed human review. Approval requires --yes
  plus the exact candidate digest; protected-case regressions remain blocked.
`.trim();
}

function normalizeCliError(error: unknown): CliError {
  if (error instanceof CliError) return error;
  if (isObject(error) && error.name === "AbortError") {
    return new CliError(
      "CANCELLED",
      "Operation cancelled. No partial mutation was kept.",
      CLI_EXIT_CODES.cancelled,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/cancelled/i.test(message)) {
    return new CliError("CANCELLED", message, CLI_EXIT_CODES.cancelled);
  }
  return new CliError("OPERATION_FAILED", message, CLI_EXIT_CODES.operation);
}

class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    exitCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
