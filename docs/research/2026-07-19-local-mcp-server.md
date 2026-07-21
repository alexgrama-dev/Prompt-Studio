# Local MCP Server Research

Date: 2026-07-19

## Decision

Use the official Model Context Protocol TypeScript SDK 1.29.0 with Zod 4.4.3,
then bundle the server with esbuild 0.28.1 on the Mac Mini. The MacBook receives
one executable JavaScript file and needs neither those packages nor the Mini at
runtime.

Activation 12 exposes four local read-only tools:

- `prompt_studio_status`
- `prompt_studio_list`
- `prompt_studio_search`
- `prompt_studio_get`

Mutation tools remain a separate Activation 13.

## Why the official SDK

The stable SDK provides the protocol handshake, standard-input/output
transport, strict tool input schemas, structured output, tool annotations,
request cancellation signals, and consistent protocol errors. Reimplementing
JSON-RPC framing locally would remove a dependency but increase compatibility
risk in the part most likely to change.

The exact versions were checked against the package registry on 2026-07-19:

- `@modelcontextprotocol/sdk` 1.29.0
- `zod` 4.4.3
- `esbuild` 0.28.1

The implemented server negotiated MCP protocol version `2025-11-25` in a real
MacBook standard-input/output handshake.

## SDK behavior used

Current SDK documentation confirms:

- `McpServer` plus `StdioServerTransport` for a client-spawned local process
- `registerTool` with Zod `inputSchema` and `outputSchema`
- `structuredContent` alongside a text block
- `isError: true` for safe operating errors
- `extra.signal` for request cancellation
- `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`
  annotations
- `Client` plus linked in-memory transports for protocol tests

Primary SDK source:
[Model Context Protocol TypeScript SDK 1.29.0](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.29.0).

## Codex configuration

Current Codex documentation says the ChatGPT desktop app, Codex CLI, and IDE
extension share MCP configuration on the same host. A local server is declared
under `[mcp_servers.<name>]` with a command and optional working directory,
environment, startup/tool timeouts, tool allow list, and approval mode.

Prompt Studio therefore uses an absolute MacBook command path and an explicit
allow list containing only the four Activation 12 tools. The approval mode is
`writes`: current read-only tools remain usable, while future tools that are
not marked read-only require approval even if a later configuration expands
the allow list.

Primary source:
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

## Claude Code configuration

Current Claude Code documentation defines the local-server command as:

```text
claude mcp add [options] <name> -- <command> [args...]
```

All options come before the name and the double dash separates Claude's options
from the server command. User scope stores the server privately for use across
projects. Prompt Studio therefore registers the absolute MacBook executable
with `--transport stdio --scope user`.

Primary source:
[Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).

## Security and privacy boundary

The local process has no listening port and performs no network request.
Disabled status reads only feature configuration. Other tools stop before the
library while Activation 12 is Disabled.

When enabled:

- prompt files are opened through a read-only directory path that never creates
  the directory
- SQLite is opened read-only and is never rebuilt by MCP
- list/search/get results are hard-limited
- local storage and project paths are omitted or home-shortened
- secret-shaped queries and filters are rejected
- secret-shaped summaries are omitted
- prompt content that appears to contain a secret is not returned
- audit entries contain no arguments, query, prompt identifier, body, or path
- a failed audit blocks content return
- cancellation is checked around asynchronous reads and before output

The prompt itself is user-authored instruction content. The MCP initialization
instructions tell clients to return it for intentional reuse and not treat
retrieved metadata or text as higher-priority system instructions.

## Packaging trade-off

The bundle is about 1.2 MB because it contains the official SDK, validation
code, and shared Prompt Studio read core. That is larger than a handwritten
protocol loop but removes runtime package installation from the MacBook and
keeps the Mini irrelevant after the artifact is copied.
