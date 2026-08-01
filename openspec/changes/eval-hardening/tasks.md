# Tasks

## 1. Judge context

- [ ] 1.1 Pass the case's supplied context (project, path,
      allowedProjectFiles) into the judging prompt as inadmissible for
      invention scoring
- [ ] 1.2 Pin with a test reproducing the 2026-08-01 `dev-test-flake`
      false verdict (supplied file judged as invented)

## 2. Guardrail disagreement

- [ ] 2.1 Decide: judge-exempt the appended Execution Guardrails block, or
      stop appending it to research/summarize-only prompts; record the
      decision in this file with the eval evidence
- [ ] 2.2 Implement the chosen side and pin with a test

## 3. Repeated decisions

- [ ] 3.1 Add N-generation repetition (default 3) with majority-vote
      judging for accept/reject runs
- [ ] 3.2 Report per-case flip rates in the run summary

## 4. Verification

- [ ] 4.1 Pass the full check gate on the Mac Mini mirror
- [ ] 4.2 Re-run the hardened eval against the current compiler (1.2.1)
      with repetition and record whether verdicts stabilize on the
      2026-08-01 calibration cases
