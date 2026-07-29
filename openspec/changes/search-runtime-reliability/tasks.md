Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Add shared Markdown fallback across Raycast, CLI, and MCP with parity for filters and ranking, no read-only rebuild, and focused index-failure coverage in `test/core.test.mts`
  - 2026-07-29: missing, stale, corrupt, combined-filter, ranking, CLI, MCP, and Store fallback checks passed; `pnpm test` passed 71/71, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.2 Render exact results before QMD work, complete an Active stale refresh afterward, and cover Disabled, unavailable, stale, and failure cases in `test/core.test.mts`
  - 2026-07-29: Disabled, stale-refresh, unavailable, and failure branches passed in the QMD checks; `pnpm test` passed 71/71, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.3 Calibrate one semantic rule with the named positive and negative controls and add focused automated coverage
  - 2026-07-29: a later live prompt exposed generic vector-query inflation. Removing that generic text produced relevant scores of 0.430 and 0.376 and a strongest negative of 0.210. The 0.35 rule retained both relevant prompts and rejected all three controls. `pnpm test` passed 85/85, and `pnpm typecheck` and `pnpm lint` exited 0.
- [x] 1.4 Add distinct empty, no-result, and load-failure states with explicit recovery routes and prove they create no authoritative record
  - 2026-07-29: pure state checks distinguish loading, load failure, empty library, no result, and filtered-empty states; Enhance and Idea Studio handoffs preserve the exact query and call no save function. `pnpm test` passed 77/77, `pnpm typecheck` exited 0, and `pnpm lint` exited 0.
- [x] 1.5 Remove MCP missed-search mutation while retaining the privacy-safe audit log and cover the read-only contract
  - 2026-07-29: a zero-result MCP search leaves missed-search data unchanged while its bounded audit records the zero-result read. `pnpm test` passed 80/80, and `pnpm typecheck` and `pnpm lint` exited 0.
- [x] 1.6 Return one prompt version token, bind feedback to its exact current or historical version, and cover update and mismatch cases
  - 2026-07-29: retrieval returns a stable version token; valid historical feedback preserves the retrieved body, while mismatched evidence writes nothing. `pnpm test` passed 80/80, and `pnpm typecheck`, `pnpm lint`, and the MCP build exited 0.
- [x] 1.7 Skip feedback-owned reads when feedback is Disabled and cover the unavailable statistics output
  - 2026-07-29: Disabled statistics succeed against an unreadable feedback path and mark feedback plus missed searches unavailable. `pnpm test` passed 81/81, and `pnpm typecheck` and `pnpm lint` exited 0.
- [x] 1.8 Resolve installed symlinks and the real source checkout and cover the `dist-cli/src/core` layout plus standalone bundles
  - 2026-07-29: freshness checks follow installed symlinks, ignore copied compiled source, warn for a stale checkout bundle, and stay silent for standalone bundles. `pnpm test` passed 82/82, and `pnpm typecheck` and `pnpm lint` exited 0.

## 2. Verification

- [ ] 2.1 Verify all changed Raycast states and the named controls against the real MacBook QMD collection
- [x] 2.2 Verify CLI and MCP fallback, read-only behavior, version-bound feedback, and stale-build warning on the MacBook
  - 2026-07-29: a missing-index CLI search returned the Markdown result without creating the index; the MCP mutation verifier passed its version-bound feedback and confirmation checks; the installed CLI symlink reported and then cleared a deliberately induced stale-build warning.
- [x] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [x] 2.4 Pass `pnpm check:store`
- [x] 2.5 Pass `openspec validate --all --strict`
- [x] 2.6 Record dated evidence in `docs/verification/2026-07-29-search-runtime-reliability.md`
