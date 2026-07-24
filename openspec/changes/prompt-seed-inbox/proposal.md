## Why

Some rough thoughts are worth keeping before they become polished prompts.
Prompt Studio currently remembers only the latest form draft and completed
enhancements, so an intentionally saved idea has no durable identity or visible
connection to the prompts it later produces.

## What Changes

- Add a Seed Inbox for rough thoughts explicitly saved from Enhance Prompt.
- Store seeds as local Markdown records outside the main prompt library and
  search index.
- Let a saved seed refill the enhancement form without making a model request.
- Attach the original thought and optional saved-seed identity to enhanced
  history and library records.
- Show how many enhanced prompts each saved seed produced.

## Capabilities

### Modified Capabilities

- `prompt-enhancement`: saved rough-thought seeds and seed-to-result history.

## Impact

- Raycast extension: `enhance-prompt`.
- Shared prompt metadata: one optional seed reference.
- Local storage: one hidden `.seeds` Markdown directory inside the configured
  prompt directory.
- No new dependency, database table, network request, or activation.
