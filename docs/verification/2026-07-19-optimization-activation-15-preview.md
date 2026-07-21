# Outcome-backed Optimization — Activation 15 Implementation

Date: 2026-07-19  
State after this work: **Disabled**

## Outcome

Prompt Studio now contains the complete Activation 15 proposal workflow:

```text
approved feedback -> 2-4 additive candidates -> development winner
                  -> separate validation -> protected-case block
                  -> exact-digest approval -> reversible compiler state
```

The feature remains Disabled because Activations 3–14 are not all Active. No
real prompt, feedback, proposal, compiler state, feature state, provider
credential, Codex configuration, or Claude Code configuration was changed. No
live model request was made.

## Candidate generation

Raycast and CLI can prepare one explicit GPT-5.6 Sol request after the user
selects:

- at least two feedback records;
- at least one not-useful record with a critique, correction, or observed
  outcome;
- two to four candidates;
- at least two development, two validation, and one protected frozen case;
- quality and cost limits.

The review shows the exact feedback fields, frozen case contract, model,
reasoning level, request digest, privacy statement, exclusions, and conservative
cost cap before transmission.

The request excludes prompt bodies, final edited prompts, private notes, project
paths, credentials, and existing evaluation outputs. It uses one native OpenAI
Responses request with `store:false`, strict structured output, and no provider
fallback. A positive confirmed USD limit and the OpenAI key are read only after
confirmation.

## Evaluation and approval boundaries

- Candidate instructions are addenda to the fixed compiler contract; they
  cannot remove its fidelity, fact, source, authorization, or structured-output
  safeguards.
- The baseline and every candidate need completed human-review scores for every
  selected case.
- Development scores select the provisional candidate.
- Validation checks that candidate on separate cases and enforces the absolute
  score plus allowed-regression limits.
- Any protected-case hard failure or score regression blocks approval.
- The measured cost increase must remain under the explicit limit.
- A winner must name every record in a conflicting-feedback group.
- Missing, duplicate, mismatched, or non-human-reviewed scores leave the
  existing proposal unchanged.
- Approval requires the evaluated winner, exact full policy digest, human
  confirmation, and an active compiler still matching the proposal baseline.

Preview approval can verify persistence and rollback, but enhancement loads the
accepted policy only while Prompt Optimization is Active.

## Rollback and retention

One private, atomically written compiler-state document owns:

- the current compiler digest;
- the default and every accepted policy;
- activation and rollback events;
- proposal and candidate identifiers for accepted policies.

Rollback selects a prior digest. It does not delete later policies, proposals,
scores, feedback, or prompt versions. A proposal that supplied any accepted
policy cannot be deleted, even after rollback.

## MacBook Pro rendered proof

The real **Prompt Optimization** Raycast command was opened through macOS
accessibility on the MacBook Pro. It rendered:

> Prompt Optimization is Disabled until Activation 15 reaches Preview. No
> proposal, feedback, evaluation, or compiler-state files were read.

The running MacBook `pnpm dev` process rebuilt all six command entry points
after the final changes:

- Browse Prompts
- Create Prompt
- Enhance Prompt
- Prompt Studio Status
- Prompt Feedback
- Prompt Optimization

The extension compiled successfully. The only runtime output was Node's
existing experimental SQLite warning.

## Compiled MacBook CLI proof

The Mini-built CLI was copied back to the MacBook. The real Disabled command
stopped before proposal access.

`pnpm verify:optimization-cli` then used isolated temporary Preview feature,
prompt, feedback, proposal, and compiler-state paths. It proved:

- Disabled mode created no proposal directory;
- unconfirmed proposal creation created no proposal directory;
- a proposal with two candidates was created without exposing its runtime path;
- complete reviewed scores selected the expected development winner;
- approval preview returned the exact policy digest and wrote no compiler
  state;
- only that digest could be accepted;
- rollback restored the baseline;
- the accepted proposal remained undeletable after rollback;
- Markdown export contained the instruction diff and no temporary runtime path.

The proof removed all temporary files and did not touch the real MacBook
library or feature configuration.

## Automated evidence

The complete Mini `pnpm check` passed:

- 50/50 shared tests;
- TypeScript with no errors;
- ESLint with no issues;
- Raycast production build with all six commands;
- standalone CLI compilation;
- single-file MCP compilation;
- Disabled read-only MCP runtime and protocol probes;
- Preview MCP mutation protocol probe;
- Disabled and isolated Preview compiled feedback CLI probe;
- Disabled and isolated Preview compiled optimization CLI probe.

Focused optimization coverage includes:

- insufficient and unapproved evidence rejection without a proposal write;
- privacy-safe candidate-generation payload and cost rejection before network;
- exact model, one request, strict output, key-in-header, and `store:false`
  behavior through a mocked provider;
- development selection, validation threshold, protected regression, conflict,
  and cost rules;
- incomplete evaluation rejection without revision or compiler change;
- proposal persistence separate from compiler state;
- exact-digest approval and stale-baseline rejection;
- accepted policy use by the OpenAI enhancement adapter;
- rollback with complete history retention;
- CLI Disabled, create, evaluate, inspect, export, approve, rollback, and
  accepted-proposal deletion boundaries.

Strict OpenSpec validation passed. Gitleaks scanned approximately 3 MB with
redaction enabled and found no leaks.

## Remaining activation requirements

1. Activations 3–14 must become Active in order.
2. Set Prompt Optimization to Preview with a passing verification record.
3. Create representative real feedback over time; do not manufacture outcome
   evidence merely to activate optimization.
4. Review a real transmission plan and explicitly approve the provider cost
   before any candidate-generation call.
5. Blind-review baseline and candidate outputs on the full frozen cases.
6. Verify Raycast generation, cancellation, score import, blocked proposal,
   approval, MacBook restart, Mini offline, backup/restore, and rollback
   surfaces.
7. Require at least one real rollback rehearsal and confirm the next
   enhancement records the correct compiler version.
8. Only then may Activation 15 move from Preview to Active.
