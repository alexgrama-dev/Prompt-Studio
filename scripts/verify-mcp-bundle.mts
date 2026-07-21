import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";

const requestedPath = process.argv[2] ?? "dist-mcp/prompt-studio.mjs";
const serverPath = isAbsolute(requestedPath)
  ? requestedPath
  : resolve(process.cwd(), requestedPath);
const root = await mkdtemp(join(tmpdir(), "prompt-studio-mcp-bundle-"));
const library = join(root, "must-not-exist");
const index = join(root, "must-not-exist.sqlite");
const audit = join(root, "must-not-exist-audit.jsonl");
const featureConfig = join(root, "must-not-exist-features.json");
const child = spawn(process.execPath, [serverPath], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...definedEnvironment(),
    PROMPT_STUDIO_LIBRARY_DIR: library,
    PROMPT_STUDIO_SEARCH_INDEX: index,
    PROMPT_STUDIO_MCP_AUDIT_LOG: audit,
    PROMPT_STUDIO_FEATURE_CONFIG: featureConfig,
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
      name: "prompt-studio-raw-bundle-probe",
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
  ]);

  const status = await request(3, "tools/call", {
    name: "prompt_studio_status",
    arguments: {},
  });
  const statusResult = status.result as
    | {
        isError?: boolean;
        structuredContent?: {
          data?: Record<string, unknown>;
        };
      }
    | undefined;
  assert.notEqual(statusResult?.isError, true);
  assert.equal(statusResult?.structuredContent?.data?.state, "disabled");
  assert.equal(statusResult?.structuredContent?.data?.dataRead, false);

  const list = await request(4, "tools/call", {
    name: "prompt_studio_list",
    arguments: {},
  });
  assert.equal(
    (list.result as { isError?: boolean } | undefined)?.isError,
    true,
  );
  assert.match(JSON.stringify(list.result), /FEATURE_DISABLED/);
  await assert.rejects(lstat(library), /ENOENT/);
  await assert.rejects(lstat(index), /ENOENT/);
  await assert.rejects(lstat(audit), /ENOENT/);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        serverPath,
        protocolVersion: initialized.result?.protocolVersion,
        tools: names,
        disabledStatusReadData: statusResult?.structuredContent?.data?.dataRead,
        disabledListRejected: true,
        filesCreated: false,
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
