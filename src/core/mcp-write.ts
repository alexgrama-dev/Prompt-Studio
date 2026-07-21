import {
  enhancementResultToPromptDraft,
  type EnhancementRequest,
  type EnhancementProvider,
} from "./enhancement.ts";
import {
  activeCompilerPolicyForStatuses,
  dispatchEnhancement,
  providerKeyFromEnvironment,
} from "./enhancement-dispatch.ts";
import {
  getFeatureStatus,
  type FeatureId,
  type FeatureStatus,
} from "./features.ts";
import {
  consumeMcpConfirmation,
  mcpMutationRequestDigest,
  type McpMutationAction,
} from "./mcp-confirmation.ts";
import {
  createPrompt,
  listPromptsReadOnly,
  updatePrompt,
  type PromptRecord,
  type PromptTarget,
} from "./prompt-store.ts";
import {
  getProviderEnhancementProfile,
  SELECTABLE_ENHANCEMENT_PROFILE_IDS,
  type SelectableEnhancementProfileId,
} from "./provider-profiles.ts";
import type { McpAuditWriter } from "./mcp-read.ts";
import { containsLikelySecret } from "./secrets.ts";

export const MCP_MUTATION_TOOL_NAMES = [
  "prompt_studio_create",
  "prompt_studio_update",
  "prompt_studio_archive",
  "prompt_studio_enhance",
] as const;

export type McpMutationToolName = (typeof MCP_MUTATION_TOOL_NAMES)[number];

export interface PromptStudioMcpMutationOptions {
  directory: string;
  confirmationDirectory: string;
  loadStatuses: () => Promise<FeatureStatus[]>;
  audit: McpAuditWriter;
  env?: Readonly<Record<string, string | undefined>>;
  providerFetchers?: Partial<Record<EnhancementProvider, typeof fetch>>;
  compilerStatePath?: string;
  now?: () => Date;
}

export interface McpMutationExecution {
  ok: boolean;
  tool: McpMutationToolName;
  text: string;
  data?: Record<string, unknown>;
  code?: string;
}

export async function executePromptStudioMutationTool(
  tool: McpMutationToolName,
  rawArguments: unknown,
  options: PromptStudioMcpMutationOptions,
  signal?: AbortSignal,
): Promise<McpMutationExecution> {
  const startedAt = Date.now();
  let featureEnabled = false;
  try {
    const statuses = await options.loadStatuses();
    requireFeature(statuses, "mcp-write", "MCP Mutations");
    featureEnabled = true;
    throwIfAborted(signal);
    const prepared = prepareMutation(tool, rawArguments, statuses, options);
    if (!prepared.confirmationToken) {
      await requiredAudit(options, {
        timestamp: (options.now?.() ?? new Date()).toISOString(),
        tool,
        outcome: "error",
        durationMs: Math.max(0, Date.now() - startedAt),
        errorCode: "CONFIRMATION_REQUIRED",
      });
      return mutationFailure(
        tool,
        "CONFIRMATION_REQUIRED",
        [
          `Review this ${prepared.action} request in the MCP client.`,
          `Request digest: ${prepared.requestDigest}`,
          `Authorize for five minutes with: prompt-studio authorize-mcp ${prepared.action} ${prepared.requestDigest} --yes`,
          "Then repeat the identical tool call with the returned confirmationToken.",
        ].join("\n"),
      );
    }
    await consumeMcpConfirmation(
      options.confirmationDirectory,
      prepared.confirmationToken,
      prepared.action,
      prepared.requestDigest,
      options.now?.() ?? new Date(),
    );
    throwIfAborted(signal);
    await requiredAudit(options, {
      timestamp: (options.now?.() ?? new Date()).toISOString(),
      tool,
      outcome: "authorized",
      durationMs: Math.max(0, Date.now() - startedAt),
    });
    const result = await prepared.run(signal);
    void options
      .audit({
        timestamp: (options.now?.() ?? new Date()).toISOString(),
        tool,
        outcome: "success",
        durationMs: Math.max(0, Date.now() - startedAt),
        resultCount: 1,
      })
      .catch(() => undefined);
    return result;
  } catch (error) {
    const message = safeMutationError(error);
    if (featureEnabled && message.code !== "AUDIT_UNAVAILABLE") {
      void options
        .audit({
          timestamp: (options.now?.() ?? new Date()).toISOString(),
          tool,
          outcome: "error",
          durationMs: Math.max(0, Date.now() - startedAt),
          errorCode: message.code,
        })
        .catch(() => undefined);
    }
    return mutationFailure(tool, message.code, message.message);
  }
}

