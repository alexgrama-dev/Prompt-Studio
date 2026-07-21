## ADDED Requirements

### Requirement: Agent-recorded prompt feedback

The MCP server SHALL provide a `prompt_studio_record_feedback` tool that
appends one validated feedback record for an existing prompt without a
confirmation token. The tool SHALL be gated on the feedback capability,
SHALL scrub private paths and secrets from notes, SHALL cap note size and
per-process rate, SHALL be append-only, and SHALL write nothing when
validation fails.

#### Scenario: Agent records an outcome

- **WHEN** an agent calls the tool with an existing prompt id, a valid verdict, and an outcome status
- **THEN** one feedback record is appended with a prompt version snapshot and the stored record id is returned

#### Scenario: Feedback capability disabled

- **WHEN** the feedback capability is Disabled
- **THEN** the call is rejected before any data is read or written

#### Scenario: Invalid input

- **WHEN** the prompt id is unknown or the verdict is not a defined value
- **THEN** the call fails with a clear error and no record is written

#### Scenario: Rate cap reached

- **WHEN** the per-process rate cap is exhausted
- **THEN** further calls fail with a clear error instead of writing

### Requirement: Placeholder exposure across surfaces

CLI and MCP prompt retrieval SHALL expose the distinct `{{placeholder}}`
names found in the prompt body, and the CLI copy command SHALL warn when the
copied body still contains placeholders.

#### Scenario: Get a prompt with placeholders

- **WHEN** a retrieved prompt body contains `{{goal}}`
- **THEN** the response includes a placeholders list containing `goal`

#### Scenario: Copy with unfilled placeholders

- **WHEN** the CLI copies a body containing placeholder tokens
- **THEN** a warning states that placeholders remain unfilled

### Requirement: Build freshness warning

CLI and MCP status SHALL warn when the compiled bundle is older than the
newest shared-core source file, naming the rebuild command. The warning
SHALL not fail the status call.

#### Scenario: Stale bundle

- **WHEN** a shared-core source file is newer than the compiled bundle serving the call
- **THEN** status output includes a warning naming the rebuild command

### Requirement: Usage and feedback statistics

The CLI SHALL provide a read-only stats command reporting per-prompt use
counts and last use, feedback tallies by verdict and outcome status, and
prompts with zero recorded use, in human and JSON forms. A missing search
index SHALL degrade to zero counts with an explanatory note.

#### Scenario: Stats over existing data

- **WHEN** the stats command runs with an available index and feedback store
- **THEN** it reports totals, ranked per-prompt usage, feedback tallies, and zero-use prompts without modifying any data

#### Scenario: Missing index

- **WHEN** the search index is unavailable
- **THEN** stats reports zero usage with a note instead of failing
