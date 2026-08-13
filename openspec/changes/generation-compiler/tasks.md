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
- [x] 1.4 Implement span-citing LLM-as-judge on a different family
      than the generator (`--rubric v2` Anthropic). Default judge
      remains v1 OpenAI. Live v2 run not executed.
- [x] 1.5 Design downstream fixture-repo eval; do not spend until
      offline checks pass (`pnpm eval:downstream`, loads
      `evals/fixtures/*.json`, skips without manifests or
      `--confirm-spend`)
- [x] 1.6 Document the harness in `docs/01-eval-harness.md`

## 2. Architecture and profiles

- [x] 2.1 Write `docs/02-architecture.md` with stage contracts
- [x] 2.2 Write `docs/03-rendering-profiles.md` with cited provenance
- [x] 2.3 Implement schema-validated profile data, not hardcoded
      model names in generation logic
      `src/core/rendering-profiles.ts` resolved from `PromptTarget`.
      Bake-off versus fallback is still unmeasured.

## 3. Pipeline and anti-patterns

- [x] 3.1 Implement stages as pure functions with tests
      Extra model calls were not added. Elicitation has no UI.
- [x] 3.2 Encode every Phase 4 anti-pattern as a check plus a failing
      fixture
- [x] 3.3 Confirm injection-shaped input is treated as data on
      argument, selection, and clipboard
      Generate adapters strip instruction-shaped untrusted sentences.
      Enhance Prompt tags library argument/selection and Insert
      Clipboard / Insert Selected Text actions.

## 4. Measurement and report

- [ ] 4.1 Fresh eval after every generation-logic change
      1.3.0 has no live receipt. Last paid runs are 1.2.1/1.2.2.
- [ ] 4.2 Measure context-placement versus caching; record the winner
- [x] 4.3 Write `docs/05-optimization-log.md` and `docs/07-final-report.md`
- [x] 4.4 Mac Mini: `pnpm test`, `pnpm typecheck`, `pnpm lint`
      2026-08-13: 139 tests pass, `tsc --noEmit` pass, eslint glob
      from `package.json` lint script pass. `pnpm lint` via rtk can
      still scan generated `prompt-studio.mjs` outside that glob.
- [ ] 4.5 MacBook: Raycast UI paths listed in Phase 7
