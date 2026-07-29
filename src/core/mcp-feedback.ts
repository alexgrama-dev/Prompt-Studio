import {
  createPromptUseFeedback,
  FEEDBACK_OUTCOME_STATUSES,
  FEEDBACK_TARGET_AGENTS,
  FEEDBACK_VERDICTS,
  type FeedbackOutcomeStatus,
  type FeedbackTargetAgent,
  type FeedbackVerdict,
} from "./feedback-store.ts";
import { getFeatureStatus, type FeatureStatus } from "./features.ts";
import type { McpAuditWriter } from "./mcp-read.ts";
import {
  listPromptVersions,
  listPromptsReadOnly,
} from "./prompt-store.ts";
import {
  resolvePromptVersion,
  validPromptVersionToken,
} from "./prompt-version.ts";

export const MCP_FEEDBACK_TOOL_NAME = "prompt_studio_record_feedback" as const;

export const MCP_FEEDBACK_LIMITS = {
  noteCharacters: 1_000,
  recordsPerHour: 30,
} as const;

export interface PromptStudioMcpFeedbackOptions {
  directory: string;
  loadStatuses: () => Promise<FeatureStatus[]>;
  audit: McpAuditWriter;
  now?: () => Date;
  recordsPerHour?: number;
}

export interface McpFeedbackExecution {
  ok: boolean;
  tool: typeof MCP_FEEDBACK_TOOL_NAME;
  text: string;
  data?: Record<string, unknown>;
  code?: string;
}

// ponytail: per-options in-memory rate window; a restarted server resets it,
// which is acceptable because the cap only throttles runaway agents.
const rateWindows = new WeakMap<PromptStudioMcpFeedbackOptions, number[]>();

export async function executePromptStudioFeedbackTool(
  rawArguments: unknown,
  options: PromptStudioMcpFeedbackOptions,
  signal?: AbortSignal,
): Promise<McpFeedbackExecution> {
  const startedAt = Date.now();
  const now = () => options.now?.() ?? new Date();
  let featureEnabled = false;
  try {
    const statuses = await options.loadStatuses();
    const feature = getFeatureStatus(statuses, "feedback");
    if (feature.effectiveState === "disabled") {
      throw new FeedbackToolError(
        "FEATURE_DISABLED",
        `Outcome Feedback is Disabled${feature.reason ? `: ${feature.reason}` : "."}`,
      );
    }
    featureEnabled = true;
    throwIfAborted(signal);

    const args = objectArguments(rawArguments, [
      "id",
      "versionToken",
      "verdict",
      "outcomeStatus",
      "targetAgent",
      "note",
    ]);
    const id = selector(args.id);
    const versionToken = promptVersionArgument(args.versionToken);
    const verdict = enumeration(args.verdict, "verdict", FEEDBACK_VERDICTS);
    const outcomeStatus = enumeration(
      args.outcomeStatus,
      "outcomeStatus",
      FEEDBACK_OUTCOME_STATUSES,
    );
    const targetAgent = enumeration(
      args.targetAgent,
      "targetAgent",
      FEEDBACK_TARGET_AGENTS,
    );
    const note = optionalNote(args.note);

    const cap = options.recordsPerHour ?? MCP_FEEDBACK_LIMITS.recordsPerHour;
    const window = (rateWindows.get(options) ?? []).filter(
      (stamp) => now().getTime() - stamp < 3_600_000,
    );
    if (window.length >= cap) {
      throw new FeedbackToolError(
        "RATE_LIMITED",
        `At most ${cap} feedback records may be written per server hour. Wait or use the CLI.`,
      );
    }

    const library = await listPromptsReadOnly(options.directory);
    const exact = library.records.find((record) => record.id === id);
    const matches = exact
      ? [exact]
      : library.records.filter((record) => record.id.startsWith(id));
    if (matches.length !== 1) {
      throw new FeedbackToolError(
        "PROMPT_NOT_FOUND",
        matches.length > 1
          ? "Prompt identifier is ambiguous."
          : "Prompt was not found.",
      );
    }
    const record = matches[0]!;
    if (record.archivedAt) {
      throw new FeedbackToolError(
        "PROMPT_ARCHIVED",
        "Feedback is recorded only for active prompts.",
      );
    }
    const version = resolvePromptVersion(
      [record, ...(await listPromptVersions(options.directory, record.id))],
      versionToken,
    );
    if (!version) {
      throw new FeedbackToolError(
        "PROMPT_VERSION_MISMATCH",
        "The version token does not match an available current or historical prompt version. Retrieve the prompt again before recording feedback.",
      );
    }
    throwIfAborted(signal);

    const stored = await createPromptUseFeedback(
      options.directory,
      {
        prompt: version,
        targetAgent,
        verdict,
        outcomeStatus,
        ...(note ? { notes: note } : {}),
      },
      now(),
    );
    window.push(now().getTime());
    rateWindows.set(options, window);

    void options
      .audit({
        timestamp: now().toISOString(),
        tool: MCP_FEEDBACK_TOOL_NAME,
        outcome: "success",
        durationMs: Math.max(0, Date.now() - startedAt),
        resultCount: 1,
      })
      .catch(() => undefined);
    return {
      ok: true,
      tool: MCP_FEEDBACK_TOOL_NAME,
      data: {
        feedbackId: stored.id,
        promptId: version.id,
        promptUpdatedAt: stored.prompt.promptUpdatedAt,
        verdict,
        outcomeStatus,
      },
      text: `Recorded ${verdict} / ${outcomeStatus} feedback ${stored.id} for ${version.title}`,
    };
  } catch (error) {
    const failure =
      error instanceof FeedbackToolError
        ? error
        : new FeedbackToolError(
            /sensitive|secret/i.test(String(error))
              ? "SENSITIVE_CONTENT"
              : "FEEDBACK_FAILED",
            error instanceof Error ? error.message : String(error),
          );
    if (featureEnabled) {
      void options
        .audit({
          timestamp: now().toISOString(),
          tool: MCP_FEEDBACK_TOOL_NAME,
          outcome: "error",
          durationMs: Math.max(0, Date.now() - startedAt),
          errorCode: failure.code,
        })
        .catch(() => undefined);
    }
    return {
      ok: false,
      tool: MCP_FEEDBACK_TOOL_NAME,
      code: failure.code,
      text: `Error [${failure.code}]: ${failure.message}`,
    };
  }
}

class FeedbackToolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new FeedbackToolError("CANCELLED", "The call was cancelled.");
  }
}

function objectArguments(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FeedbackToolError(
      "INVALID_ARGUMENTS",
      "Tool arguments must be one object.",
    );
  }
  const object = value as Record<string, unknown>;
  const unknown = Object.keys(object).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new FeedbackToolError(
      "INVALID_ARGUMENTS",
      `Unknown tool argument: ${unknown}.`,
    );
  }
  return object;
}

function selector(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length < 8 ||
    value.trim().length > 64 ||
    !/^[a-f0-9-]+$/i.test(value.trim())
  ) {
    throw new FeedbackToolError(
      "INVALID_ARGUMENTS",
      "id must be a UUID or UUID prefix of at least 8 characters.",
    );
  }
  return value.trim();
}

function enumeration<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[],
): T {
  if (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  ) {
    return value as T;
  }
  throw new FeedbackToolError(
    "INVALID_ARGUMENTS",
    `${name} must be one of: ${allowed.join(", ")}.`,
  );
}

function promptVersionArgument(value: unknown): string {
  if (!validPromptVersionToken(value)) {
    throw new FeedbackToolError(
      "INVALID_ARGUMENTS",
      "versionToken must be the v1 token returned by prompt_studio_get.",
    );
  }
  return value;
}

function optionalNote(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > MCP_FEEDBACK_LIMITS.noteCharacters
  ) {
    throw new FeedbackToolError(
      "INVALID_ARGUMENTS",
      `note must contain 1-${MCP_FEEDBACK_LIMITS.noteCharacters} characters.`,
    );
  }
  return value.trim();
}

export type { FeedbackOutcomeStatus, FeedbackTargetAgent, FeedbackVerdict };
