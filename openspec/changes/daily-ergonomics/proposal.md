## Why

The rollout is complete but daily use still costs more keystrokes than it
should. Every prompt exits through the clipboard, the list ignores which
prompts Alex actually reaches for, enhancement always starts from an empty
form, generic prompts require manual editing after paste, and the library is
only reachable through the Raycast window.

## What Changes

- Make Paste into the frontmost application the primary prompt action, with
  Copy as the second action; both record a use event.
- Rank the default (unsearched) prompt list by recorded use recency and
  frequency, falling back to updated time.
- Prefill the Enhance form from a Raycast root-search argument or fallback
  text so rough thoughts can be typed before the form opens.
- Support `{{placeholder}}` variables in prompt bodies: when a prompt with
  placeholders is used, a small form collects values before paste or copy.
- Add a menubar command listing the most-used prompts for one-click copy
  without opening the main Raycast window.
- Nudge feedback capture with a passive toast after repeated use of the same
  prompt.
- Enrich the imported prompts' aliases and hidden search terms and import a
  second curated batch (no model calls).

Deliberately skipped: a `gpt-5.6-luna` bulk-retag pipeline. The profile stays
defined, but a paid retag flow is not justified at 10-15 records; revisit when
the library is large enough that manual metadata upkeep fails.

## Capabilities

### New Capabilities

None. Every change extends the already-active `prompt-library` and
`prompt-enhancement` capabilities, so no new activation slot or feature flag
is created.

### Modified Capabilities

- `prompt-library`: paste-first use, usage-ranked ordering, placeholder
  variables, menubar access, feedback nudge.
- `prompt-enhancement`: argument and fallback-text prefill.

## Impact

- Raycast extension: `browse-prompts`, `enhance-prompt`, one new menubar
  command, shared core additions for usage statistics and placeholders.
- No new network requests, credentials, or storage locations. Usage events
  stay in the disposable SQLite index; losing them on rebuild only resets
  ranking.
- Markdown remains the source of truth; placeholder syntax is plain text in
  the body and does not change the record format.
