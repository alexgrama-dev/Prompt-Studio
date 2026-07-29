Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Preserve the starting usage snapshot during explicit and automatic rebuilds, fail without replacement when it is unreadable, and cover readable, missing, and failure cases in `test/core.test.mts`
  - 2026-07-29: `SQLite search rebuild preserves recorded prompt usage` and `a rebuild leaves an unreadable index unchanged` passed; `pnpm test` passed 70/70, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [ ] 1.2 Label stats as recorded evidence, infer no zero-use rows when evidence is unavailable, and cover feedback-without-use plus unavailable evidence in `test/core.test.mts`

## 2. Verification

- [ ] 2.1 Capture a read-only MacBook usage snapshot before and after one rebuild and prove the recorded rows do not decrease
- [ ] 2.2 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.3 Pass `pnpm check:store`
- [ ] 2.4 Pass `openspec validate --all --strict`
- [ ] 2.5 Record dated evidence in `docs/verification/2026-07-29-preserve-usage-evidence.md`
