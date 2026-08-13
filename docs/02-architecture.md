# Pipeline architecture

Date: 2026-08-13.
Depends on: `docs/00-ground-truth.md`, `docs/01-eval-harness.md`.
Status: contracts. Stages that do not move a measured score do not ship
as extra model calls.

## Current composition (as-is)

Today the compiler is one instruction blob plus two target paragraphs,
a vendor×tier rendering addendum, a rules-based task/gap addendum, then
a provider JSON-schema call, then local Execution Guardrails.

```
Rough thoughts + target + optional project
  → normalizeCapture / classifyTask / analyzeGaps (no extra model call)
  → resolveRenderingProfile(target)
  → enhancementCompilerInstructions()
  → provider generate (OpenAI / Anthropic / Google)
  → optional reviewer pass
  → validateEnhancementResult
  → attachCompilerCritique (advisory)
  → appendExecutionGuardrails
  → preview / copy / paste / save
```

That path stays until eval shows a named failure a new stage would fix.

## Target composition

Pure functions, typed contracts, independently testable. Optional
stages skip with a defined degrade, never a failed generation.

| Stage | Contract in | Contract out | Model call? |
| --- | --- | --- | --- |
| A Capture | argument, selection, clipboard, launchContext | NormalizedInput (text, language, evidence tags) | no |
| B Classify | NormalizedInput | TaskLabel {class, scope, certainty, risk, verifiability, confidence} | only if rules fail; start with rules |
| C Gaps | TaskLabel + input | Gap[] bucketed discoverable / inferable / blocking | no, then optional |
| D Context | optional repo path | ProjectFacts (commands, manifests) as untrusted data | no |
| E Elicit | blocking gaps | at most 3 skippable questions, or stated assumptions | no |
| F Profile | preference target | TargetProfile (vendor × tier) | no |
| G Compose | blocks + profile + facts | assembled prompt | one generate |
| H Critique | assembled + rubric | at most one revision | one, if preference on |
| I Render | compiled result | Raycast preview, clipboard, paste, history | no |

## Taxonomy (from corpus, not intuition)

Task class: bugfix, feature, refactor, migration, performance, test,
audit, investigation, infrastructure, data, design-ui, documentation.

Scope: line, file, multi-file, cross-cutting, greenfield.

Certainty: known-end-state vs discovery-first.

Risk: reversible-local vs destructive-or-shared.

Verifiability: test, build, browser, human-only.

Low classifier confidence routes to elicitation, not a wrong template.

## Existing modules to reuse

| Need | Module |
| --- | --- |
| Input launch | `launch-context.ts`, Prompt Library search, nested Enhance Prompt and Capture Inbox |
| Project facts | `project-context.ts` (read-only Git) |
| Untrusted research | `research-safety.ts` |
| Generate | `enhancement.ts` / dispatch |
| Review pass | `revision.ts` (already optional) |
| Guardrails | `appendExecutionGuardrails` |
| History | enhancement history in `prompt-store.ts` |

Do not add a classifier model call until a labeled holdout shows rules
failing. Do not add elicitation UI until eval shows assumption-only
losing to questions by more than the interruption cost.

## Data flow

Stable compiler instructions (cache prefix) → schema → tools none →
per-request user payload last (cache suffix). Anthropic emitted prompts
may still put long evidence before the task statement (C1). Those two
orders are different layers. See conflict C6; unmeasured.

## Open

- Whether Stage B is rules-only for v1 of the rebuild.
- Cursor / Windsurf as PromptTarget values.
- Raycast `AI.ask` as a generator (decision A in ground truth: no).
