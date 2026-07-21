## Why

Every capability is live, but the system still depends on Alex remembering to
open Raycast, and the feedback store that powers optimization is empty. The
tool improves prompts only if prompts reach agents without a human in the
loop and if outcome evidence accumulates from real work. This change closes
that loop and adds the small production guards that keep it trustworthy.

## What Changes

1. **Agent auto-recall.** Document and install a short recall instruction in
   the global Claude Code and Codex instruction files: before a substantive
   coding task, search the Prompt Studio MCP for a matching prompt and follow
   it when one clearly fits. No code change; the MCP server is already
   registered on this MacBook.
2. **Agent-native feedback.** Add one MCP tool,
   `prompt_studio_record_feedback`, so the agent that just used a prompt
   records the outcome itself using the existing feedback record shape
   (verdict, outcome status, privacy-scrubbed note). Feedback writes are
   append-only and touch no prompt record, so they do not require the
   CLI-issued mutation confirmation token; they are still gated on the Active
   `feedback` capability, validated, redacted, size-capped, and audit-logged.
3. **Cross-surface parity and freshness.** Expose `{{placeholder}}` names in
   CLI and MCP `get` output so agents know what to fill; warn on `copy` when
   placeholders remain; make CLI and MCP `status` warn when the compiled
   bundle is older than the shared-core sources it was built from.
4. **Stats surface.** Add `prompt-studio stats` reporting per-prompt use
   counts, last use, feedback tallies by outcome, and zero-use prompts, in
   human and JSON forms, from data that already exists.
5. **The measured experiment.** Freeze a baseline stats snapshot, run two
   weeks of normal work with auto-recall and agent feedback live, then run
   the first outcome-backed optimization cycle against the accumulated
   evidence and accept or reject the proposal on the frozen 24-case
   evaluation. Success is a closed, measured loop, not more surface.

## Capabilities

### New Capabilities

None. No new activation slot: items 2-4 extend the Active `cross-agent-access`
and `feedback` capabilities; item 1 is configuration outside the product.

### Modified Capabilities

- `cross-agent-access`: agent feedback recording, placeholder exposure,
  build-freshness warning, stats command.

## Impact

- MCP server gains one write tool that appends feedback records only; delete
  remains impossible and prompt records remain untouchable without a
  confirmation token.
- CLI gains `stats` and richer `get`/`status` output; no new storage,
  network, or credentials anywhere.
- Global agent instruction files gain one short recall paragraph each.
- The experiment produces either a measured compiler improvement or a
  documented rejection; both are acceptable outcomes.
