Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0 and its dated evidence is added.

## 1. Implementation

- [x] 1.1 Add the completion-aware draft boundary, in-memory history retry, and explicit-launch priority with focused coverage in `test/core.test.mts`
- [x] 1.2 Add one digest-checked, repeat-safe history-to-library path and cover unchanged restart saves plus one normal version for an approved edit
- [x] 1.3 Show invalid Seed Inbox and Enhancement History records with recovery actions while preserving valid and invalid files
- [x] 1.4 Report cancellation truthfully and cover cancellation, provider failure, validation failure, and history-write failure
- [x] 1.5 Make CLI enhancement history-first and two-step, preserving original-thought and unchanged seed evidence with focused coverage
- [x] 1.6 Make MCP enhancement history-first and two-step, rejecting one-call save before credential access or model cost with focused coverage

## 2. Verification

- [ ] 2.1 Verify draft clearing, cancellation, repeat-safe save, Seed Inbox, and Enhancement History in Raycast on the MacBook
- [ ] 2.2 Verify the two-step CLI and MCP enhancement flow on the MacBook
- [x] 2.3 Pass `pnpm check` on the Mac Mini mirror
- [x] 2.4 Pass `pnpm check:store`
- [x] 2.5 Pass `openspec validate --all --strict`
- [x] 2.6 Record dated evidence in `docs/verification/2026-07-29-complete-enhancement-lifecycle.md`
