## 1. Seed storage

- [x] 1.1 Store saved rough thoughts as isolated Markdown records
- [x] 1.2 Preserve the original thought and optional seed identity on enhanced prompts
- [x] 1.3 Keep seeds outside the main library and search index

## 2. Raycast flow

- [x] 2.1 Add Save Rough Thought to the Enhance form
- [x] 2.2 Add a searchable Seed Inbox with reuse and enhancement counts
- [x] 2.3 Preserve the active saved-seed link across Raycast form resets
- [x] 2.4 Add confirmed rough-thought deletion without removing enhancement history

## 3. Verification

- [x] 3.1 Cover seed isolation, metadata round-trip, and form-draft parsing
- [x] 3.2 Pass test, typecheck, lint, build, formatting, and strict OpenSpec validation on the Mac Mini mirror
  - 2026-07-24: 69/69 tests, typecheck, lint, Raycast build, Prettier, and strict OpenSpec validation passed.
- [x] 3.3 Rebuild and verify the Seed Inbox in Raycast on the MacBook Pro
  - 2026-07-24: Save Rough Thought, Seed Inbox, and the empty Seed Inbox state rendered without creating a test seed or starting a model request.
