## Why

The current first-paste path makes Alex type the command name and then type the
prompt query again inside the list. A prompt with placeholders adds a form
without showing the final body. Completed enhancements stop at Copy, and quick
feedback requires finding the prompt again.

## What Changes

- Pass unmatched Raycast Root Search text into Browse Prompts so the query is
  typed once.
- Paste immediately only when that text names one active prompt by exact full
  identifier, title, or alias and the prompt has no placeholders.
- Keep ambiguous, partial, semantic, and placeholder-bearing matches visible
  for review before use.
- Show the filled prompt body while placeholder values are entered.
- Let the user opt in to remembering non-sensitive placeholder values for one
  unchanged prompt and forget them at any time.
- Make Paste primary and Copy secondary in enhancement preview and history.
- Add a Rate Last Prompt menubar item that judges the exact last library paste
  when feedback is Preview or Active.
- Give every action in the changed panels a native or explicit shortcut.
- Replace long mixed action lists with one-level task submenus while keeping the
  primary Paste or Enhance action visible.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-library`: Root Search handoff, filled-body preview, and fast
  feedback for the last library paste.
- `prompt-enhancement`: direct paste from completed preview and history.

## Impact

- Reuses Raycast fallback text, the current placeholder parser, the current
  feedback store, the existing menubar command, and Raycast local storage.
- Adds no Raycast command, runtime dependency, network request, feature flag,
  prompt schema, or activation change.
- Does not add blind best-match paste, placeholder types, composition, import,
  overlap cleanup, or prompt-health scoring.
- Does not add a third global feedback command; quick rating stays in the
  existing menubar. Rough Ideas is specified separately as an explicit local
  capture and inbox command.
