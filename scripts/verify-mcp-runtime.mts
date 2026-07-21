import assert from "node:assert/strict";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

const requestedPath = process.argv[2] ?? "dist-mcp/prompt-studio.mjs";
const serverPath = isAbsolute(requestedPath)
  ? requestedPath
  : resolve(process.cwd(), requestedPath);
const root = await mkdtemp(join(tmpdir(), "prompt-studio-mcp-runtime-"));
const library = join(root, "must-not-exist");
const index = join(root, "must-not-exist.sqlite");
const audit = join(root, "must-not-exist-audit.jsonl");
const featureConfig = join(root, "must-not-exist-features.json");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: process.cwd(),
  env: {
    ...definedEnvironment(),
    PROMPT_STUDIO_LIBRARY_DIR: library,
    PROMPT_STUDIO_SEARCH_INDEX: index,
    PROMPT_STUDIO_MCP_AUDIT_LOG: audit,
    PROMPT_STUDIO_FEATURE_CONFIG: featureConfig,
  },
});
const client = new Client({
  name: "prompt-studio-runtime-probe",
  version: "0.1.0",
});

try {
  await client.connect(transport);
  const tools = await client.request(
    { method: "tools/list", params: {} },
    ListToolsResultSchema,
  );
  assert.deepEqual(
    tools.tools.map((tool) => tool.name),
    [
      "prompt_studio_status",
      "prompt_studio_list",
      "prompt_studio_search",
      "prompt_studio_get",
    ],
  );
  const status = await client.request(
    {
      method: "tools/call",
      params: { name: "prompt_studio_status", arguments: {} },
    },
    CallToolResultSchema,
  );
  assert.notEqual(status.isError, true);
  const statusData = (
    status.structuredContent as {
      data: Record<string, unknown>;
    }
  ).data;
  assert.equal(statusData.state, "disabled");
  assert.equal(statusData.dataRead, false);

  const list = await client.request(
    {
      method: "tools/call",
      params: { name: "prompt_studio_list", arguments: {} },
    },
    CallToolResultSchema,
  );
  assert.equal(list.isError, true);
  assert.match(JSON.stringify(list.content), /FEATURE_DISABLED/);
  await assert.rejects(lstat(library), /ENOENT/);
  await assert.rejects(lstat(index), /ENOENT/);
  await assert.rejects(lstat(audit), /ENOENT/);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        serverPath,
        tools: tools.tools.map((tool) => tool.name),
        disabledStatusReadData: statusData.dataRead,
        disabledListRejected: true,
        filesCreated: false,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await client.close();
  await rm(root, { recursive: true, force: true });
}

function definedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]],
    ),
  );
}
