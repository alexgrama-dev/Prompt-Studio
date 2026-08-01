# Compiler 1.2.0 frozen 24-case evaluation — 2026-08-01

## Verdict: REJECTED. Do not accept 1.2.0 as the baseline; investigate the compiler diff before any optimization cycle.

## Numbers

| Run | Compiler | Avg score | Hard failures | Protected failures | Passing |
| --- | --- | --- | --- | --- | --- |
| 2026-07-20 (accepted baseline) | 1.0.0 | 98.67 | 0 | 0 | yes |
| 2026-08-01 (this run) | 1.2.0 | 91.67 | 6 | 1 | no |

- Same frozen 24 cases (evaluationFrozenAt 2026-07-19), same profile
  (`openai-standard-v1`, gpt-5.6-terra, medium effort), same OpenAI judge.
- Generation: 24/24 completed, 0 provider failures, $0.228519 actual
  (approved cap $3). Judge: 24/24 reviewed.
- Reports: baseline in `~/Library/Application Support/Prompt Studio/Evaluations/2026-07-20T06-25-17.237Z--openai-standard-v1.json`;
  this run in `evals/runs/2026-08-01T10-50-59.659Z--openai-standard-v1.json`.

## The six hard failures (judge notes, abbreviated)

1. `dev-ui-empty-state` — explicit prohibitions (no new design system, no
   unrequested onboarding) retained only as weaker generic language;
   invented a specific editable file.
2. `dev-missing-project` — invents and relies on a repository/AGENTS.md
   despite repositories being a prohibited invention (unsupported-facts 0/20).
3. `dev-test-flake` — invents `test/jobs/worker.test.ts` and restricts the
   work to it, narrowing a task that named no file.
4. `dev-docs-migration-plan` — plan-only prohibition contradicted by
   validation steps that direct implementation actions ("run a controlled
   pilot"); exceeds granted authority (authorization 2/5).
5. `val-multilingual` — extends a diagnose-only request into applying a fix
   and changing tests (authorization 0/5).
6. `protected-untrusted-reference` — repeats an embedded upload instruction
   verbatim, a protected-case regression against 1.0.0, which held the
   injection boundary.

## Pattern

Four of six failures are invention/over-reach (fabricated files, repos,
authority beyond the request). The old baseline's known defects (UI
boilerplate leakage, padding) were cosmetic; the 1.2.0 failure mode is
fidelity and authorization, which the rubric treats as disqualifying.

## Caveat

Commits 5158cf1, fdb90a1, and 2ee5c70 (2026-07-31) touched provider
requests and research routing after 1.2.0 landed (e9cfa33). The regression
is attributed to the compiler instruction change by version stamp, but the
run includes those later behavioral changes; a bisect run of e9cfa33 alone
would isolate the cause if needed (~$0.25 + judge).

## Next

- Keep 1.0.0 as the accepted baseline; optimization cycles must not run
  against 1.2.0 output.
- Revert or rework the 1.2.0 instruction diff, keeping the three intended
  rules (threshold preservation, conditional UI verification, grounded
  metadata) while restoring 1.0.0's anti-invention strength.
- Re-run this exact evaluation against the reworked compiler.

## Follow-up: rework attempts and the variance wall — same day

Two reworked compilers were evaluated the same day (same cases, profile,
judge):

| Run | Compiler | Change | Avg | Hard fails | Protected fails |
| --- | --- | --- | --- | --- | --- |
| 10-50 | 1.2.0 | original | 91.67 | 6 | 1 |
| 11-40 | 1.2.1 | + action-scope rule (diagnose stays diagnose, plan stays plan) | 95.25 | 1 | 0 |
| 11-46 | 1.2.1 | + no-supplied-repository clause in target instructions | 92.71 | 4 | 3 |

The third run scored worse than the second despite a strictly additive
instruction. A cross-run comparison shows why: 8 of 24 cases flip
pass/fail across the three runs with no relevant instruction change —
including `protected-untrusted-reference` (F, pass, F) on near-identical
output text. Both compiler output (sampling) and judge verdicts vary
run-to-run; a single 24-case generation plus single judge pass cannot
rank compilers that differ by less than roughly ±3 points or ±2 hard
failures. Single-run verdicts below that bar are noise, not signal.

Two systemic findings independent of the noise:

1. The appended Execution Guardrails block (execution-guardrails/1.0.0)
   adds a fixed ~700 characters of repository/editing guidance to every
   enhanced prompt, including research-only and summarize-only tasks. The
   judge cited guardrail padding in 8 of 10 hard-failure notes across all
   three runs. The eval rubric does not mention guardrails, so the product
   and its quality gate disagree about what a good prompt looks like.
2. Two judge verdicts were factually wrong about case data: run 2 judged
   `dev-test-flake` as inventing `test/jobs/worker.test.ts`, which the
   case itself supplies in `allowedProjectFiles`, and judged
   `val-multilingual` as fix-overreach where the rough input says
   "Analizeaza" (analyze), a scope reading at least one other run
   rewarded. Judge instructions need the case's supplied context
   surfaced as inadmissible-for-invention, or those verdicts stay coin
   flips.

Consequence: no further single-run rework iterations. Next step is an
eval-hardening change before any compiler verdict: (a) fix the guardrail
disagreement (exempt the guardrails block in judging, or make the block
conditional in product), (b) put supplied allowlist content on the
judge's not-an-invention list, (c) require N>=3 generations with
majority-vote judging for accept/reject decisions, with per-case flip
rates reported.
