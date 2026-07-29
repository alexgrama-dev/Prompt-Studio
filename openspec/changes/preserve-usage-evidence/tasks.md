Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Preserve the starting usage snapshot during explicit and automatic rebuilds, fail without replacement when it is unreadable, and cover readable, missing, and failure cases in `test/core.test.mts`
  - 2026-07-29: `SQLite search rebuild preserves recorded prompt usage` and `a rebuild leaves an unreadable index unchanged` passed; `pnpm test` passed 70/70, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.2 Label stats as recorded evidence, infer no zero-use rows when evidence is unavailable, and cover feedback-without-use plus unavailable evidence in `test/core.test.mts`
  - 2026-07-29: `stats reports usage, feedback tallies, zero-use prompts, and placeholder exposure` and `stats does not infer zero-use prompts when usage evidence is unavailable` passed; `pnpm test` passed 71/71, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.

## 2. Verification

- [x] 2.1 Capture a read-only MacBook usage snapshot before and after one rebuild and prove the recorded rows do not decrease
  - 2026-07-29: the real MacBook index remained at 0 rows and 0 total recorded uses with the same empty-snapshot SHA-256 before and after rebuilding 13 prompts; the non-zero carry-forward case passed in the shared regression.
- [x] 2.2 Pass `pnpm check` on the Mac Mini mirror
  - 2026-07-29: exit 0 with 71/71 shared tests, typecheck, lint, Raycast/CLI/MCP builds, and all runtime probes passing.
- [x] 2.3 Pass `pnpm check:store`
  - 2026-07-29: exit 0 with 3/3 Store-core tests plus package install, lint, and build passing.
- [x] 2.4 Pass `openspec validate --all --strict`
  - 2026-07-29: 19/19 changes and specifications passed strict validation.
- [x] 2.5 Record dated evidence in `docs/verification/2026-07-29-preserve-usage-evidence.md`
