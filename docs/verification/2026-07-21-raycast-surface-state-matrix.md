# Raycast Simplification and State Matrix

Date: 2026-07-21  
Runtime: MacBook Pro Raycast development extension  
Build and test host: Mac Mini mirror at `~/Developer/work/prompt-studio`

## Simplified enhancement surface

- The main form renders only `What Do You Need?`, `Use With`, and `Project`.
- `Customize` renders only `External Research` and `Special Instructions`.
- Provider selection is available from the `Advanced Provider` action.
- Technical library and version are inferred from the rough prompt and, when selected, the read-only project bundle.
- The project picker renders `Portable`, `Recent`, `MacBook`, and `Mac Mini` sections without repeating a recent project in its machine section.
- A live prompt-studio project check inferred `@raycast/api` version `1.104.22` from `package.json` and routed the request to the compact Context7 review.
- A project-free live-web check showed the research goal, three focused questions, query, privacy, cost ceiling, and source review without putting the full disclosure on the main screen.

## Raycast state matrix

| State             | Rendered evidence                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty library     | `No Prompts Found` with an explanation and `Save Existing Prompt` action.                                                                       |
| Loading           | The enhancement form first showed `Finding projects on this MacBook and Mac Mini…`, then replaced it with the normal project description.       |
| Populated         | A two-prompt disposable library rendered both list rows and full prompt details.                                                                |
| Search            | Searching `stale-check` returned only `Stale Project Audit` and explained `Matched by: tag`.                                                    |
| No search results | An unmatched search rendered `No Prompts Found` instead of a blank surface.                                                                     |
| Filters           | The picker exposed Current, Favorites, All, target, project, and tag filters; Favorites reduced the disposable library from two prompts to one. |
| Manual create     | `Save Existing Prompt` stated `Private and Unchanged`; the saved body matched the entered body exactly and no model was called.                 |
| Preview           | The enhancement preview rendered the copy-ready prompt separately from assumptions, project files, sources, and hidden search metadata.         |
| Edit              | The existing edit-and-save form rendered from the prompt preview and preserved versioned updates.                                               |
| Enhance           | A live project-free Standard enhancement completed to an unsaved preview; no library file was created.                                          |
| Cancel            | Raycast rendered the cancellation result without saving, and shared provider tests rejected cancelled work without a preview or partial save.   |
| Error             | A temporary non-directory library path rendered `Prompt Library Unavailable`, the filesystem error, and `Reload Prompt Library`.                |
| Stale project     | A prompt bound to an old alexctx commit rendered the saved and current commits with `Project context may be stale`.                             |
| Mac Mini offline  | An unreachable temporary SSH host rendered `Mac Mini is unavailable over SSH. Local projects still work.`                                       |
| Recovery          | Restoring `mini:~/Developer` removed the offline warning and restored the normal project description.                                           |

## Safety and restoration

- The empty, error, stale, search, and filter fixtures lived only in `/tmp/prompt-studio-raycast-states.AzryeB`.
- Raycast preferences were restored to:
  - Prompt Directory: `~/Library/Application Support/Prompt Studio/Prompts`
  - Project Roots: `~/Developer`
  - Mac Mini Project Root: `mini:~/Developer`
- The real prompt library still contains the same five Markdown files, all last modified on 2026-07-20; no verification prompt was saved there.
- One live research run completed to an unsaved preview while cancellation was being exercised. It was not copied into the library or saved.

## Automated evidence

The synchronized Mac Mini mirror passed:

- 56/56 shared unit and integration tests;
- TypeScript and ESLint;
- Raycast, CLI, and MCP builds;
- MCP runtime, mutation, feedback, and optimization probes;
- Prettier;
- strict OpenSpec validation; and
- a redacted 3.08 MB gitleaks scan with no leaks found.
