Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [ ] 1.1 Make idea saves repeat-safe, add identity-preserving edit and AI-title provenance, and cover exact, target-different, whitespace, Unicode, title, and linked-record cases in `test/core.test.mts`
- [ ] 1.2 Add a bounded OpenAI idea-title request with strict validation, editable review, shared encrypted preference, manual fallback, no fallback provider, and failure coverage in `test/core.test.mts`
- [ ] 1.3 Add exact duplicate discovery plus previewed confirmed consolidation with prior identifiers, unchanged history and prompt counts, cancellation, and failure coverage in `test/core.test.mts`
- [ ] 1.4 Add typed Idea Studio launch context and register the third top-level view command without an automatic save
- [ ] 1.5 Build the searchable Ready to Enhance, Enhanced, Needs Repair, empty, history-failure, and load-failure states with AI title creation, edit, delete, repair, shallow task submenus, and complete shortcuts
- [ ] 1.6 Hand one canonical idea to Enhance Prompt without a model call, rename Seed Inbox and Rough Ideas labels to Idea Studio, and preserve the existing edited-text unlink rule

## 2. Verification

- [ ] 2.1 Snapshot real MacBook seed, enhancement-history, and linked-prompt counts before and after any confirmed duplicate migration
- [ ] 2.2 Verify the three Raycast entries plus AI title generation and review, manual fallback, repeat save, edit, search, shallow submenus, repair, history failure, duplicate review, delete confirmation, and enhancement handoff on the MacBook
- [ ] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.4 Pass `pnpm check:store`
- [ ] 2.5 Pass `openspec validate --all --strict`
- [ ] 2.6 Record dated evidence in `docs/verification/2026-07-29-rough-ideas-workflow.md`
