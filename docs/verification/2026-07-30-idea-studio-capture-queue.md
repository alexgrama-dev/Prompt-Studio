# Idea Studio Capture Queue — Verification

Date: 2026-07-30

## Outcome

- The implementation and full automated check ran on Alex’s Mac mini
  (`Mac16,10`, `Alexs-Mac-mini.local`).
- Idea Studio now stores Next Prompt, Keep, and Idea types in local Markdown.
  Earlier Markdown without a type remains readable as an active Idea.
- Active Next Prompt items appear under Up Next. Active Keep and Idea items
  appear under Saved for Later. Completed items appear under Completed.
- Paste, Complete or Restore, Enhance, Generate Title, Capture, and Organize
  are separate actions. Paste does not complete the item.
- Quick Capture is an auxiliary command. It prefers explicit text, then
  selected text, then clipboard text, and defaults to Next Prompt.
- Convert to Prompt shows editable title, prompt text, and target before it
  writes one linked library prompt.

## Mac Mini Live Raycast Evidence

Computer Use verified these real Raycast flows:

1. A reviewed manual Next Prompt appeared under Up Next.
2. Capture Clipboard read the exact TextEdit sentence, defaulted its type to
   Keep, and wrote nothing until Save Item. The saved item appeared under Saved
   for Later.
3. Quick Capture saved explicit text as a Next Prompt and the queue moved from
   one to two Up Next items.
4. Complete moved the selected item to Completed with a completion time.
   Restore returned the same item to Up Next.
5. Convert to Prompt opened a review form with the exact title, body, and
   target, then created one linked main-library prompt.
6. Enhance Item opened Enhance Prompt. Because enhancement is Disabled, the
   screen confirmed that no model request or credential lookup occurred.
7. Chrome was confirmed as macOS’s real frontmost application. Paste in Active
   App inserted the exact captured sentence into Chrome’s focused address bar.
   Reopening Idea Studio still showed two Up Next items, proving Paste did not
   Complete.
8. The temporary records were moved to
   `/Users/alexgrama/.Trash/Prompt Studio verification 2026-07-30 0609`.
   They remain recoverable, and reloading Idea Studio returned the local queue
   to No Captured Items Yet.

## Automated Evidence

- `pnpm check`: passed.
  - 90 tests passed, 0 failed.
  - TypeScript, ESLint, Raycast build, CLI build, MCP build, MCP runtime and
    mutation checks, feedback checks, and optimization checks passed.
- `pnpm check:store`: passed.
  - 3 Store checks passed, 0 failed.
  - Store lint and Store build passed.
- `openspec validate --all --strict`: 21 passed, 0 failed.
- Focused checks cover type validation and Markdown round-trip, the legacy Idea
  default, reviewed legacy typing, queue grouping, completion and restore,
  type-aware duplicate identity, capture input priority, and repeat-safe prompt
  conversion (a second conversion reuses the first prompt).

## MacBook Pro Mirror

Pending committed-branch synchronization and runtime verification.
