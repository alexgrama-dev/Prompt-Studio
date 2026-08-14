## 1. Spec and core

- [x] 1.1 OpenSpec proposal, prompt-enhancement delta, and tasks
- [x] 1.2 Last-setup parse/save helpers
- [x] 1.3 Derive required facts and prohibited inventions from a request
- [x] 1.4 Recall up to two similar prompts from library records
- [x] 1.5 Hard anti-pattern save gate helpers
- [x] 1.6 Compiler addendum: elicitation-off only when questions were not asked
- [x] 1.7 Similar-prompt few-shot section in `enhancementCompilerInstructions`
- [x] 1.8 Variant records carry derived facts; live ranking prefers v2

## 2. Enhance Prompt UI

- [x] 2.1 Restore last target and last known project
- [x] 2.2 Blocking question form before generate
- [x] 2.3 Default `variantCount` to 3; v2 judge when Anthropic key exists
- [x] 2.4 Preview findings; block library and editor save on hard IDs

## 3. Downstream fixtures

- [x] 3.1 Bugfix, diagnose-only, and UI fixture trees with MIT licenses
- [x] 3.2 Manifests with command-shaped `successChecks`
- [x] 3.3 Update planner tests for loaded fixtures

## 4. Verification

- [x] 4.1 Unit tests for facts, recall, gate, last-setup, variants, fixtures
- [x] 4.2 `pnpm test`, `pnpm typecheck`, and `pnpm lint` on the Mini
