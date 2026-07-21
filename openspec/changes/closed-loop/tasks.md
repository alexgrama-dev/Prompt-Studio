## 1. Agent auto-recall

- [ ] 1.1 Add the one-paragraph recall-and-feedback instruction to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`, and record it verbatim in the README
- [ ] 1.2 Verify one live Claude Code session performs a real `prompt_studio_search` recall
- [ ] 1.3 Verify one live Codex session performs a real recall

## 2. Agent-native feedback tool

- [ ] 2.1 Implement `prompt_studio_record_feedback` over the existing feedback store: capability-gated, validated, privacy-scrubbed, append-only, size- and rate-capped, audit-logged
- [ ] 2.2 Prove disabled-feature rejection, invalid-input rejection with no partial write, redaction of paths and secrets, and the rate cap in shared tests
- [ ] 2.3 Extend the MCP mutation probe to cover the feedback tool end to end
- [ ] 2.4 Update the MCP server instructions text, Codex `enabled_tools`, and README so agents know when and how to record feedback
- [ ] 2.5 Verify one live agent-recorded feedback record lands in the store and renders in Raycast feedback review

## 3. Parity and freshness

- [ ] 3.1 Expose placeholder names in CLI `get` (human and JSON) and MCP `get`; warn on CLI `copy` when placeholders remain
- [ ] 3.2 Warn in CLI and MCP `status` when the compiled bundle is older than the newest shared-core source
- [ ] 3.3 Cover placeholder exposure and the freshness warning with shared tests

## 4. Stats surface

- [ ] 4.1 Implement `prompt-studio stats` with human and JSON output over usage, feedback, and record data
- [ ] 4.2 Degrade to zero counts with a note when the index is missing; cover with tests

## 5. Measured experiment

- [ ] 5.1 Capture the baseline stats snapshot in `docs/verification/` the day items 1-4 land
- [ ] 5.2 Run two weeks of normal work with recall and agent feedback live (target end 2026-08-04)
- [ ] 5.3 Evaluate exit criteria: ≥20 feedback records over ≥5 prompts, one optimization proposal generated and evaluated on the frozen 24 cases, accepted only without protected-case regression
- [ ] 5.4 Record the outcome — accepted improvement, documented rejection, or a friction finding that redirects the next change

## 6. Verification

- [ ] 6.1 Pass the full check gate on the Mac Mini mirror
- [ ] 6.2 Record a verification report for items 1-4
