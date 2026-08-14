## Why

Alex’s job is to jot rough thoughts and get a prompt that makes Codex or
Claude Code finish the work. Prompt Studio already compiles, validates, and
previews. Live Enhance still ships one unjudged draft, never asks blocking
questions, never recalls similar saved prompts, records anti-patterns without
blocking save, and has no downstream fixtures. OpenAI’s GPT-5.6 guide and
Anthropic’s context-engineering note both say lean executable briefs beat
long templates. This change implements that path without thickening
`BASE_COMPILER_INSTRUCTIONS`.

## What Changes

1. Remember last Enhance target and project and restore them when launch
   does not name a target.
2. Ask at most three blocking questions before generate when the compiler
   stage plan has blocking gaps or low class confidence. Answers append to
   the thoughts. Skip keeps the missing-information path.
3. Recall up to two similar library prompts as compiler few-shots only.
   Do not dump them into the enhanced prompt.
4. Default judged variants to 3. Prefer the v2 Anthropic judge. Fall back
   to the v1 OpenAI judge. Derive required facts and prohibited inventions
   from this request.
5. Show anti-pattern findings on preview. Hard IDs block Save to Prompt
   Library until an edit clears them. Copy and paste stay available.
6. Add three license-clean downstream fixture repos with command-shaped
   success checks. Live agent runs still require `--confirm-spend`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: last-used setup, live elicitation, similar-prompt
  few-shots, judged-variant default, v2 live judge with derived facts,
  hard anti-pattern save gate, downstream fixtures.

## Impact

- Raycast Enhance Prompt form, preview, and editor save.
- Shared core: facts, recall, last-setup, variant ranking, compiler
  addenda. `BASE_COMPILER_INSTRUCTIONS` stays unchanged.
- `evals/fixtures/` gains three original MIT fixture trees.
- Default variant count raises Enhance cost. Confirm spend stays in the UI.
- No new provider, database, or activation slot.
