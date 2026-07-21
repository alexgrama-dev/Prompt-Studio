# Daily Ergonomics Implementation

Date: 2026-07-21  
Change: `daily-ergonomics` (open)  
Build and test host: Mac Mini mirror at `~/Developer/work/prompt-studio`

## What shipped

1. **Paste-first use.** Paste into the frontmost application is the primary
   prompt action; Copy is second. Both record a use event when the index is
   active, and a missing index never blocks the paste.
2. **Usage-ranked ordering.** The empty-query SQLite ordering already ranked
   by favorite, then last use, then update time; this is now covered by a
   shared test, and `rankRecordsByUsage` provides the same ordering for
   surfaces without the index.
3. **Quick Enhance.** The Enhance Prompt command accepts an optional
   rough-thoughts argument from Raycast root search and prefills the form
   from the argument or fallback text.
4. **Placeholders.** `{{name}}` tokens in a prompt body open a fill form
   before paste or copy. Blank values keep their token visible instead of
   silently deleting content.
5. **Menubar.** A new menu-bar command lists the five most-used prompts for
   one-click copy, with unavailable-library and empty states.
6. **Feedback nudge.** Every fifth use of the same prompt appends a passive
   feedback suggestion to the paste or copy confirmation.
7. **Content pass (no model calls).** The five earlier imports gained aliases
   and hidden search terms; four more self-contained prompts were imported
   (refactor planning, session learnings, issue triage, ubiquitous-language
   glossary). The library now holds 14 valid records, QMD re-embedded them,
   and an alias query (`domain glossary`) returns the intended record.

## Automated evidence

- Mac Mini `pnpm check` exit 0: 57/57 shared tests (including the new usage
  and placeholder test), TypeScript, ESLint, Raycast build with the third
  menubar entry point, CLI and MCP builds, and all five runtime probes.
- MacBook: `pnpm build` compiled all three commands; Prettier clean; strict
  OpenSpec validation passed for the `daily-ergonomics` change.
- Library snapshots committed and pushed to the private prompt-library repo.

## Remaining rendered verification (task 7.2)

The following need eyes on the MacBook before the change is archived:

1. Enter on a prompt pastes into the frontmost app and shows the HUD.
2. A prompt containing `{{placeholder}}` opens the fill form first.
3. Typing text into the Enhance Prompt root-search argument prefills the form.
4. The Most-Used Prompts menubar item lists five titles and copies on click.
5. The fifth use of one prompt shows the feedback nudge.
