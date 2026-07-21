# MCP Mutations — Activation 13 Implementation

Date: 2026-07-19  
State after this work: **Disabled**

## Outcome

Prompt Studio now contains four separately controlled MCP write tools:

- `prompt_studio_create`
- `prompt_studio_update`
- `prompt_studio_archive`
- `prompt_studio_enhance`

They remain absent while MCP Mutations is Disabled. Activation 13 cannot enter
Preview yet because Activations 3–12 are not all Active.

Delete is intentionally not an MCP tool.

## Human confirmation flow

```text
agent submits reviewed request without token
-> server validates and returns an exact request digest
-> Alex runs the printed `prompt-studio authorize-mcp ... --yes` command
-> CLI creates a five-minute one-use token on the MacBook
-> identical tool request consumes token
-> required privacy audit succeeds
-> shared core performs the mutation
```

Changing the action or any request field invalidates the token. An expired,
replayed, mismatched, or simultaneously reused token is consumed or rejected
without a prompt write.

The raw token is never persisted. Its private record is addressed by a SHA-256
hash of the token and contains only the action, request digest, and timestamps.

## Mutation boundaries

- The feature state is checked before prompt, confirmation, credential, or
  provider access.
- The tools are registered only when MCP Mutations was Preview or Active at
  server startup.
- Deactivation blocks an already-listed tool on its next call.
- Create and update validate bounded fields and reject likely secrets.
- Update and archive preserve a prior Markdown version.
- Archive hides a prompt without deleting its file.
- Enhancement reads the selected provider key only after token consumption.
- Enhancement uses one explicit provider and never falls back.
- Structured model output is validated and secret-checked before preview.
- Enhancement saves only when `save: true` was part of the confirmed digest.
- Missing audit access fails closed before a mutation.
- Audit events contain no arguments, prompt text, prompt ID, path, digest,
  token, or provider key.

## Automated evidence

The shared suite currently passes 43/43 checks. Activation 13 coverage includes:

- canonical request hashing independent of object-key order;
- 30–900 second token lifetimes;
- raw-token absence from filename and record;
- one-use, request-bound, action-bound, expiry, mismatch, replay, and concurrent
  claim behavior;
- CLI `--yes` enforcement and JSON token output;
- eight-tool Preview discovery with no delete tool;
- create, update, preserved history, archive, enhance preview, and explicit
  enhancement save;
- provider not called before confirmation;
- token and provider key absent from provider payload, results, and audit;
- failed authorization and audit-unavailable paths with no prompt write.

The complete Mini `pnpm check` also passed:

- 43/43 shared tests;
- TypeScript with no errors;
- ESLint with no issues;
- Raycast production build;
- standalone CLI compilation;
- single-file MCP bundling;
- SDK and dependency-free Disabled-state protocol probes;
- dependency-free Preview mutation protocol probe.

Strict OpenSpec validation passed. Gitleaks scanned approximately 2.62 MB with
redaction enabled and found no leaks.

The compiled Mini bundle also passed a real MCP 2025-11-25 protocol flow:

- all eight Preview tools listed;
- delete absent;
- unconfirmed create refused with a digest;
- the compiled CLI issued the token;
- the exact repeated create wrote one prompt;
- token replay failed;
- the audit contained no prompt or token content.

## MacBook Pro runtime proof

The Mini-built `dist-cli` and `dist-mcp` artifacts were copied back to the
MacBook. Two dependency-free local probes then passed:

```bash
node --experimental-strip-types scripts/verify-mcp-bundle.mts
node --experimental-strip-types scripts/verify-mcp-mutations.mts
```

The first used the real Disabled state and listed only the four read tools,
returned `dataRead: false`, rejected list, and created no test data. The second
used isolated temporary Preview configuration and repeated the full CLI-token
create flow with eight tools, no delete, one prompt, rejected replay, and a
privacy-safe audit.

Neither MacBook probe used SSH, a Mini process, or a network listener. No live
model call or provider credential was used.

The final MacBook MCP bundle is executable and measures 1,278,342 bytes. The
CLI entry is executable and runs with its copied `dist-cli` support directory.

## Remaining activation requirements

1. Activations 3–12 must become Active in order.
2. Set MCP Mutations to Preview with a passing verification record.
3. Restart the MacBook MCP clients so the four tools appear.
4. Add the four mutation names to Codex's explicit `enabled_tools` list while
   keeping write approvals enabled.
5. Verify exact-request confirmation in real Codex and Claude Code sessions.
6. Verify MacBook restart, Mini offline, cancellation, audit rotation, provider
   error, and rollback behavior.
7. Only then may Activation 13 move from Preview to Active.
