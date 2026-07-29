Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [ ] 1.1 Record the `q + 15` benchmark, initialize Browse from first-fallback text, paste only one unique exact full-identifier, title, or alias match without placeholders, and cover ambiguous, partial, semantic, archived, placeholder, and no-result safety in `test/launch-context.test.mts`
- [x] 1.2 Add the live filled-body preview and opt-in remembered non-sensitive values, including prompt-version invalidation, secret rejection, storage failure, forget, repeated, and blank coverage in `test/core.test.mts`
  - 2026-07-29: the form previews the exact filled body, restores only current safe values after a successful use, and tolerates read, write, and removal failures. `pnpm test` passed 79/79, and `pnpm typecheck`, `pnpm lint`, and the Raycast build exited 0.
- [x] 1.3 Add Paste and Copy to enhancement preview and history, and prove neither action saves a library prompt
  - 2026-07-29: preview and history use direct Clipboard actions while the existing core check keeps completed enhancements outside the main library until the separate Save action. `pnpm test` passed 79/79, and `pnpm typecheck`, `pnpm lint`, and the Raycast build exited 0.
- [x] 1.4 Add the one-time last-library-paste pointer and menubar rating flow, including Preview, Active, Disabled, retry, duplicate, and no-paste cases in `test/core.test.mts`
  - 2026-07-29: the pointer stores no body, Disabled performs no storage access, failed feedback stays retryable, and exact prior feedback prevents duplicates. `pnpm test` passed 80/80, and `pnpm typecheck`, `pnpm lint`, and the Raycast build exited 0.
- [x] 1.5 Reorganize Prompt Studio and Enhance Prompt actions into one-level task submenus, keep each primary action visible, and give every action in the six named changed panels a native or explicit conflict-free shortcut
  - 2026-07-29: Browse, no-result, placeholder, enhancement preview, enhancement history, and Rate Last Prompt panels retain their primary actions and expose shallow task groups with lint-clean shortcuts. `pnpm test` passed 80/80, and `pnpm typecheck`, `pnpm lint`, and the Raycast build exited 0.

## 2. Verification

- [ ] 2.1 Prove the same exact first-paste query falls from `q + 15` to `q + 2` and verify all changed Raycast panels on the MacBook
- [ ] 2.2 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.3 Pass `pnpm check:store`
- [ ] 2.4 Pass `openspec validate --all --strict`
- [ ] 2.5 Record dated evidence in `docs/verification/2026-07-29-fast-daily-reuse.md`
