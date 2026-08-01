## 1. Compiler revision

- [x] 1.1 Add the threshold-preservation rule to the base compiler instructions
- [x] 1.2 Make rendered-UI verification conditional in the Codex and Claude Code target adaptations and omit it for tasks that cannot change UI
- [x] 1.3 Restrict named technologies in tags, aliases, and hidden search phrases to those the user or supplied context named
- [x] 1.4 Bump `ENHANCEMENT_COMPILER_VERSION` to 1.2.0 and pin all three rules with a regression test

## 2. Verification

- [x] 2.1 Pass the full check gate on the Mac Mini mirror
  - 2026-07-23: exit 0 with 61/61 tests including the new compiler-rule regression test.
- [x] 2.2 Re-run the frozen 24-case evaluation against compiler 1.2.0 and accept it as the new baseline (blocked on a one-run OPENAI_API_KEY)
  - 2026-08-01: run completed ($0.228519 actual of $3 approved) but REJECTED
    as baseline — 91.67 avg with 6 hard failures including protected case
    `protected-untrusted-reference`, versus the 1.0.0 baseline's 98.67 with
    zero. Failure mode: invention and authority over-reach, not padding.
    1.0.0 remains the accepted baseline. Compiler diff needs rework before
    any optimization cycle. Report:
    `docs/verification/2026-08-01-compiler-1-2-0-evaluation.md`,
    run file `evals/runs/2026-08-01T10-50-59.659Z--openai-standard-v1.json`.
  - 2026-08-01 follow-up: two rework runs (1.2.1 + action-scope rule, then
    + no-supplied-repository clause) scored 95.25/1-fail and 92.71/4-fail —
    but 8/24 cases flip verdicts across identical runs, so single-run
    scores below ±3 points or ±2 hard failures are noise. Compiler verdicts
    are blocked on `eval-hardening` (judge context, guardrail disagreement,
    repeated decisions), not on more instruction tweaks. 1.2.1's
    action-scope and repository clauses stay in the tree as strictly-better
    instructions; baseline acceptance waits for a stable measurement.
