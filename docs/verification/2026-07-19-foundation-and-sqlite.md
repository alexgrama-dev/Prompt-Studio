# Prompt Studio Foundation and SQLite Activation 1 Verification

Verified on 2026-07-19.

## Outcome

The portable prompt library, visual Raycast interface, built-in exact search,
and rebuildable SQLite full-text search are active on the MacBook Pro. All
fourteen later optional capabilities remain disabled.

The MacBook Pro is the real runtime target. The Mac Mini is the independent
build and test host.

## Automated evidence

The same source passed on both Macs:

- 8 of 8 Node tests
- TypeScript type checking
- ESLint with zero warnings
- Prettier formatting check
- production Raycast build
- strict OpenSpec validation

The automated cases cover:

- readable Markdown round trips and invalid-file isolation
- atomic concurrent creation of 100 prompt files
- version history, restore, archive support, and deletion
- safe feature sequencing, required verification, deactivation, and activation
  history
- SQLite exact and full-text ranking
- target, project, tag, favorite, archive, and hidden-search-term filters
- recent and usage-based ordering
- incremental update and deletion
- deletion and full rebuild of the derived database
- corrupt-database recognition and repair from Markdown

Observed 100-file Markdown load:

- MacBook Pro: about 27 ms
- Mac Mini: about 42 ms

These are far below the initial two-second budget.

## MacBook Pro rendered verification

The real Raycast extension on the MacBook Pro was used for these checks:

1. Browse Prompts rendered two temporary prompts with title, summary, tags,
   target, updated time, body preview, and file path.
2. Searching for the hidden phrase `hidden transport failure` returned only the
   intended prompt and displayed `Matched: hidden search term`.
3. Copy Prompt displayed a success notice and placed the exact prompt body on
   the MacBook clipboard.
4. Prompt Studio Status displayed four active capabilities:
   - Portable Markdown Store
   - Raycast Visual Library
   - Raycast Exact Search
   - SQLite Search, Activation 1
5. SQLite detail displayed Active, Healthy, the verification time, indexed
   record count, last index update, database path, and a rebuild action.
6. The other fourteen optional capabilities remained Disabled.

The two temporary QA prompts were removed through the shared prompt store after
verification. The final real library and SQLite index both contain zero prompt
records.

## Storage and recovery boundary

Prompt files are the master copy:

`Markdown prompt files -> rebuildable SQLite search database -> Raycast results`

The database can be deleted or corrupted and rebuilt without losing prompt
content, assumptions, validation steps, project binding, or source references.
SQLite is never the only copy of a prompt.

The default paths are:

- Prompt files:
  `~/Library/Application Support/Prompt Studio/Prompts`
- Derived search database:
  `~/Library/Application Support/Prompt Studio/search.sqlite`
- Local activation record:
  `~/Library/Application Support/Prompt Studio/features.json`

## Activation record

SQLite Search was activated locally on the MacBook Pro at
`2026-07-19T18:34:37.173Z` after both-host checks passed.

The implementation uses Node's built-in `node:sqlite` module and its bundled
FTS5 full-text engine. No third-party database package or network service is
required. The API choice was checked against the current
[official Node SQLite documentation](https://github.com/nodejs/node/blob/main/doc/api/sqlite.md)
and live-probed on both Macs.

## Known release-only issue

The extension builds and runs locally. Raycast Store metadata validation still
needs Alex's registered Raycast Store author handle before publication; the
placeholder-free local author value is intentionally not replaced with a fake
account. This does not affect local use.
