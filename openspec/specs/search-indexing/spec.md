# search-indexing Specification

## Purpose
TBD - created by archiving change build-prompt-studio. Update Purpose after archive.
## Requirements
### Requirement: Rebuildable exact-search index

The system SHALL maintain a local SQLite index derived entirely from Markdown
prompt records. The index SHALL never be the only copy of a prompt.

#### Scenario: Prompt is created or updated

- **WHEN** a prompt file is saved successfully
- **THEN** the system updates the corresponding index record after the file write completes

#### Scenario: Index is absent or corrupt

- **WHEN** the index cannot be read or fails an integrity check
- **THEN** the system rebuilds it from Markdown files without losing prompt content

#### Scenario: Index update fails

- **WHEN** a prompt file is saved but its index update fails
- **THEN** the saved Markdown remains valid and the system marks the index for rebuild

### Requirement: Exact and filtered search

The SQLite index SHALL support full-text search over title, summary, prompt body,
visible tags, hidden search terms, project binding, target, and taxonomy.

#### Scenario: Exact phrase search

- **WHEN** the user searches for a phrase present in a prompt body or metadata
- **THEN** matching prompts appear and exact title or tag matches rank above body-only matches

#### Scenario: Combined filter

- **WHEN** the user searches while filtering by target, project, task type, or favorite status
- **THEN** only records satisfying the active filters are returned

### Requirement: QMD semantic discovery

The system SHALL support QMD meaning-based search over the Markdown prompt
directory and SHALL combine semantic results with exact-search results.

#### Scenario: Different wording with similar meaning

- **WHEN** the search text shares meaning with a prompt but not exact terms
- **THEN** active QMD can return the prompt with a semantic-match explanation

#### Scenario: QMD is inactive or unavailable

- **WHEN** QMD is disabled, missing, or unhealthy
- **THEN** exact and filtered SQLite search remains fully usable

### Requirement: Search result fusion

The system SHALL combine exact and semantic results deterministically, favoring
exact title, visible-tag, and project matches before semantic-only matches.

#### Scenario: Same prompt appears in both sources

- **WHEN** SQLite and QMD return the same prompt
- **THEN** the system displays one result with the stronger combined score

### Requirement: Index status and repair

The system SHALL display SQLite and QMD status and SHALL provide explicit
rebuild actions.

#### Scenario: Prompt files changed outside Prompt Studio

- **WHEN** an external Git operation or editor changes prompt files
- **THEN** the system detects the changed file set and refreshes affected indexes before claiming results are current

