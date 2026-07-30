## Why

Idea Studio captures prompt ideas, but it does not yet support the wider flow
that happens during AI-assisted work. Follow-up prompts, useful answers, links,
and unfinished ideas still need separate tools or remain in the clipboard.
There is also no local queue for sending captured prompts back into the active
application and marking them complete.

## What Changes

- Extend Idea Studio items with one optional local kind: Next Prompt, Keep, or
  Idea.
- Organize active Next Prompt items under Up Next, active Keep and Idea items
  under Saved for Later, and all completed items under Completed.
- Paste captured text into the frontmost application without completing it.
- Complete and restore items through separate explicit actions.
- Capture manual text, selected text, and clipboard text.
- Add an auxiliary Quick Capture command that immediately saves selected text,
  or clipboard text when no selection exists, as a local Next Prompt.
- Convert a captured item into one repeat-safe reusable library prompt after a
  review form.
- Preserve existing idea Markdown without an automatic migration. Earlier
  records behave as active Idea items.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: local capture classification, queue states, paste and
  completion actions, Quick Capture, and direct prompt conversion.

## Impact

- Personal Raycast extension: Idea Studio gains queue sections and native
  actions; Quick Capture is added as an auxiliary no-view command.
- Shared storage: seed Markdown may gain optional validated capture metadata.
- Existing `.seeds` Markdown remains readable and requires no bulk migration.
- Direct conversion creates or reuses one main-library prompt linked to the
  source seed.
- Adds no dependency, provider, database table, network request, background
  task, activation change, or Store command.
