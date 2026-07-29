## ADDED Requirements

### Requirement: Read-only prompt recall

MCP status, list, search, and get SHALL NOT modify prompts, feedback, seeds,
enhancement history, usage, search indexes, or missed-search data. The existing
bounded privacy-safe audit record MAY still be appended.

#### Scenario: Search has no match

- **WHEN** `prompt_studio_search` returns no prompt
- **THEN** it writes no missed-search record or other user data

#### Scenario: Search uses Markdown fallback

- **WHEN** the SQLite index cannot serve a read-only MCP search
- **THEN** MCP returns Markdown fallback results without rebuilding the index

### Requirement: Version-bound agent feedback

Prompt retrieval SHALL return one stable version token derived from the prompt
identifier, update time, and content digest. Agent feedback SHALL require that
token. Prompt Studio SHALL resolve that exact current or historical version
before writing feedback and SHALL reject an unavailable or mismatched version.

#### Scenario: Retrieve a prompt version

- **WHEN** an agent retrieves a prompt
- **THEN** the response includes one stable version token for the returned body

#### Scenario: Record feedback for a retrieved version

- **WHEN** the prompt identifier and version token match a retrievable version
- **THEN** feedback stores that exact prompt snapshot

#### Scenario: Prompt changes after retrieval

- **WHEN** an agent retrieves version one, the prompt changes to version two, and feedback supplies the version-one token
- **THEN** feedback stores the historical version-one snapshot

#### Scenario: Version evidence does not match

- **WHEN** the supplied version time or content digest is unavailable or mismatched
- **THEN** feedback is rejected with a clear error
- **AND** no feedback record is written

### Requirement: Capability-safe statistics

Statistics SHALL inspect feedback and missed-search data only when feedback is
enabled. Disabled feedback SHALL be reported as unavailable without reading
its files.

#### Scenario: Feedback is disabled

- **WHEN** the CLI runs stats while feedback is Disabled
- **THEN** feedback and missed-search totals are marked unavailable
- **AND** no feedback-owned file is read

### Requirement: Installed bundle freshness

CLI and MCP status SHALL resolve an installed executable symlink and locate the
real source checkout before comparing the compiled bundle with shared-core
source. A standalone bundle without a source checkout SHALL remain usable
without a stale-build claim.

#### Scenario: Symlink targets a stale checkout bundle

- **WHEN** an installed symlink resolves to a bundle older than the checkout's shared-core source
- **THEN** status warns that the bundle is stale and names the rebuild command

#### Scenario: Compiled files contain a copied source tree

- **WHEN** the bundle contains `dist-cli/src/core`
- **THEN** freshness comparison uses the checkout's `src/core` instead of the copied compiled tree

#### Scenario: No checkout is available

- **WHEN** a standalone bundle has no discoverable source checkout
- **THEN** status remains silent about source freshness
