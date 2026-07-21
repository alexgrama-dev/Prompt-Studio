# Closed Loop Implementation

Date: 2026-07-21  
Change: `closed-loop` (open until the experiment concludes)  
Build and test host: Mac Mini mirror at `~/Developer/work/prompt-studio`

## Phase 1 — Agent auto-recall

- The recall-and-feedback paragraph is installed in `~/.claude/CLAUDE.md` and
  `~/.codex/AGENTS.md`, and recorded verbatim in the README.
- **Codex live recall verified**: `codex exec` called
  `prompt_studio_search` through the registered MCP entry and returned the
  correct title `Test-Driven Development Loop`.
- Claude Code live recall could not be exercised headlessly (nested OAuth
  session expired); it remains open for the next interactive session. The
  same server and tools were verified over stdio, so only the client-side
  wiring remains unobserved.

## Phase 2 — Agent-native feedback

- `prompt_studio_record_feedback` ships in the MCP server: gated on the
  Active feedback capability, validated against the existing verdict,
  outcome, and target enums, note capped at 1000 characters, secret-bearing
  notes rejected, append-only, 30 records per server hour, audit-logged.
  Prompt mutations still require confirmation tokens; delete remains
  impossible.
- Shared tests cover disabled rejection, invalid-input rejection with no
  partial write, secret rejection, archived-prompt rejection, the rate cap,
  and audit success events.
- The mutation probe now proves the feedback tool end to end (tool listed,
  one record written, invalid verdict rejected without a write).
- **Live round trip verified** against the real server and real store: one
  record created through stdio, listed by the CLI, then deleted; the store
  was left clean so the experiment baseline starts at zero.
- Codex `enabled_tools` and the README document the tool.

## Phase 3 — Parity and freshness

- CLI and MCP `get` expose `placeholders`; CLI `copy` warns when unfilled
  placeholders remain; MCP `get` text names them before the body.
- CLI and MCP `status` warn when the compiled bundle is older than the
  newest shared-core source (mtime comparison; digest embedding is the noted
  upgrade path). Covered by tests in both directions plus the missing-file
  path.

## Phase 4 — Stats

- `prompt-studio stats` reports totals, ranked use counts with last use,
  feedback tallies by verdict and outcome, and zero-use prompts, in human
  and JSON envelopes; a missing index degrades to zero counts with a note.
  Covered by an end-to-end CLI test.

## Phase 5 — Experiment started

- Baseline snapshot:
  `docs/verification/2026-07-21-closed-loop-baseline-stats.json` — 13 active
  prompts, 0 recorded uses, 0 feedback records.
- Window: normal work through approximately 2026-08-04.
- Exit gate: at least 20 feedback records over at least 5 prompts, one
  optimization proposal generated and evaluated on the frozen 24 cases,
  accepted only without protected-case regression. Fewer than 20 records is
  itself a finding: recall or feedback friction is still too high.

## Incident noted during verification

The SQLite index had gone stale after the bulk CLI imports earlier today,
which surfaced as `INDEX_UNAVAILABLE` in the first live Codex recall.
`prompt-studio reindex --yes` rebuilt it (17 records) and the recall then
succeeded. Rebuilding reset the disposable use counts, which makes the
experiment baseline honestly zero.

## Automated evidence

- MacBook: 60/60 shared tests, TypeScript, ESLint, Raycast/CLI/MCP builds,
  extended `verify:mcp-mutations` probe (`agentFeedbackRecorded: true`,
  `invalidFeedbackRejected: true`), strict OpenSpec validation of
  `closed-loop`.
- Mac Mini: full `pnpm check` gate; result recorded with this change's
  commit.