function prepareMutation(
  tool: McpMutationToolName,
  rawArguments: unknown,
  statuses: FeatureStatus[],
  options: PromptStudioMcpMutationOptions,
): {
  action: McpMutationAction;
  requestDigest: string;
  confirmationToken?: string;
  run: (signal?: AbortSignal) => Promise<McpMutationExecution>;
} {
  if (tool === "prompt_studio_create") {
    const args = objectArguments(rawArguments, [
      "title",
      "summary",
      "body",
      "target",
      "tags",
      "aliases",
      "searchTerms",
      "confirmationToken",
    ]);
    const payload = {
      title: text(args.title, "title", 1, 200),
      ...(args.summary === undefined
        ? {}
        : { summary: text(args.summary, "summary", 1, 500) }),
      body: text(args.body, "body", 1, 100_000),
      target: target(args.target),
      tags: stringArray(args.tags, "tags", 50, 80),
      aliases: stringArray(args.aliases, "aliases", 50, 160),
      searchTerms: stringArray(args.searchTerms, "searchTerms", 100, 200),
    };
    rejectSensitivePayload(payload);
    const confirmationToken = token(args.confirmationToken);
    return {
      action: "create",
      requestDigest: mcpMutationRequestDigest("create", payload),
      ...(confirmationToken ? { confirmationToken } : {}),
      run: async () => {
        const record = await createPrompt(options.directory, payload);
        return mutationSuccess(
          tool,
          recordResult(record),
          `Created ${record.id}  ${record.title}`,
        );
      },
    };
  }
  if (tool === "prompt_studio_update") {
    const args = objectArguments(rawArguments, [
      "id",
      "title",
      "summary",
      "body",
      "target",
      "tags",
      "aliases",
      "searchTerms",
      "favorite",
      "unarchive",
      "confirmationToken",
    ]);
    const id = selector(args.id);
    const patch: Record<string, unknown> = {
      ...(args.title === undefined
        ? {}
        : { title: text(args.title, "title", 1, 200) }),
      ...(args.summary === undefined
        ? {}
        : { summary: text(args.summary, "summary", 1, 500) }),
      ...(args.body === undefined
        ? {}
        : { body: text(args.body, "body", 1, 100_000) }),
      ...(args.target === undefined ? {} : { target: target(args.target) }),
      ...(args.tags === undefined
        ? {}
        : { tags: stringArray(args.tags, "tags", 50, 80) }),
      ...(args.aliases === undefined
        ? {}
        : { aliases: stringArray(args.aliases, "aliases", 50, 160) }),
      ...(args.searchTerms === undefined
        ? {}
        : {
            searchTerms: stringArray(args.searchTerms, "searchTerms", 100, 200),
          }),
      ...(args.favorite === undefined
        ? {}
        : { favorite: boolean(args.favorite, "favorite") }),
      ...(args.unarchive === true ? { archived: false } : {}),
    };
    if (Object.keys(patch).length === 0)
      throw new Error("Update requires at least one changed field.");
    const payload = { id, ...patch };
    rejectSensitivePayload(payload);
    const confirmationToken = token(args.confirmationToken);
    return {
      action: "update",
      requestDigest: mcpMutationRequestDigest("update", payload),
      ...(confirmationToken ? { confirmationToken } : {}),
      run: async () => {
        const current = await selectedRecord(options.directory, id);
        rejectSensitiveRecord(current);
        const record = await updatePrompt(options.directory, current.id, {
          title: typeof patch.title === "string" ? patch.title : current.title,
          summary:
            typeof patch.summary === "string" ? patch.summary : current.summary,
          body: typeof patch.body === "string" ? patch.body : current.body,
          target: (patch.target as PromptTarget | undefined) ?? current.target,
          tags: (patch.tags as string[] | undefined) ?? current.tags,
          aliases: (patch.aliases as string[] | undefined) ?? current.aliases,
          searchTerms:
            (patch.searchTerms as string[] | undefined) ?? current.searchTerms,
          ...(typeof patch.favorite === "boolean"
            ? { favorite: patch.favorite }
            : {}),
          ...(patch.archived === false ? { archived: false } : {}),
        });
        return mutationSuccess(
          tool,
          recordResult(record),
          `Updated ${record.id}  ${record.title}`,
        );
      },
    };
  }
  if (tool === "prompt_studio_archive") {
    const args = objectArguments(rawArguments, ["id", "confirmationToken"]);
    const id = selector(args.id);
    const payload = { id };
    const confirmationToken = token(args.confirmationToken);
    return {
      action: "archive",
      requestDigest: mcpMutationRequestDigest("archive", payload),
      ...(confirmationToken ? { confirmationToken } : {}),
      run: async () => {
        const current = await selectedRecord(options.directory, id);
        rejectSensitiveRecord(current);
        const record = await updatePrompt(options.directory, current.id, {
          title: current.title,
          summary: current.summary,
          body: current.body,
          target: current.target,
          tags: current.tags,
          aliases: current.aliases,
          searchTerms: current.searchTerms,
          archived: true,
        });
        return mutationSuccess(
          tool,
          { id: record.id, archivedAt: record.archivedAt },
          `Archived ${record.id}  ${record.title}`,
        );
      },
    };
  }

  const args = objectArguments(rawArguments, [
    "roughThoughts",
    "target",
    "profile",
    "oneRunInstruction",
    "save",
    "confirmationToken",
  ]);
  const profileId = profile(args.profile);
  const selectedProfile = getProviderEnhancementProfile(profileId);
  requireFeature(
    statuses,
    providerFeature(selectedProfile.provider),
    `${selectedProfile.provider} Provider`,
  );
  const payload = {
    roughThoughts: text(args.roughThoughts, "roughThoughts", 1, 20_000),
    target: target(args.target),
    profile: profileId,
    ...(args.oneRunInstruction === undefined
      ? {}
      : {
          oneRunInstruction: text(
            args.oneRunInstruction,
            "oneRunInstruction",
            1,
            1_000,
          ),
        }),
    save: boolean(args.save, "save", false),
  };
  rejectSensitivePayload(payload);
  const confirmationToken = token(args.confirmationToken);
  return {
    action: "enhance",
    requestDigest: mcpMutationRequestDigest("enhance", payload),
    ...(confirmationToken ? { confirmationToken } : {}),
    run: async (runSignal) => {
      const key = providerKeyFromEnvironment(
        selectedProfile.provider,
        options.env,
      );
      const request: EnhancementRequest = {
        roughThoughts: payload.roughThoughts,
        target: payload.target,
        profileId,
        researchLevel: "none",
        ...(payload.oneRunInstruction
          ? { oneRunInstruction: payload.oneRunInstruction }
          : {}),
      };
      const compilerPolicy = await activeCompilerPolicyForStatuses(
        statuses,
        options.compilerStatePath,
      );
      const run = await dispatchEnhancement(request, {
        apiKey: key.value,
        ...(runSignal ? { signal: runSignal } : {}),
        ...(options.providerFetchers
          ? { fetchers: options.providerFetchers }
          : {}),
        ...(compilerPolicy ? { compilerPolicy } : {}),
      });
      rejectSensitivePayload(run.result);
      const saved = payload.save
        ? await createPrompt(
            options.directory,
            enhancementResultToPromptDraft(run, request),
          )
        : undefined;
      return mutationSuccess(
        tool,
        {
          run,
          saved: saved ? recordResult(saved) : null,
        },
        `${run.result.enhancedPrompt}\n\n${saved ? `Saved ${saved.id}` : "Validated result was not saved."}`,
      );
    },
  };
}

