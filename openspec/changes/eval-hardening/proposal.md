## Why

The 2026-08-01 compiler evaluations (three runs, same frozen cases,
profile, and judge) proved the current evaluation cannot grade a
compiler: 8 of 24 cases flipped pass/fail across runs with no relevant
instruction change, a protected case passed once and failed twice on
near-identical output, and the judge cited a product-appended guardrails
block as padding in 8 of 10 hard-failure notes even though the rubric
never mentions guardrails. Compiler verdicts below roughly ±3 average
points or ±2 hard failures are noise. Every future optimization cycle
inherits this defect.

## What Changes

1. **Judge knows what is supplied.** The judging prompt receives the
   case's supplied context (project name, path, allowedProjectFiles) as
   not-an-invention, so supplied file paths cannot be scored as
   fabricated. Pinned by a test using the `dev-test-flake` verdicts from
   2026-08-01.
2. **Guardrail disagreement resolved one way.** Either the judge sees the
   task prompt with the appended Execution Guardrails block marked as
   product-appended and exempt from length/padding scoring, or the
   product stops appending the block to research/summarize-only prompts.
   Decide with the eval evidence; implement the smaller change.
3. **Decisions need repetition.** Compiler accept/reject requires N≥3
   generations per case with majority-vote judging; reports include
   per-case flip rates so instability is visible instead of averaged
   away. Single-run scores remain for debugging only, never for
   baseline acceptance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: evaluation harness only — judging context,
  guardrail handling, and repetition for decisions. No storage, surface,
  or compiler-contract change.

## Impact

- `evals/judge-run.mts`, `src/core/evaluation-judge.ts`,
  `src/core/evaluation.ts`, and possibly the guardrails append in
  `src/core/enhancement.ts`. Eval cost per compiler decision rises to
  roughly 3× (~$0.70 + judging at current prices).
- The 2026-08-01 runs stand as the calibration dataset: their flip rates
  are the before-measurement for this change.
