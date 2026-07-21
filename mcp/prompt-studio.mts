#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import {
  featureConfigPath,
  getFeatureStatus,
  loadFeatureStatuses,
} from "../src/core/features.ts";
import { defaultMcpConfirmationDirectory } from "../src/core/mcp-confirmation.ts";
import {
  createFileMcpAuditWriter,
  defaultMcpAuditLogPath,
} from "../src/core/mcp-read.ts";
import { resolvePromptDirectory } from "../src/core/prompt-store.ts";
import { defaultSearchIndexPath } from "../src/core/search-index.ts";
import { createPromptStudioMcpServer } from "./server.mts";

const featurePath = resolveConfiguredPath(
  process.env.PROMPT_STUDIO_FEATURE_CONFIG,
  featureConfigPath(),
);
const directory = resolvePromptDirectory(process.env.PROMPT_STUDIO_LIBRARY_DIR);
const audit = createFileMcpAuditWriter(
  resolveConfiguredPath(
    process.env.PROMPT_STUDIO_MCP_AUDIT_LOG,
    defaultMcpAuditLogPath(),
  ),
);
const loadStatuses = () => loadFeatureStatuses(featurePath);
const initialStatuses = await loadStatuses();
const mutationEnabled =
  getFeatureStatus(initialStatuses, "mcp-write").effectiveState !== "disabled";
const server = createPromptStudioMcpServer(
  {
    directory,
    searchIndexPath: resolveConfiguredPath(
      process.env.PROMPT_STUDIO_SEARCH_INDEX,
      defaultSearchIndexPath(),
    ),
    loadStatuses,
    audit,
    mutationToolsEnabled: mutationEnabled,
  },
  mutationEnabled
    ? {
        directory,
        confirmationDirectory: resolveConfiguredPath(
          process.env.PROMPT_STUDIO_MCP_CONFIRMATION_DIR,
          defaultMcpConfirmationDirectory(),
        ),
        loadStatuses,
        audit,
        env: process.env,
      }
    : undefined,
);

const transport = new StdioServerTransport();
let shuttingDown = false;

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
process.stdin.once("end", shutdown);

await server.connect(transport);

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  void server.close().finally(() => {
    process.stdin.pause();
    process.exitCode = 0;
  });
}

function resolveConfiguredPath(
  configured: string | undefined,
  fallback: string,
): string {
  const selected = configured?.trim() || fallback;
  const expanded =
    selected === "~"
      ? homedir()
      : selected.startsWith("~/")
        ? `${homedir()}/${selected.slice(2)}`
        : selected;
  if (!isAbsolute(expanded)) {
    throw new Error(
      "Prompt Studio MCP paths must be absolute or start with ~/.",
    );
  }
  return resolve(expanded);
}