async function selectedRecord(
  directory: string,
  id: string,
): Promise<PromptRecord> {
  const library = await listPromptsReadOnly(directory);
  const exact = library.records.find((record) => record.id === id);
  if (exact) return exact;
  const matches = library.records.filter((record) => record.id.startsWith(id));
  if (matches.length === 1) return matches[0]!;
  throw new Error(
    matches.length > 1
      ? "Prompt identifier is ambiguous."
      : "Prompt was not found.",
  );
}

function requireFeature(
  statuses: FeatureStatus[],
  id: FeatureId,
  label: string,
): void {
  const feature = getFeatureStatus(statuses, id);
  if (feature.effectiveState === "disabled") {
    throw new Error(
      `${label} is Disabled${feature.reason ? `: ${feature.reason}` : "."}`,
    );
  }
}

function providerFeature(provider: EnhancementProvider): FeatureId {
  if (provider === "anthropic") return "anthropic-provider";
  if (provider === "google") return "google-provider";
  return "openai-enhancement";
}

function objectArguments(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Tool arguments must be one object.");
  }
  const object = value as Record<string, unknown>;
  const unknown = Object.keys(object).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown tool argument: ${unknown}.`);
  return object;
}

function text(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${name} must contain ${minimum}-${maximum} characters.`);
  }
  return normalized;
}

