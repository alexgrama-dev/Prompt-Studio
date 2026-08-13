# Tasks

## 0. Ground truth

- [x] 0.1 Branch `compiler-rebuild` and write the handoff
- [x] 0.2 Inventory the live repo, Raycast API 1.104.23, and current
      vendor pages
- [x] 0.3 Publish `docs/00-ground-truth.md` (inventory, API, rule
      table, conflict table, tier map)

## 1. Eval harness

- [x] 1.1 Finish `eval-hardening` judge context, guardrail policy, and
      N≥3 repetition (see that change). CLI `--repeats 3` is wired.
      Default remains 1.
- [x] 1.2 Add the 0–4 twelve-dimension rubric with written anchors
- [x] 1.3 Expand the corpus to ≥60 cases without mutating frozen 24
      identifiers or required/prohibited lists
- [ ] 1.4 Implement span-citing LLM-as-judge on a different family
      than the generator
- [ ] 1.5 Design downstream fixture-repo eval; do not spend until
      offline checks pass
- [x] 1.6 Document the harness in `docs/01-eval-harness.md`

## 2. Architecture and profiles

- [x] 2.1 Write `docs/02-architecture.md` with stage contracts
- [x] 2.2 Write `docs/03-rendering-profiles.md` with cited provenance
- [ ] 2.3 Implement schema-validated profile data, not hardcoded
      model names in generation logic

## 3. Pipeline and anti-patterns

- [ ] 3.1 Implement stages as pure functions with tests
- [x] 3.2 Encode every Phase 4 anti-pattern as a check plus a failing
      fixture
- [ ] 3.3 Confirm injection-shaped input is treated as data on
      argument, selection, and clipboard
      Generate adapters strip instruction-shaped untrusted sentences
      and paraphrase (1.2.2). Detector + fence helper are tested.
      Enhance Prompt still does not read clipboard/selection.

## 4. Measurement and report

- [ ] 4.1 Fresh eval after every generation-logic change
      1.2.2 two-case OpenAI Standard N=3 recorded in
      `docs/verification/2026-08-13-compiler-1-2-2-two-case-n3-eval.md`.
      Full 24-case N=3 not re-run. Protected injection now 3/3. Flake
      still majority-fails on allowed-file scope.
- [ ] 4.2 Measure context-placement versus caching; record the winner
- [ ] 4.3 Write `docs/05-optimization-log.md` and `docs/07-final-report.md`
- [ ] 4.4 Mac Mini: `pnpm test`, `pnpm typecheck`, `pnpm lint`
- [ ] 4.5 MacBook: Raycast UI paths listed in Phase 7
