# MCP Mutation Confirmation Research

Date: 2026-07-19  
Decision: exact-request, one-time MacBook token

## Question

How can Prompt Studio let Codex and Claude Code create, update, archive, or
enhance prompts without treating an agent's own tool call as human approval?

## Finding

A client approval dialog is useful, but it is not a portable server-side proof
that Alex approved the exact request that finally arrived. Prompt Studio
therefore uses two independent layers:

```text
coding-app approval -> exact-request MacBook token -> local mutation
```

The coding app can show what the agent wants to do. The local token then proves
that Alex separately authorized that action and exact normalized payload within
a short time window. If the agent changes one field after authorization, the
digest changes and the token fails.

## Current primary-source guidance

The Model Context Protocol 2025-11-25 specification says:

- a human should remain able to deny tool invocations;
- clients should show tool inputs and confirm sensitive operations;
- `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` are
  descriptive hints, not guaranteed behavior;
- elicitation can request user input during a workflow, but the protocol does
  not mandate one client interaction model.

Sources:

- [MCP tools and security considerations](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- [MCP 2025-11-25 schema](https://modelcontextprotocol.io/specification/2025-11-25/schema)

The installed TypeScript server uses the stable official SDK 1.29.0 and its
`McpServer.registerTool` API. The SDK exposes tool annotations and request
cancellation, but those APIs do not turn annotations into authorization.

Codex supports an MCP tool allow list and `default_tools_approval_mode =
"writes"`, which prompts for tools not marked read-only. That is retained as a
client-side layer:
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

Claude Code supports ask, allow, and deny permission rules for MCP tools. Its
documentation also warns that bypass mode removes those prompts, which is
another reason not to make the server depend on client UX alone:
[Claude Code permissions](https://code.claude.com/docs/en/permissions).

## Alternatives considered

### Client approval only

Rejected as the sole control. Approval behavior differs by client and user
configuration, annotations are hints, and a permissive client can send a write
without a fresh prompt.

### MCP form elicitation

Deferred as the primary mechanism. It is elegant when supported, but the
protocol deliberately leaves the interaction model to each client. Prompt
Studio needs the same reliable behavior in Codex, Claude Code, and future
coding apps from the first release.

### Reusable session password

Rejected. A reusable credential proves access, not approval of one concrete
operation. It can be replayed for a changed prompt or an unrelated later call.

### One-use digest token

Selected. It is local, client-independent, easy to audit, contains no prompt
content, and can bind consent to every normalized request field.

## Threat model and controls

| Risk                                 | Control                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Agent changes a field after approval | SHA-256 digest covers action and all normalized mutation fields                       |
| Token replay                         | Token file is atomically claimed and removed on first attempt                         |
| Two simultaneous calls race          | Only one atomic rename can claim the token                                            |
| Token used for another action        | Stored action must match                                                              |
| Old authorization                    | Default five-minute expiry; allowed range 30–900 seconds                              |
| Raw token recovered from disk        | Only its one-way hash is used as the filename; raw token is not stored                |
| Agent issues its own authorization   | Token creation exists only in the separately invoked MacBook CLI and requires `--yes` |
| Secret enters the prompt library     | Create, update, and enhancement output reject likely secret-shaped content            |
| Provider key leaks through MCP       | Key is accepted only from the MacBook process environment after authorization         |
| Provider silently changes            | Provider comes from the confirmed profile and failure has no fallback                 |
| Audit leaks prompt content           | Audit schema contains only time, tool, outcome, duration, count, and safe code        |
| Audit is unavailable                 | Required authorization audit fails closed before mutation                             |
| Delete causes irreversible loss      | No MCP delete tool exists                                                             |

## MacBook ownership

The MacBook Pro owns the prompt library, feature configuration, confirmation
directory, audit log, provider environment, CLI process, and MCP process. The
Mac Mini compiles and tests the bundle only. Tokens cannot depend on an SSH
session or a Mini service, and normal runtime continues when the Mini is
sleeping.

## Activation rule

The compiled bundle contains mutation code from the beginning, but the four
tools are not registered while MCP Mutations is Disabled. Preview requires all
earlier activations to be Active. Active requires a recorded passing
verification and real Codex plus Claude Code confirmation-flow review.
