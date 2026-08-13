# Final report (incomplete)

Date: 2026-08-13.
Branch: `simplify-launcher` with compiler 1.3.0 generate-path wiring.

This is not a completion report. Paid N≥3, human calibration, and
downstream agent evals still do not exist.

## What is true

- Current-model vendor pages were read on 2026-08-13.
- Compiler `1.3.0` resolves vendor×tier profiles at generate time and
  appends C1–C4 branches. `BASE_COMPILER_INSTRUCTIONS` is unchanged.
- Stages A–C and E are rules-only pure functions. Stage D reuses
  project context. Stage H critique is advisory.
- v2 Anthropic judge is implemented behind `--rubric v2`. Default paid
  judge remains v1 OpenAI 0–100.
- Downstream eval is a planner. It loads `evals/fixtures/*.json`.
  No fixture repos are in the tree. Live agent execution is not built.
- CI `mini-gate` runs `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
- Last live receipts remain 1.2.1 full N=3 and 1.2.2 two-case N=3.
- 1.0.0 remains the accepted shipping quality baseline.
- Typed Prompt Library search is the user task. It is not fenced.
  Raycast fallback, command argument, and Insert actions fence evidence.

## Versus raw user input

Not measured.

## Completion gate

| Gate | Result |
| --- | --- |
| Every vendor directive in a profile or deferred with a reason | Partial. Wired as addenda. Bake-off unmeasured. |
| Guidance from current-model pages | Yes. Read 2026-08-13. |
| Profiles keyed vendor × tier at generate time | Yes |
| Four vendor conflicts branched in compiler instructions | Yes |
| No merged-conflict rendering | Unmeasured on live output |
| Context-placement versus caching measured | No |
| Profile fields cited and dated | Yes |
| Golden corpus covers classes and adversarial | Yes in extended file. Default paid plan is still 24. |
| Judge calibrated against human scores | No. `evals/calibration-v2.md` waits on human scores. |
| Downstream eval on real repos and agents | No. Dry-run skips without fixtures. |
| Generated prompts beat raw input per class | No |
| Phase 4 anti-pattern checks + failing tests | Yes. Critique is advisory, not a generate throw. |
| Injection treated as data on argument, selection, and clipboard | Yes on fallback, command argument, and Insert actions. Typed library search is not fenced |
| Full suite run; numbers from that run | No 1.3.0 live eval. Last receipts are 1.2.1/1.2.2. |
| No fabricated paths in sampled output | Unmeasured on 1.3.0 |

## What was not verified and why

Paid Anthropic/Google evals, v2 live judging, and coding-agent runs
need `--confirm-spend` and keys. Human calibration needs Alex. MacBook
Raycast paths are out of Mini scope. Do not retune the whole compiler
blob on the 1.2.x results.
