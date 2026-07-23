## 1. Agent auto-recall

- [x] 1.1 Add the one-paragraph recall-and-feedback instruction to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`, and record it verbatim in the README
  - 2026-07-21: installed in both global instruction files and recorded verbatim in the README.
- [x] 1.2 Verify one live Claude Code session performs a real `prompt_studio_search` recall
  - 2026-07-21: a nested headless Claude Code session could not authenticate; the server and tools are verified over stdio, and the client-level recall check moves to the next interactive session.
  - 2026-07-21 (later): a live interactive Claude Code session called `prompt_studio_search` ("diagnose bug root cause evidence" returned both diagnosis prompts) and `prompt_studio_get` through the registered user-scope server, including the new placeholders field.
- [x] 1.3 Verify one live Codex session performs a real recall
  - 2026-07-21: `codex exec` recalled `Test-Driven Development Loop` through the registered MCP entry. A stale index surfaced first and was rebuilt with `reindex --yes`.

## 2. Agent-native feedback tool

- [x] 2.1 Implement `prompt_studio_record_feedback` over the existing feedback store: capability-gated, validated, privacy-scrubbed, append-only, size- and rate-capped, audit-logged
- [x] 2.2 Prove disabled-feature rejection, invalid-input rejection with no partial write, redaction of paths and secrets, and the rate cap in shared tests
- [x] 2.3 Extend the MCP mutation probe to cover the feedback tool end to end
  - 2026-07-21: probe reports agentFeedbackRecorded and invalidFeedbackRejected true.
- [x] 2.4 Update the MCP server instructions text, Codex `enabled_tools`, and README so agents know when and how to record feedback
- [x] 2.5 Verify one live agent-recorded feedback record lands in the store and renders in Raycast feedback review
  - 2026-07-21: one live record created through the real server, listed by the CLI, then deleted to keep the experiment baseline at zero. The Raycast feedback review surface was verified during Activation 14.

## 3. Parity and freshness

- [x] 3.1 Expose placeholder names in CLI `get` (human and JSON) and MCP `get`; warn on CLI `copy` when placeholders remain
- [x] 3.2 Warn in CLI and MCP `status` when the compiled bundle is older than the newest shared-core source
- [x] 3.3 Cover placeholder exposure and the freshness warning with shared tests

## 4. Stats surface

- [x] 4.1 Implement `prompt-studio stats` with human and JSON output over usage, feedback, and record data
- [x] 4.2 Degrade to zero counts with a note when the index is missing; cover with tests

## 5. Measured experiment

- [x] 5.1 Capture the baseline stats snapshot in `docs/verification/` the day items 1-4 land
  - 2026-07-21: `docs/verification/2026-07-21-closed-loop-baseline-stats.json` — 13 active prompts, 0 uses, 0 feedback records.
- [ ] 5.2 Run two weeks of normal work with recall and agent feedback live (target end 2026-08-04)
- [ ] 5.3 Evaluate exit criteria: ≥20 feedback records over ≥5 prompts, one optimization proposal generated and evaluated on the frozen 24 cases, accepted only without protected-case regression
- [ ] 5.4 Record the outcome — accepted improvement, documented rejection, or a friction finding that redirects the next change

## 6. Verification

- [x] 6.1 Pass the full check gate on the Mac Mini mirror
  - 2026-07-21: exit 0 with 60/60 tests, all builds and probes including the extended feedback probe.
- [x] 6.2 Record a verification report for items 1-4
  - 2026-07-21: `docs/verification/2026-07-21-closed-loop.md`.
