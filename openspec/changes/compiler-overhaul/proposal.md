# Prompt Compiler Overhaul

## Why

Prompt Studio currently expands rough input with one shared compiler policy.
That policy is hand-written, has only 24 frozen cases, and uses a judge whose
unchanged decisions varied on 8 of 24 cases. It cannot prove model-family fit,
reasoning-tier fit, or downstream coding outcomes.

The product needs a measured compiler: typed intent analysis, explicit gap
handling, optional verified repository context, target-specific rendering,
anti-pattern rejection, and fresh evaluation receipts for every policy change.

## What Changes

- Establish current Raycast, OpenAI, and Anthropic behavior with dated citations.
- Expand evaluation to at least 60 labeled cases and twelve anchored dimensions.
- Calibrate cross-family judging against human scores and add downstream coding
  tasks against fixture repositories.
- Replace the monolithic compiler policy with typed, pure stages.
- Resolve rendering through schema-validated vendor and reasoning-tier profiles.
- Detect every accepted anti-pattern before delivery.
- Add streaming Raycast generation, access-aware fallback, capture sources,
  preferences, history, caching, and local-only measurements.
- Add CI regression checks and record fresh unit, integration, downstream,
  adversarial, and Raycast evidence.

## Boundaries

- Markdown remains the recoverable prompt source.
- Existing prompt files need no migration.
- SQLite, QMD, and compiler caches remain disposable.
- Repository context remains optional, bounded, permissioned, and read-only.
- A model result is never saved to the main library without preview and approval.
- A provider profile ships only after it beats the generic fallback on that
  profile's target.
- No live model or external coding-agent run occurs without an explicit cost
  boundary and available credentials.

## Impact

- New compiler modules under `src/core/compiler/`.
- Expanded evaluation assets under `evals/compiler/`.
- Raycast integration changes in `src/enhance-prompt.tsx` and the manifest.
- New CI workflow and evidence documents.
- Existing CLI and MCP enhancement routes adopt the same compiler stages.
