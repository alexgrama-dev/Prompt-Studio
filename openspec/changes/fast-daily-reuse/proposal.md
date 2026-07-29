## Why

The current first-paste path makes Alex type the command name and then type the
prompt query again inside the list. A prompt with placeholders adds a form
without showing the final body. Completed enhancements stop at Copy, and quick
feedback requires finding the prompt again.

## What Changes

- Pass unmatched Raycast Root Search text into Browse Prompts so the query is
  typed once.
- Keep Paste as the visible result's default Enter action and never paste an
  unseen result.
- Show the filled prompt body while placeholder values are entered.
- Make Paste primary and Copy secondary in enhancement preview and history.
- Add a Rate Last Prompt menubar item that judges the exact last library paste
  when feedback is Preview or Active.
- Give every action in the changed panels a native or explicit shortcut.

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
- Does not add blind best-match paste, placeholder types or defaults, saved
  placeholder values, composition, import, overlap cleanup, or prompt-health
  scoring.
- Does not add a third global feedback command; quick rating stays in the
  existing menubar so Prompt Studio and Enhance Prompt remain the two daily
  Root Search entries.
