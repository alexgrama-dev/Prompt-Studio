## Why

The first Store package hid Enhance / Optimize so a stranger would not meet a
disabled command or an install-time credential form. The enhance → review →
save or copy path now works with a one-run key, so hiding it is no longer
honest.

## What Changes

- Expose Enhance Prompt in the Store manifest beside Prompt Library and
  Frequent Prompts.
- Keep Store preferences limited to the local prompt directory.
- Ask for a provider key only when the user submits an enhancement.
- Update public README, privacy, and changelog copy so they no longer hide
  that path.

## Capabilities

### Modified Capabilities

- `public-distribution`: the Store surface includes Enhance Prompt without
  install-time credentials.

## Impact

- Store users can enhance or optimize rough thoughts and still review before
  save or copy.
- Markdown remains the recoverable source of truth.
- Research, project context, CLI, and agent features stay Disabled in Store.
