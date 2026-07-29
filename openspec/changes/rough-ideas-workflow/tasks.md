Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [ ] 1.1 Make seed saves repeat-safe, add identity-preserving edit, and cover exact, target-different, whitespace, Unicode, and linked-record cases in `test/core.test.mts`
- [ ] 1.2 Add exact duplicate discovery plus previewed confirmed consolidation with prior identifiers, unchanged history and prompt counts, cancellation, and failure coverage in `test/core.test.mts`
- [ ] 1.3 Add typed Rough Ideas launch context and register the top-level local command without an automatic save
- [ ] 1.4 Build the searchable Ready to Enhance, Enhanced, Needs Repair, empty, history-failure, and load-failure states with create, edit, delete, repair, and complete shortcuts
- [ ] 1.5 Hand one canonical idea to Enhance Prompt without a model call, rename Seed Inbox actions to Rough Ideas, and preserve the existing edited-text unlink rule

## 2. Verification

- [ ] 2.1 Snapshot real MacBook seed, enhancement-history, and linked-prompt counts before and after any confirmed duplicate migration
- [ ] 2.2 Verify capture, repeat save, edit, search, repair, history failure, duplicate review, delete confirmation, and enhancement handoff in Raycast on the MacBook
- [ ] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.4 Pass `pnpm check:store`
- [ ] 2.5 Pass `openspec validate --all --strict`
- [ ] 2.6 Record dated evidence in `docs/verification/2026-07-29-rough-ideas-workflow.md`
