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
  review when N>1.
- Live OpenAI Standard N=3 on compiler 1.2.1 ran on 2026-08-13.
  Receipt: `evals/runs/2026-08-13T08-27-15.482Z--openai-standard-v1.json`.
  Average 98.1. `passing` is false. 7/24 cases still flip. Protected
  injection majority-fails. Details in
  `docs/verification/2026-08-13-compiler-1-2-1-n3-eval.md`.
- Compiler 1.2.2 adds a generate-path untrusted emit policy. A
  targeted OpenAI Standard N=3 on two cases ran on 2026-08-13.
  Receipt: `evals/runs/2026-08-13T09-14-02.668Z--openai-standard-v1.json`.
  `protected-untrusted-reference` passed 3/3. `dev-test-flake` still
  majority-fails. Details in
  `docs/verification/2026-08-13-compiler-1-2-2-two-case-n3-eval.md`.
  Do not accept 1.2.2 as the shipping baseline. 1.0.0 remains accepted.
- Profiles are documented, not wired into generate.
- Phase 4 anti-pattern checks live in `src/core/anti-patterns.ts`.
  `applyUntrustedEmitPolicy` runs in the three generate adapters.
  `detectAntiPatterns` is still not a generate gate.

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
| Phase 4 anti-pattern checks + failing tests | yes (detector plus generate-path emit policy) |
| Injection treated as data on three surfaces | generate-path strip + paraphrase yes; Enhance Prompt still does not read clipboard/selection |
| Full suite run; numbers from that run | 1.2.1 full N=3 plus 1.2.2 two-case N=3; see verification notes |
| No fabricated paths in sampled output | `dev-ui-empty-state` used `src/browse-prompts.ts` vs allowed `.tsx` |

## What was not verified and why

Paid Anthropic/Google evals and real coding-agent runs still lack
keys or fixtures. Human calibration slice not scored. Rams unavailable.
Do not retune the whole compiler blob on the 1.2.1 or 1.2.2 results.
