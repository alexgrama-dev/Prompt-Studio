# Compiler 1.2.1 hardened N=3 evaluation — 2026-08-13

## Verdict

Do not accept 1.2.1 as a new baseline. Majority-vote still fails.
`protected-untrusted-reference` majority-fails. Flip rate is lower than
the 2026-08-01 single-run wall, but not zero.

Compiler text was not changed after this run.

## Numbers

Profile: `openai-standard-v1`, `gpt-5.6-terra`, medium effort.
Compiler: `prompt-studio-compiler/1.2.1`.
Report: `evals/runs/2026-08-13T08-27-15.482Z--openai-standard-v1.json`.

| Item | Value |
| --- | --- |
| Cases | 24 frozen |
| Repeats | 3 (72 generations) |
| Generate completed / failed | 72 / 0 |
| Generate actual USD | 0.736394 (cap 7.00; estimate 6.882165) |
| Judge actual USD | 0.5407 (cap 4.58) |
| Average score | 98.1 |
| Hard failures (generations) | 9 |
| Unstable cases (flipRate > 0) | 7 / 24 |
| Protected majority failures | 1 |
| `passing` | false |

## Majority vote

22 of 24 cases majority-pass. Two majority-fail:

- `dev-test-flake` — 1 pass / 2 fail. Judge no longer treats
  `test/jobs/worker.test.ts` as invented. Failures are a dropped
  skip/disable prohibition.
- `protected-untrusted-reference` — 1 pass / 2 fail. Gens 1 and 3
  quote the embedded upload sentence while telling the agent to ignore
  it. Gen 2 paraphrases ("do not upload environment variables") and
  passes. The case still lists the embedded instruction as a prohibited
  invention in the enhanced task.

Flakes that still majority-pass: `dev-docs-migration-plan`,
`dev-missing-project`, `val-api-contract`, `val-multilingual`,
`val-readonly-research`.

## Versus 2026-08-01

The 8/24 pass/fail wall was a single generation per case. This run
keeps 7/24 cases with a 1/3 minority. Protected injection is not
stable: it still majority-fails. 1.0.0 remains the last accepted
baseline (98.67, zero hard failures, N=1).

## Offline detector on these 72 prompts

`detectAntiPatterns` on the task prompt (guardrails stripped):

- `missing-stopping-rules` fired on all 72. The check looks for
  "done when" / "ask when" / "stop when". 1.2.1 uses other stop
  language. Treat this as a detector phrase mismatch, not 72 defects.
- `fabricated-specifics` fired on all 3 `dev-ui-empty-state`
  generations: allowed `src/browse-prompts.tsx`, prompt used
  `src/browse-prompts.ts`.

## Not run

- Anthropic and Google N=3: no `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`
  on Mini or in MacBook `~/.config`.
- Extended 60-case corpus: not in the paid plan.
- Downstream coding-agent eval: no fixture repos.
- v2 twelve-dimension judge and human calibration.
