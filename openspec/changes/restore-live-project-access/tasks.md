Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0.

## 1. Implementation

- [x] 1.1 Automatically discover configured projects once when enabled
- [x] 1.2 Keep Disabled free of local scans and SSH requests
- [x] 1.3 Add a race-safe Refresh Projects action
- [x] 1.4 Default the Mac Mini source to `mini:~/Developer`

## 2. Verification

- [x] 2.1 Pass Mac Mini tests, typecheck, lint, and strict OpenSpec validation
- [x] 2.2 Verify MacBook and Mac Mini repository discovery from the MacBook
- [ ] 2.3 Build and inspect the Project picker on the MacBook Pro