function stringArray(
  value: unknown,
  name: string,
  maximum: number,
  itemMaximum: number,
): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        item.trim().length > itemMaximum,
    )
  ) {
    throw new Error(
      `${name} must be an array of at most ${maximum} text values.`,
    );
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function boolean(value: unknown, name: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean")
    throw new Error(`${name} must be true or false.`);
  return value;
}

function target(value: unknown): PromptTarget {
  if (value === "generic" || value === "codex" || value === "claude-code")
    return value;
  throw new Error("target must be generic, codex, or claude-code.");
}

function profile(value: unknown): SelectableEnhancementProfileId {
  const selected = value ?? "openai-standard-v1";
  if (
    typeof selected === "string" &&
    (SELECTABLE_ENHANCEMENT_PROFILE_IDS as readonly string[]).includes(selected)
  ) {
    return selected as SelectableEnhancementProfileId;
  }
  throw new Error("profile is not a supported enhancement profile.");
}

function selector(value: unknown): string {
  const selected = text(value, "id", 8, 64);
  if (!/^[a-f0-9-]+$/i.test(selected))
    throw new Error("id must be a UUID or UUID prefix.");
  return selected;
}

function token(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return text(value, "confirmationToken", 32, 32);
}

function recordResult(record: PromptRecord): Record<string, unknown> {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    target: record.target,
    tags: record.tags,
    updatedAt: record.updatedAt,
    archived: Boolean(record.archivedAt),
  };
}

function mutationSuccess(
  tool: McpMutationToolName,
  data: Record<string, unknown>,
  textValue: string,
): McpMutationExecution {
  return { ok: true, tool, data, text: textValue.slice(0, 28_000) };
}

function mutationFailure(
  tool: McpMutationToolName,
  code: string,
  message: string,
): McpMutationExecution {
  return { ok: false, tool, code, text: `Error [${code}]: ${message}` };
}

function safeMutationError(error: unknown): { code: string; message: string } {
  if (error instanceof McpMutationError) {
    return { code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/Disabled/.test(message)) return { code: "FEATURE_DISABLED", message };
  if (/confirmation token/i.test(message))
    return { code: "CONFIRMATION_INVALID", message };
  if (/cancel/i.test(message))
    return { code: "CANCELLED", message: "The mutation was cancelled." };
  if (/not found/i.test(message)) return { code: "PROMPT_NOT_FOUND", message };
  if (/Set (OPENAI|ANTHROPIC|GEMINI)_API_KEY/.test(message)) {
    return { code: "PROVIDER_KEY_MISSING", message };
  }
  if (
    /must |requires |supported enhancement profile|Unknown tool argument/.test(
      message,
    )
  ) {
    return { code: "INVALID_ARGUMENTS", message };
  }
  return {
    code: "MUTATION_FAILED",
    message: "The mutation failed without a partial prompt write.",
  };
}

async function requiredAudit(
  options: PromptStudioMcpMutationOptions,
  event: Parameters<McpAuditWriter>[0],
): Promise<void> {
  try {
    await options.audit(event);
  } catch {
    throw new McpMutationError(
      "AUDIT_UNAVAILABLE",
      "The privacy-safe MCP audit log is unavailable, so the mutation was not performed.",
    );
  }
}

function rejectSensitivePayload(value: unknown): void {
  if (containsLikelySecret(JSON.stringify(value))) {
    throw new McpMutationError(
      "SENSITIVE_INPUT",
      "The mutation content appears to contain a secret. Replace it with a placeholder and keep the secret outside Prompt Studio.",
    );
  }
}

function rejectSensitiveRecord(record: PromptRecord): void {
  rejectSensitivePayload({
    title: record.title,
    summary: record.summary,
    body: record.body,
    tags: record.tags,
    aliases: record.aliases,
    searchTerms: record.searchTerms,
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Mutation cancelled.");
}

class McpMutationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "McpMutationError";
    this.code = code;
  }
}
