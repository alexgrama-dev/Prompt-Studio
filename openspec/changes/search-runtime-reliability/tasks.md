Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Add shared Markdown fallback across Raycast, CLI, and MCP with parity for filters and ranking, no read-only rebuild, and focused index-failure coverage in `test/core.test.mts`
  - 2026-07-29: missing, stale, corrupt, combined-filter, ranking, CLI, MCP, and Store fallback checks passed; `pnpm test` passed 71/71, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.2 Render exact results before QMD work, complete an Active stale refresh afterward, and cover Disabled, unavailable, stale, and failure cases in `test/core.test.mts`
  - 2026-07-29: Disabled, stale-refresh, unavailable, and failure branches passed in the QMD checks; `pnpm test` passed 71/71, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [ ] 1.3 Calibrate one semantic rule with the named positive and negative controls and add focused automated coverage
- [ ] 1.4 Add distinct empty, no-result, and load-failure states with explicit recovery routes and prove they create no authoritative record
- [ ] 1.5 Remove MCP missed-search mutation while retaining the privacy-safe audit log and cover the read-only contract
- [ ] 1.6 Return one prompt version token, bind feedback to its exact current or historical version, and cover update and mismatch cases
- [ ] 1.7 Skip feedback-owned reads when feedback is Disabled and cover the unavailable statistics output
- [ ] 1.8 Resolve installed symlinks and the real source checkout and cover the `dist-cli/src/core` layout plus standalone bundles

## 2. Verification

- [ ] 2.1 Verify all changed Raycast states and the named controls against the real MacBook QMD collection
- [ ] 2.2 Verify CLI and MCP fallback, read-only behavior, version-bound feedback, and stale-build warning on the MacBook
- [ ] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [ ] 2.4 Pass `pnpm check:store`
- [ ] 2.5 Pass `openspec validate --all --strict`
- [ ] 2.6 Record dated evidence in `docs/verification/2026-07-29-search-runtime-reliability.md`
