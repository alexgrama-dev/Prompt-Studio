## Why

Prompt Studio reports zero recorded uses, but that number cannot be trusted.
A normal SQLite rebuild deletes every usage row even though usage is the main
evidence for whether the personal development build is becoming useful.

## What Changes

- Preserve readable usage rows when the disposable SQLite search index is
  rebuilt.
- Refuse to replace an existing index when its usage rows cannot be read
  safely.
- Label statistics as recorded evidence instead of claiming lifetime use.
- Keep feedback totals separate from usage totals.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `search-indexing`: rebuild the index without deleting readable usage
  evidence.
- `cross-agent-access`: report available and unavailable usage evidence
  truthfully.

## Impact

- Reuses the current SQLite schema and temporary-file rebuild.
- Adds no storage format, data migration, dependency, network request, feature
  flag, or activation change.
- Leaves Markdown prompts, feedback, enhancement history, and the Store usage
  cache unchanged.
- Does not redefine MCP retrieval as prompt use.
