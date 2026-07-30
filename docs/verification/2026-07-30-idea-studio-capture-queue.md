# Idea Studio Capture Queue — Verification

Date: 2026-07-30

## Outcome

- The implementation and full automated check ran on Alex’s Mac mini
  (`Mac16,10`, `Alexs-Mac-mini.local`).
- Idea Studio now stores Next Prompt, Keep, and Idea types in local Markdown.
  Earlier Markdown without a type remains readable as an active Idea.
- Active Next Prompt items appear under Up Next. Active Keep and Idea items
  appear under Saved for Later. Completed items appear under Completed.
- Every captured-item action is visible at the first level. The menu is split
  into Use, Improve, Add, and Maintenance; Delete Item is under Maintenance.
  Paste and Complete remain separate, so Paste does not complete the item.
- Quick Capture is an auxiliary command with no argument form. It immediately
  saves selected text, or clipboard text when no selection exists, as a Next
  Prompt.
- Convert to Prompt shows editable title, prompt text, and target before it
  writes one linked library prompt.
- Identical captures that arrive at the same time now resolve to one Markdown
  file. A conflicting file is rejected and preserved instead of overwritten.
- Long generated titles no longer split an emoji at the clipping boundary.

## Mac Mini Live Raycast Evidence

Computer Use verified these real Raycast flows:

1. A reviewed manual Next Prompt appeared under Up Next.
2. Capture Clipboard read the exact TextEdit sentence, defaulted its type to
   Keep, and wrote nothing until Save Item. The saved item appeared under Saved
   for Later.
3. After the rebuild, Raycast showed Quick Capture as an immediate command with
   no text or type fields. Running it reached the repeat-safe save path and
   showed `Next Prompt already captured`. Focused tests cover the
   selected-text-before-clipboard order.
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

- `pnpm test`: 94 passed, 0 failed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `openspec validate --all --strict`: 21 passed, 0 failed.
- The capture race, identity-conflict, and Unicode-boundary tests passed in 50
  consecutive focused runs.
- The complete 94-test suite passed in 10 consecutive runs.
- Coverage was 90.37% of lines and 71.10% of branches overall. The two changed
  core files reached 91.52% and 92.86% line coverage.
- Three CodeRabbit review passes completed with no findings. The third ran
  successfully after the service's required rate-limit delay.
- Focused checks also cover malformed capture kinds, Markdown round-trip, the
  legacy Idea default, queue grouping, completion and restore, capture input
  priority, and repeat-safe prompt conversion.

## MacBook Pro Mirror

- Alex’s MacBook Pro was confirmed as `Mac16,8`, host
  `Alexs-MacBook-Pro`.
- The clean `cdx/prompt-studio-daily-use` mirror fast-forwarded from `4da871b`
  to `37dce8c`.
- `pnpm build` compiled and type-checked all five entry points: Prompt Studio,
  Enhance Prompt, Idea Studio, Quick Capture, and Most-Used Prompts.
- `pnpm dev` launched the Raycast development runtime from
  `/Users/alexgrama/Developer/prompt-studio`; its Node process and Raycast
  Extension Helper were both running.
- The MacBook worktree remained clean and matched the pushed commit after the
  runtime check.
