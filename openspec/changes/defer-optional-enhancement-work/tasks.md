Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Guard optional enhancement credentials and payloads by capability state, block Disabled provider selection, and recover stale provider drafts with focused coverage in `test/core.test.mts`
- [x] 1.2 Remove Context7 from the shared command preference read, use the existing environment value only for an approved request, and cover initial-render, Disabled, missing-key, and no-fallback cases
- [x] 1.3 Defer local and SSH project discovery to one explicit load while keeping None and exact-folder selection available, with first-render, repeat-load, and SSH-failure coverage

## 2. Verification

- [ ] 2.1 Verify the initial form, Disabled providers, explicit project load, exact-folder choice, and SSH failure in Raycast on the MacBook
- [x] 2.2 Prove Disabled Context7 causes no credential read or network request
  - 2026-07-29: focused checks instrumented credential and request boundaries; Disabled performed neither operation, while missing-key and reviewed-request paths stopped without fallback.
- [x] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [x] 2.4 Pass `pnpm check:store`
- [x] 2.5 Pass `openspec validate --all --strict`
- [x] 2.6 Record dated evidence in `docs/verification/2026-07-29-defer-optional-enhancement-work.md`
