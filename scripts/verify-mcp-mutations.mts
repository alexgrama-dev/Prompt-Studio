import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const runExternal = promisify(execFile);
const requestedServerPath = process.argv[2] ?? "dist-mcp/prompt-studio.mjs";
const requestedCliPath = process.argv[3] ?? "dist-cli/cli/prompt-studio.mjs";
const serverPath = absolutePath(requestedServerPath);
const cliPath = absolutePath(requestedCliPath);
const root = await mkdtemp(join(tmpdir(), "prompt-studio-mcp-mutations-"));
const library = join(root, "prompts");
const confirmationDirectory = join(root, "confirmations");
const audit = join(root, "audit.jsonl");
const featureConfig = join(root, "features.json");
const searchIndex = join(root, "search.sqlite");
const verification = {
  status: "passed",
  checkedAt: "2026-07-19T12:00:00.000Z",
  command: "pnpm check",
};
const activeBeforeMutations = [
  "sqlite-search",
  "qmd-discovery",
  "openai-enhancement",
  "project-context",
  "context7-research",
  "web-research",
  "exa-research",
  "github-mcp-research",
  "anthropic-provider",
  "google-provider",
  "local-cli",
  "mcp-read",
];
await writeFile(
  featureConfig,
  `${JSON.stringify(
    {
      ...Object.fromEntries(
        activeBeforeMutations.map((id) => [
          id,
          { state: "active", verification },
        ]),
      ),
      "mcp-write": { state: "active", verification },
      feedback: { state: "preview" },
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);

const child = spawn(process.execPath, [serverPath], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...definedEnvironment(),
    PROMPT_STUDIO_DISABLE_INDEX_SYNC: "1",
    PROMPT_STUDIO_LIBRARY_DIR: library,
    PROMPT_STUDIO_SEARCH_INDEX: searchIndex,
    PROMPT_STUDIO_MCP_AUDIT_LOG: audit,
    PROMPT_STUDIO_FEATURE_CONFIG: featureConfig,
    PROMPT_STUDIO_MCP_CONFIRMATION_DIR: confirmationDirectory,
  },
});
const pending = new Map<
  number,
  {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }
>();
const stderr: Buffer[] = [];
const lines = createInterface({ input: child.stdout });

child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
child.once("error", (error) => rejectPending(error));
child.once("close", (code) => {
  if (code !== 0 && pending.size > 0) {
    rejectPending(
      new Error(
        `MCP server exited with ${String(code)}: ${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`,
      ),
    );
  }
});
lines.on("line", (line) => {
  let response: JsonRpcResponse;
  try {
    response = JSON.parse(line) as JsonRpcResponse;
  } catch {
    rejectPending(new Error("The MCP bundle wrote non-JSON data to stdout."));
    return;
  }
  if (typeof response.id !== "number") return;
  const waiter = pending.get(response.id);
  if (!waiter) return;
  pending.delete(response.id);
  waiter.resolve(response);
});

try {
  const initialized = await request(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: {
      name: "prompt-studio-mutation-bundle-probe",
      version: "0.1.0",
    },
  });
  assert.equal(initialized.result?.protocolVersion, "2025-11-25");
  notify("notifications/initialized", {});

  const tools = await request(2, "tools/list", {});
  const names = (
    (tools.result?.tools as Array<{ name: string }> | undefined) ?? []
  ).map((tool) => tool.name);
  assert.deepEqual(names, [
    "prompt_studio_status",
    "prompt_studio_list",
    "prompt_studio_search",
    "prompt_studio_get",
    "prompt_studio_create",
    "prompt_studio_update",
    "prompt_studio_archive",
    "prompt_studio_enhance",
    "prompt_studio_save_enhancement",
    "prompt_studio_record_feedback",
  ]);
  assert.equal(
    names.some((name) => /delete/i.test(name)),
    false,
  );

  const createArguments = {
    title: "Bundle Mutation Proof",
    body: "Verify the exact confirmation-bound MCP mutation flow.",
    target: "codex",
    tags: ["mcp", "verification"],
  };
  const requested = await request(3, "tools/call", {
    name: "prompt_studio_create",
    arguments: createArguments,
  });
  assert.equal(toolResult(requested).isError, true);
  const digest = confirmationDigest(toolText(requested));
  await assert.rejects(lstat(library), /ENOENT/);

  const authorization = await runExternal(
    process.execPath,
    [
      cliPath,
      "authorize-mcp",
      "create",
      digest,
      "--json",
      "--yes",
      "--feature-config",
      featureConfig,
      "--confirmation-dir",
      confirmationDirectory,
    ],
    { encoding: "utf8" },
  );
  const token = (
    JSON.parse(authorization.stdout) as {
      data: { token: string };
    }
  ).data.token;
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);

  const created = await request(4, "tools/call", {
    name: "prompt_studio_create",
    arguments: { ...createArguments, confirmationToken: token },
  });
  assert.notEqual(toolResult(created).isError, true);
  assert.equal(
    (await readdir(library)).filter((name) => name.endsWith(".md")).length,
    1,
  );

  const reused = await request(5, "tools/call", {
    name: "prompt_studio_create",
    arguments: { ...createArguments, confirmationToken: token },
  });
  assert.equal(toolResult(reused).isError, true);
  assert.match(toolText(reused), /CONFIRMATION_INVALID/);
  assert.deepEqual(await readdir(confirmationDirectory), []);
  assert.equal(
    (await readdir(library)).filter((name) => name.endsWith(".md")).length,
    1,
  );

  const promptId = (
    (toolResult(created).structuredContent as {
      data: { id: string };
    }) ?? { data: { id: "" } }
  ).data.id;
  const saveArguments = {
    historyId: "123e4567-e89b-12d3-a456-426614174000",
    contentDigest: "0".repeat(64),
  };
  const saveRequested = await request(6, "tools/call", {
    name: "prompt_studio_save_enhancement",
    arguments: saveArguments,
  });
  assert.equal(toolResult(saveRequested).isError, true);
  const saveDigest = confirmationDigest(toolText(saveRequested));
  const saveAuthorization = await runExternal(
    process.execPath,
    [
      cliPath,
      "authorize-mcp",
      "save-enhancement",
      saveDigest,
      "--json",
      "--yes",
      "--feature-config",
      featureConfig,
      "--confirmation-dir",
      confirmationDirectory,
    ],
    { encoding: "utf8" },
  );
  const saveToken = (
    JSON.parse(saveAuthorization.stdout) as {
      data: { token: string };
    }
  ).data.token;
  const missingHistory = await request(7, "tools/call", {
    name: "prompt_studio_save_enhancement",
    arguments: { ...saveArguments, confirmationToken: saveToken },
  });
  assert.equal(toolResult(missingHistory).isError, true);
  assert.match(toolText(missingHistory), /PROMPT_NOT_FOUND/);
  assert.deepEqual(await readdir(confirmationDirectory), []);
  assert.equal(
    (await readdir(library)).filter((name) => name.endsWith(".md")).length,
    1,
  );

  const retrieved = await request(8, "tools/call", {
    name: "prompt_studio_get",
    arguments: { id: promptId },
  });
  assert.notEqual(toolResult(retrieved).isError, true);
  const versionToken = (
    (toolResult(retrieved).structuredContent as {
      data: { versionToken: string };
    }) ?? { data: { versionToken: "" } }
  ).data.versionToken;
  assert.match(versionToken, /^v1:[a-f0-9]{64}$/);

  const feedbackRecorded = await request(9, "tools/call", {
    name: "prompt_studio_record_feedback",
    arguments: {
      id: promptId,
      versionToken,
      verdict: "useful",
      outcomeStatus: "succeeded",
      targetAgent: "claude-code",
      note: "Bundle probe outcome check.",
    },
  });
  assert.notEqual(toolResult(feedbackRecorded).isError, true);
  const feedbackFiles = (await readdir(join(library, ".feedback"))).filter(
    (name) => name.endsWith(".json"),
  );
  assert.equal(feedbackFiles.length, 1);

  const feedbackRejected = await request(10, "tools/call", {
    name: "prompt_studio_record_feedback",
    arguments: {
      id: promptId,
      versionToken,
      verdict: "amazing",
      outcomeStatus: "succeeded",
      targetAgent: "claude-code",
    },
  });
  assert.equal(toolResult(feedbackRejected).isError, true);
  assert.equal(
    (await readdir(join(library, ".feedback"))).filter((name) =>
      name.endsWith(".json"),
    ).length,
    1,
  );

  const auditText = await readFile(audit, "utf8");
  assert.equal(auditText.includes(createArguments.title), false);
  assert.equal(auditText.includes(createArguments.body), false);
  assert.equal(auditText.includes(token), false);
  assert.match(auditText, /"outcome":"authorized"/);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        serverPath,
        cliPath,
        protocolVersion: initialized.result?.protocolVersion,
        tools: names,
        deleteExposed: false,
        confirmationRequired: true,
        exactRequestAuthorized: true,
        tokenReused: false,
        reviewedEnhancementSaveGated: true,
        promptCount: 1,
        agentFeedbackRecorded: true,
        invalidFeedbackRejected: true,
        privacySafeAudit: true,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  lines.close();
  child.stdin.end();
  await waitForExit(child);
  await rm(root, { recursive: true, force: true });
}

function absolutePath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function request(
  id: number,
  method: string,
  params: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const response = new Promise<JsonRpcResponse>((resolveResponse, reject) => {
    pending.set(id, { resolve: resolveResponse, reject });
  });
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
  );
  return withTimeout(response, 5_000);
}

function notify(method: string, params: Record<string, unknown>): void {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function toolResult(response: JsonRpcResponse): {
  isError?: boolean;
  content?: unknown;
  structuredContent?: unknown;
} {
  return (response.result ?? {}) as {
    isError?: boolean;
    content?: unknown;
    structuredContent?: unknown;
  };
}

function toolText(response: JsonRpcResponse): string {
  const content = toolResult(response).content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((block) =>
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("\n");
}

function confirmationDigest(text: string): string {
  const match = /Request digest: ([a-f0-9]{64})/.exec(text);
  assert.ok(match?.[1], "Mutation response did not include a request digest.");
  return match[1];
}

function rejectPending(error: Error): void {
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Timed out waiting for MCP response.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForExit(
  processToWaitFor: ReturnType<typeof spawn>,
): Promise<void> {
  if (processToWaitFor.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolveExit) => {
      processToWaitFor.once("close", () => resolveExit());
    }),
    new Promise<void>((resolveTimeout) => {
      setTimeout(() => {
        processToWaitFor.kill("SIGTERM");
        resolveTimeout();
      }, 2_000);
    }),
  ]);
}

function definedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  );
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
  };
}
