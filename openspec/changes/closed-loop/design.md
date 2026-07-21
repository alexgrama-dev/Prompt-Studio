# Closed Loop Design

## 1. Agent auto-recall instruction

One short paragraph, installed in `~/.claude/CLAUDE.md` and
`~/.codex/AGENTS.md`, and recorded verbatim in this repository's README:

> Before starting a substantive coding task, search the local Prompt Studio
> MCP (`prompt_studio_search`) for a matching saved prompt. If one clearly
> fits, fetch it with `prompt_studio_get`, fill any `{{placeholders}}`, and
> follow it. If the server is unavailable or nothing fits, continue normally
> without mentioning it. After finishing a task where a saved prompt was
> used, record the outcome with `prompt_studio_record_feedback`.

Constraints:

- Keep it to one paragraph; instruction bloat degrades every session.
- The recall must fail silent: an offline MCP server must never cost tokens
  or attention.
- Verification is live: one Claude Code session and one Codex session must
  show a real `prompt_studio_search` call and a real feedback record.

## 2. `prompt_studio_record_feedback`

Decision: feedback writes do not use the CLI-issued confirmation token.

Reasoning: the token exists so prompt records cannot be mutated without a
human approving the exact request digest. Feedback records are a separate
append-only store; they cannot modify or delete a prompt, and requiring a
human token would defeat the purpose (autonomous outcome capture). The
existing safety pattern still applies in full:

- Gated on the Active `feedback` capability; Disabled performs no work and
  reads no data.
- Input validated against the existing draft shape: prompt id (existing,
  non-archived), verdict from `FEEDBACK_VERDICTS`, outcome status from
  `FEEDBACK_OUTCOME_STATUSES`, target agent from `FEEDBACK_TARGET_AGENTS`,
  note capped (1000 characters) and passed through the existing privacy
  scrubber (paths, emails, secrets).
- Append-only: no update or delete surface over MCP; editing stays in
  Raycast and the CLI where the human is.
- Rate-capped: at most 30 records per server process per hour; excess
  returns a clear error instead of writing.
- Audit-logged like every other MCP call, with redacted paths.
- Failed validation writes nothing (same no-partial-write proof as other
  mutations).

Tool result returns the stored record id and the prompt version it snapshots
so the agent can reference it.

Configuration: the tool ships in the mutation server; the Codex
`enabled_tools` list and the Claude Code registration are updated once, and
the README documents both.

## 3. Parity and freshness

- `extractPlaceholders` already exists in the shared core. CLI `get --json`
  and MCP `get` add a `placeholders` array; human `get` prints a
  `Placeholders:` line when non-empty; CLI `copy` prints a warning to stderr
  when the copied body still contains placeholders.
- Freshness: at build time, `build:cli` and `build:mcp` already produce one
  bundle file each. `status` compares the bundle's own mtime against the
  newest mtime under `src/core/`. When the bundle is older, append a warning
  to the status output: "compiled <relative time> before the newest core
  change; run pnpm build:cli / build:mcp".
  ponytail: mtime comparison, not content hashing; rsync or touch can fool
  it, and the upgrade path is embedding a source digest at build time.
  The warning only renders when the CLI runs from inside the repository
  checkout (the compiled bundle knows its source root only there); the
  symlinked daily binary lives in the checkout, so this covers the real
  case.

## 4. `prompt-studio stats`

One read-only command over existing data: SQLite usage table, feedback
store, prompt records. Output: total prompts, active versus archived, per
prompt use count and last use (descending), feedback tallies by verdict and
outcome status, and prompts with zero recorded use. `--json` returns the
same envelope shape as every other command. No new storage; a missing index
degrades to zero counts with a note rather than an error.

## 5. Experiment protocol

- Baseline: capture `prompt-studio stats --json` output into
  `docs/verification/` on the day items 1-4 land.
- Window: two weeks of normal work (target end 2026-08-04), no special
  behavior.
- Exit criteria, evaluated at the window's end:
  - at least 20 feedback records exist across at least 5 distinct prompts;
  - `prompt-studio optimization generate` produces a proposal from that
    evidence;
  - the proposal is evaluated on the frozen 24 cases; the winner is accepted
    only if it beats baseline without any protected-case regression, through
    the existing Raycast approval flow.
- Both outcomes are recorded: an accepted improvement or a documented
  rejection with reasons. If fewer than 20 records accumulate, that is the
  finding: recall or feedback friction is still too high, and the next
  change targets that instead of the compiler.
