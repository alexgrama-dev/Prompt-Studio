## Why

The current Seed Inbox is hidden inside Enhance Prompt. It creates a new
record for the same thought each time, hides invalid Markdown as an empty
inbox, and cannot edit or repair an idea. Local capture also disappears when
model enhancement is unavailable. These limits make it poor as a daily inbox.

## What Changes

- Replace the user-facing Seed Inbox name with Rough Ideas.
- Add one top-level Rough Ideas command for local capture, search, edit, repair,
  deletion, and explicit transfer to Enhance Prompt.
- Keep capture available without a provider, model request, project scan, or
  network request.
- Make repeated exact saves return the existing idea.
- Group valid ideas as Ready to Enhance or Enhanced without hiding them when
  enhancement history cannot load.
- Show invalid idea files under Needs Repair with file-recovery actions.
- Add an explicit, previewed, confirmed migration that consolidates historical
  exact duplicates while preserving their identifiers as aliases for existing
  enhancement and prompt links.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: visible Rough Ideas capture, repair, reuse, editing,
  duplicate consolidation, and seed-to-result traceability.

## Impact

- Raycast extension: one `rough-ideas` command and smaller launch-context
  handoffs to `enhance-prompt`.
- Shared storage: existing `.seeds` Markdown remains the recoverable source of
  truth; a consolidated record may gain prior seed identifiers.
- Existing enhancement-history and prompt records are not rewritten. Their old
  seed identifiers resolve through the consolidated record.
- Adds no dependency, database table, network request, provider, activation
  order, or default-state change.
- The migration never runs on launch. It requires a visible preview and
  confirmation.
