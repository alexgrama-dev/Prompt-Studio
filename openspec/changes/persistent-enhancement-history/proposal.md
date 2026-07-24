## Why

Enhancement results currently exist only in the live Raycast view until Alex
explicitly saves them. Raycast may unload that view while another application
is in use, which makes a completed result difficult to recover and resets
unfinished form input.

## What Changes

- Record every validated enhancement in a separate local Markdown history
  before opening its preview.
- Let Alex browse, copy, and explicitly move a historical enhancement into the
  main prompt library.
- Restore unfinished enhancement form input after Raycast unloads the command.
- Keep the main library unchanged until Alex explicitly saves a result.

## Capabilities

### Modified Capabilities

- `prompt-enhancement`: automatic local history and reset-safe form drafts.

## Impact

- Raycast extension: `enhance-prompt`.
- Shared prompt storage: one hidden `.enhancements` Markdown directory inside
  the configured prompt directory.
- No new dependency, background scheduler, network request, or database table.
