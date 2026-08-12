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
- [x] 2.2 Implement the chosen side and pin with a test

### Guardrail decision

Judge-exempt the product-appended Execution Guardrails block for length and
padding scoring. Keep the block in the product. Still inspect it for
contradictions, weakened requirements, authorization defects, or unsafe
behavior.

Evidence from the 2026-08-01 calibration runs: the judge cited guardrail
padding in 8 of 10 hard-failure notes, and the rubric never mentions
guardrails. Exempting the block in judging is the smaller change. Making the
product block conditional would change generated prompts before evaluator
trust is restored.

## 3. Repeated decisions

- [x] 3.1 Add N-generation repetition (default 3) with majority-vote
      judging for accept/reject runs
- [x] 3.2 Report per-case flip rates in the run summary

## 4. Verification

- [ ] 4.1 Pass the full check gate on the Mac Mini mirror
- [ ] 4.2 Re-run the hardened eval against the current compiler (1.2.1)
      with repetition and record whether verdicts stabilize on the
      2026-08-01 calibration cases
