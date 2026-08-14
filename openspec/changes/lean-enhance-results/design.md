## Context

Enhance Prompt already compiles, validates, and previews. Live Enhance still
ships one unjudged draft, never asks blocking questions, never recalls similar
saved prompts, records anti-patterns without blocking save, and has no
downstream fixtures. Alex’s job is one thoughts box to a lean executable brief.
`BASE_COMPILER_INSTRUCTIONS` stays unchanged.

## Goals / Non-Goals

**Goals:**

- Restore last target and last known project.
- Ask at most three blocking questions before the enhancement model call.
- Recall up to two similar library prompts as compiler few-shots only.
- Default to three judged variants. Prefer the v2 Anthropic judge.
- Show anti-pattern findings. Hard IDs block library save and editor save.
- Add three license-clean downstream fixtures with command-shaped checks.

**Non-Goals:**

- Do not retune `BASE_COMPILER_INSTRUCTIONS`.
- Do not turn on `selfReviewPass` by default.
- Do not use QMD for similar-prompt recall.
- Do not spawn live downstream agents in this change.
- Do not invent project facts from recalled prompts.

## Decisions

1. **Elicitation runs at the start of `runEnhancement`.** Research reviews can
   still happen first. No enhancement model call happens before the questions
   are answered or skipped. Skip sets `elicitationAsked` and keeps the
   missing-information compiler path. After that flag, the gap addendum does
   not say elicitation is off.

2. **Similar prompts are lexical.** `recallSimilarPrompts` uses
   `searchPromptRecords` over `listPromptsReadOnly`. Bodies clip to 800
   characters. The compiler section forbids copying their project facts.

3. **Variant judging.** Anthropic key present: v2, score `v2Mean * 25` so the
   UI stays on a 0–100 scale. Otherwise v1 OpenAI with
   `deriveEnhancementFacts`. Empty `requiredFacts` / `prohibitedInventions`
   are not allowed on variant records.

4. **Hard save gate.** Findings stay on the run. Preview shows them. Copy and
   paste stay available. Save to Prompt Library and editor save refuse on
   `fabricated-specifics`, `injection-passthrough`,
   `merged-conflict-rendering`, and `unguarded-tool-trust`. Editor re-runs
   `attachCompilerCritique` on the edited prompt.

5. **Last setup is separate from the form draft.** Explicit launch thoughts
   still skip draft restore. Last target restores only when launch did not
   name a target. Last project restores only when the form is still `none`
   and the path is discovered or recent.

6. **Downstream planner.** Empty fixture directory: `missing-fixtures`.
   Fixtures present without `--confirm-spend`: `no-confirm-spend`. Live mode
   still requires `--confirm-spend`. This change does not add a runner.

## Risks / Trade-offs

- Default `variantCount` 3 multiplies Enhance cost. The existing spend
  confirm stays in the UI.
- v2 judging needs an Anthropic key. OpenAI-only users still get v1.
- Lexical recall can miss semantic neighbors. That is accepted until QMD is
  an active required path.
- Hard save can block a useful prompt that still has one fabricated path.
  Edit before saving is the recovery path.
