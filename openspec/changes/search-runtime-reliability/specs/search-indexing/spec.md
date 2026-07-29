## ADDED Requirements

### Requirement: Markdown fallback search

Prompt Studio SHALL search loaded Markdown records when the disposable SQLite
index is missing, stale, corrupt, or unreadable. The fallback SHALL apply the
same supported text and metadata filters. Exact title and tag matches SHALL
rank ahead of body-only matches. A read-only CLI or MCP search SHALL NOT
rebuild an index.

#### Scenario: SQLite is unavailable

- **WHEN** valid Markdown prompts are readable but SQLite search is unavailable
- **THEN** Raycast, CLI, and MCP return matching Markdown records
- **AND** the failure does not hide or replace a prompt file

#### Scenario: Read-only agent search

- **WHEN** MCP search needs the Markdown fallback
- **THEN** it returns the available matches without rebuilding an index

#### Scenario: Combined fallback filter

- **WHEN** a fallback search includes text, target, project, and tag filters
- **THEN** only Markdown records satisfying the same supported combination are returned

#### Scenario: Fallback result ranking

- **WHEN** one fallback result matches a title or tag and another matches only its body
- **THEN** the title or tag result ranks first

### Requirement: Non-blocking semantic discovery

Prompt Studio SHALL render Markdown and exact-search results before optional
QMD health or refresh work completes. Later QMD failure SHALL NOT block, clear,
or reorder exact results as semantic matches.

#### Scenario: Open Browse Prompts

- **WHEN** Markdown records are readable
- **THEN** the initial list renders without waiting for QMD health

#### Scenario: QMD becomes ready

- **WHEN** QMD returns valid meaning-based matches after exact results render
- **THEN** Prompt Studio adds and labels those matches through the existing fusion rules

#### Scenario: Active QMD is stale

- **WHEN** Active QMD needs a refresh on first render
- **THEN** Prompt Studio refreshes it after the first Markdown results render
- **AND** later searches in the command view can use the refreshed index

#### Scenario: QMD fails

- **WHEN** QMD is Disabled, unavailable, stale, or fails during refresh
- **THEN** exact and Markdown fallback results remain usable

### Requirement: Trusted semantic-only matches

A result found only through QMD SHALL pass one calibrated confidence rule.
The rule SHALL retain the recorded positive query
`find the underlying cause before making a small repair`. It SHALL reject
`zzqvplmokn`, `organize my spice rack`, and `make blueberry pancakes` against
the real MacBook QMD collection.

#### Scenario: Different wording has the same intent

- **WHEN** a fixed positive query expresses the intent of an indexed prompt with different words
- **THEN** the prompt remains eligible as a meaning-based result

#### Scenario: Query is unrelated

- **WHEN** a fixed unrelated or nonsense query has no supported prompt intent
- **THEN** semantic search returns no prompt
- **AND** Prompt Studio can show the real no-result state
