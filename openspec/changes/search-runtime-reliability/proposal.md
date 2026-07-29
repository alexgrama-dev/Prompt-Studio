## Why

Prompt recall can fail even while the Markdown library is healthy. Browse
waits for SQLite and QMD before showing rows, semantic search returns unrelated
prompts for nonsense queries, stale indexes can stop MCP recall, and a tool
marked read-only writes missed-search data. The installed CLI can also be stale
without warning.

## What Changes

- Search Markdown directly when SQLite is missing, stale, corrupt, or
  unreadable.
- Show Markdown and exact results before optional QMD health or refresh work.
- Reject weak semantic-only matches with fixed positive and unrelated controls.
- Give genuine query misses explicit Enhance and Save Rough Thought routes.
- Keep MCP status, list, search, and get read-only while retaining the existing
  privacy-safe audit log.
- Bind agent feedback to the exact prompt version that was retrieved.
- Detect stale installed CLI and MCP bundles through real symlinked layouts.
- Read no feedback-owned data when feedback is Disabled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `search-indexing`: reliable Markdown fallback, non-blocking QMD, and trusted
  semantic-only matches.
- `prompt-library`: useful query-miss recovery without implicit writes.
- `cross-agent-access`: read-only recall, exact-version feedback, truthful
  capability-safe stats, and correct bundle-age warnings.

## Impact

- Reuses the Markdown reader, exact filters, QMD adapter, Seed Inbox,
  enhancement launch path, feedback store, and bundle-freshness helper.
- Adds no dependency, storage format, telemetry stream, activation change, or
  Store capability.
- Keeps fallback ranking simpler than SQLite ranking.
- Removes automatic MCP missed-search writes; a recovery route writes only
  after its existing final Save action.
