Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Make idea saves repeat-safe, add identity-preserving edit and AI-title provenance, and cover exact, target-different, whitespace, Unicode, title, and linked-record cases in `test/core.test.mts`
  - 2026-07-29: normalized repeat saves reuse the oldest matching identity while preserving the first exact body and title; target, whitespace, Unicode, AI-title round-trip, edit, and linked-record checks passed. `pnpm test` passed 73/73, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.2 Add a bounded OpenAI idea-title request with strict validation, editable review, shared encrypted preference, manual fallback, no fallback provider, and failure coverage in `test/core.test.mts`
  - 2026-07-29: the exact idea and target are sent only after Generate AI Title, the reviewed title stays editable, manual fallback remains local, and missing-key, malformed-title, incomplete, refusal, and HTTP failure checks passed with no provider fallback. The OpenAI password is now one inherited extension preference. `pnpm test` passed 76/76, `pnpm typecheck` and `pnpm lint` exited 0, and the Raycast build passed.
- [x] 1.3 Add exact duplicate discovery plus previewed confirmed consolidation with prior identifiers, unchanged history and prompt counts, cancellation, and failure coverage in `test/core.test.mts`
  - 2026-07-29: read-only preview, target separation, oldest-record retention, prior-identifier resolution, invalid-review rejection, and unchanged enhancement-history and prompt counts passed. `pnpm test` passed 75/75, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.4 Add typed Idea Studio launch context and register the third top-level view command without an automatic save
  - 2026-07-29: the manifest exposes exactly Prompt Studio, Enhance Prompt, and Idea Studio as view commands; typed launch checks preserve exact unsaved text and write nothing. `pnpm test` passed 76/76, `pnpm typecheck` and `pnpm lint` exited 0, and the Raycast build passed.
- [x] 1.5 Build the searchable Ready to Enhance, Enhanced, Needs Repair, empty, history-failure, and load-failure states with AI title creation, edit, delete, repair, shallow task submenus, and complete shortcuts
  - 2026-07-29: the native Raycast list, forms, reviewed title, partial-history state, repair routes, Idea and Organize submenus, confirmations, and shortcut set compile in the four-entry production build. `pnpm test` passed 76/76, `pnpm typecheck` and `pnpm lint` exited 0.
- [x] 1.6 Hand one canonical idea to Enhance Prompt without a model call, rename Seed Inbox and Rough Ideas labels to Idea Studio, and preserve the existing edited-text unlink rule
  - 2026-07-29: Idea Studio hands exact text, target, and seed identity to Enhance Prompt; launch-context coverage passed, the form still clears the link after edited text, and retired user-facing labels are absent from source. `pnpm test` passed 76/76, `pnpm typecheck` and `pnpm lint` exited 0.

## 2. Verification

- [ ] 2.1 Snapshot real MacBook seed, enhancement-history, and linked-prompt counts before and after any confirmed duplicate migration
- [ ] 2.2 Verify the three Raycast entries plus AI title generation and review, manual fallback, repeat save, edit, search, shallow submenus, repair, history failure, duplicate review, delete confirmation, and enhancement handoff on the MacBook
- [ ] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.4 Pass `pnpm check:store`
- [ ] 2.5 Pass `openspec validate --all --strict`
- [ ] 2.6 Record dated evidence in `docs/verification/2026-07-29-rough-ideas-workflow.md`
