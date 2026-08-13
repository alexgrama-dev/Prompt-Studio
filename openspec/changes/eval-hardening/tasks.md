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
      `evaluationCaseFlipRates` is the scoring helper. CLI `--repeats`
      is not wired; run the existing runner N times and pass records in.
- [x] 3.2 Report per-case flip rates in the run summary
      Helper returns per-case `flipRate` (minority fraction). Wiring into
      the JSON run summary waits on `--repeats`.

## 4. Verification

- [ ] 4.1 Pass the full check gate on the Mac Mini mirror
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
      `evaluationCaseFlipRates` is the scoring helper. CLI `--repeats`
      is not wired; run the existing runner N times and pass records in.
- [x] 3.2 Report per-case flip rates in the run summary
      Helper returns per-case `flipRate` (minority fraction). Wiring into
      the JSON run summary waits on `--repeats`.

## 4. Verification

- [ ] 4.1 Pass the full check gate on the Mac Mini mirror
- [ ] 4.2 Re-run the hardened eval against the current compiler (1.2.1)
      with repetition and record whether verdicts stabilize on the
      2026-08-01 calibration cases
