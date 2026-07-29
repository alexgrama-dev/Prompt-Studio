## Why

Enhancement results are durable, but the flow has no clear finish. Completed
work returns as the next draft, repeated Save actions create duplicate prompts,
invalid history can look empty, and CLI or MCP enhancement can save model
output before a person sees it. CLI and MCP also omit the history and original
thought recorded by Raycast.

## What Changes

- Clear the recovery draft only after a validated result is written to
  Enhancement History.
- Record every Raycast, CLI, and MCP result in history with its exact original
  thought before returning or previewing it.
- Separate generation from library saving on CLI and MCP.
- Make history-to-library saving return the same prompt on repeated approval.
- Show invalid Seed Inbox and Enhancement History files as repair items instead
  of empty states.
- Report cancellation as cancellation, not failure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: a clear draft boundary, repeat-safe library saving,
  visible repair states, and truthful completion states.
- `cross-agent-access`: history-first, preview-gated enhancement on CLI and
  MCP.

## Impact

- Reuses Enhancement History, Seed Inbox, prompt version history, the Markdown
  validator, and existing confirmation behavior.
- Adds no dependency, provider, activation change, model call, compiler edit,
  data migration, or automatic repair.
- Does not merge or delete existing duplicate prompts.
- Leaves the frozen compiler 1.2.0 evaluation in its existing OpenSpec change.
