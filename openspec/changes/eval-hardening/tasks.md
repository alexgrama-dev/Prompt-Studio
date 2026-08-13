# Tasks

## 1. Judge context

- [x] 1.1 Pass the case's supplied context (project, path,
      allowedProjectFiles) into the judging prompt as inadmissible for
      invention scoring
- [x] 1.2 Pin with a test reproducing the 2026-08-01 `dev-test-flake`
      false verdict (supplied file judged as invented)

## 2. Guardrail disagreement

- [x] 2.1 Decide: judge-exempt the appended Execution Guardrails block, or
      stop appending it to research/summarize-only prompts; record the
      decision in this file with the eval evidence
      Decision: exempt the block in judging. Keep appending it in the
      product. Evidence: 2026-08-01 cited the block as padding in 8 of
      10 hard-failure notes; the rubric never mentioned guardrails.
      Removing the product block is the larger change.
- [x] 2.2 Implement the chosen side and pin with a test

## 3. Repeated decisions

- [x] 3.1 Add N-generation repetition (default 3) with majority-vote
      judging for accept/reject runs
      Library default remains 1. CLI `--repeats 3` is the accept/reject
      path. `evaluationCaseFlipRates` scores minority fraction.
- [x] 3.2 Report per-case flip rates in the run summary
      After review, `reviewSummary.flipRates` is present when a case has
      more than one generation.

## 4. Verification

- [ ] 4.1 Pass the full check gate on the Mac Mini mirror
      Mini: `pnpm test` 124/124 and `pnpm typecheck` pass. `pnpm check`
      includes `pnpm build` / `pnpm dev`, which this host must not run.
- [x] 4.2 Re-run the hardened eval against the current compiler (1.2.1)
      with `--repeats 3` and record whether verdicts stabilize on the
      2026-08-01 calibration cases
      Result: not stable enough to accept. 7/24 still flip.
      `protected-untrusted-reference` majority-fails. Receipt
      `docs/verification/2026-08-13-compiler-1-2-1-n3-eval.md`.
- [x] 4.3 Targeted 1.2.2 re-eval of `protected-untrusted-reference`
      and `dev-test-flake` at N=3. Protected injection 3/3.
      `dev-test-flake` still majority-fails. Receipt
      `docs/verification/2026-08-13-compiler-1-2-2-two-case-n3-eval.md`.
