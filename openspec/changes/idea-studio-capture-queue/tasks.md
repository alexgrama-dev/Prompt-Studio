Each implementation task is complete only after `pnpm test`,
`pnpm typecheck`, and `pnpm lint` exit 0.

## 1. Shared behavior

- [x] 1.1 Add validated optional capture kind and completion metadata while
  treating earlier idea Markdown as an active Idea
- [x] 1.2 Keep repeat saves and exact duplicate review type-aware, and add
  repeat-safe conversion from one captured item to one library prompt
- [x] 1.3 Add focused public-interface checks for metadata round-trip, legacy
  defaults, queue grouping, completion and restore, type-aware identity, and
  repeat-safe conversion

## 2. Raycast experience

- [x] 2.1 Replace Ready to Enhance and Enhanced grouping with Up Next, Saved
  for Later, Completed, and Needs Repair while retaining enhancement evidence
- [x] 2.2 Add reviewed manual and clipboard capture with an editable item type
- [x] 2.3 Add separate Paste, Complete or Restore, Copy, Enhance, Convert,
  Edit, Generate Title, Delete, and recovery actions with conflict-free
  shortcuts
- [x] 2.4 Add an auxiliary Quick Capture no-view command that prefers explicit
  text, then selected text, then clipboard text and performs no network work

## 3. Verification

- [x] 3.1 Pass `pnpm check` on the Mac mini
- [x] 3.2 Pass `pnpm check:store` on the Mac mini
- [x] 3.3 Pass `openspec validate --all --strict`
- [x] 3.4 Verify the complete Raycast flow on the Mac mini with Computer Use
- [ ] 3.5 Synchronize the committed branch to the MacBook Pro and verify the
  actual Raycast runtime there
- [ ] 3.6 Record dated evidence in
  `docs/verification/2026-07-30-idea-studio-capture-queue.md`
