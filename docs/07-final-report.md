# Final report (incomplete)

Date: 2026-08-13.
Branch: `compiler-rebuild`.

This is not a completion report. Measurements that the gate requires
do not exist yet.

## What is true

- Current-model vendor pages were read on 2026-08-13. Rules, conflicts,
  and a versioned tier map are in `docs/00-ground-truth.md`.
- The 24-case 0–100 eval remains the frozen default plan. 36 additive
  cases live in `evals/cases-extended.json` (`corpus: "all"` ≥ 60).
- The judge now receives supplied project files as not-an-invention
  and does not score product-appended Execution Guardrails as padding.
  `--repeats` is wired. Flip rates land in `reviewSummary` after
  review when N>1. Live N≥3 re-run has not been paid for.
- Compiler text is still `prompt-studio-compiler/1.2.1`. Profiles are
  documented, not wired into generate.
- Phase 4 anti-pattern checks live in `src/core/anti-patterns.ts` with
  a failing fixture per class. They are not yet in the generate path.

## Versus raw user input

Not measured. No downstream agent eval. No v2 judge calibration.

## Completion gate

| Gate | Result |
| --- | --- |
| Every vendor directive in a profile or explicitly deferred | partial (documented, not implemented in generate) |
| Guidance from current-model pages | yes |
| Profiles keyed vendor × tier at generate time | no |
| Four conflicts branched in emitted prompts | no (documented only) |
| No merged-conflict rendering | unmeasured |
| Context-placement vs caching measured | no |
| Profile fields cited + dated | yes in `docs/03-rendering-profiles.md` |
| Golden corpus covers classes + adversarial | yes in extended file; default plan still 24 |
| Judge calibrated vs human, agreement reported | no |
| Downstream e2e on real repos and agents | no |
| Generated prompts beat raw input per class | no |
| Phase 4 anti-pattern checks + failing tests | yes (detector only; not in generate) |
| Injection treated as data on three surfaces | detector + fence helper yes; Enhance Prompt does not read clipboard/selection |
| Full suite run; numbers from that run | no live eval this branch |
| No fabricated paths in sampled output | unmeasured |

## What was not verified and why

Paid OpenAI/Anthropic evals and real coding-agent runs wait on Mini
policy (no `pnpm build`/`dev`) and on Honcho: live tests after offline
checks. Human calibration slice not scored. Rams unavailable.
