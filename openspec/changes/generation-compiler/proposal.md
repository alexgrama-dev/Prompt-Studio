## Why

The Enhance Prompt compiler is a single instruction blob plus two
target adaptations. Vendor guidance now splits by vendor and by
reasoning tier, and several directives oppose each other. The current
24-case 0–100 eval cannot grade a compiler: 2026-08-01 runs flipped
8 of 24 verdicts. A one-shape prompt for all targets is wrong. A
compiler change without a stable eval is unfalsifiable.

## What Changes

- Record current-page vendor rules, conflicts, and a versioned
  vendor×tier map in `docs/00-ground-truth.md`.
- Rebuild the measuring instrument first (60+ cases, 0–4 twelve
  dimension rubric, calibrated judge, repetition). Keep the frozen
  24 case identifiers unchanged.
- Replace the monolithic compiler with staged, independently testable
  functions and declarative rendering profiles keyed on vendor ×
  reasoning tier. Branch on conflicts; never average them.
- Encode Phase 4 anti-patterns as automated checks with failing tests.
- Keep generation on pinned provider snapshots and local prompt
  builders. Do not depend on OpenAI reusable prompt objects
  (`v1/prompts` shutdown 2026-11-30).

## Capabilities

### New Capabilities

- `generation-compiler`: staged capture → classify → gap analysis →
  optional context → elicitation → profile resolve → compose →
  critique → render, with schema-validated profiles.

### Modified Capabilities

- `prompt-enhancement`: eval harness, target profiling, and compiler
  contract. Existing Enhance Prompt command remains the surface until
  a later UI change is justified.

## Impact

- Shared core: `src/core/enhancement.ts` and related modules, `evals/`,
  `docs/00-ground-truth.md` through `docs/07-final-report.md`.
- No storage format break for saved Markdown prompts.
- Live eval cost rises (N≥3, larger corpus, cross-family judge).
- Mac Mini: `pnpm test`, `pnpm typecheck`, `pnpm lint` only.
- MacBook Pro: `pnpm build`, `pnpm dev`, Raycast UI, paid evals.
