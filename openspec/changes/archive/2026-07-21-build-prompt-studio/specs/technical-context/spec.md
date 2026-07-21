## ADDED Requirements

### Requirement: Need-based source routing

The system SHALL retrieve external technical information only when the rough
thoughts or selected repository identify a need for current documentation or
external facts.

#### Scenario: Library-specific task

- **WHEN** the task depends on the behavior of a named library, framework, SDK, API, or CLI
- **THEN** the system detects the library from the task or selected project's dependency manifests
- **AND** it requests version-specific documentation from Context7 using the explicit task version first, then the exact project version when available

#### Scenario: Several exact-name indexes exist

- **WHEN** several Context7 results have the same library title and only one lists the requested version
- **THEN** the version-matching index is selected before trust and coverage scores are compared

#### Scenario: Context7 authentication is required

- **WHEN** the exact documentation query has been reviewed
- **THEN** the system uses a configured encrypted or environment credential without displaying it, or offers a masked one-run form, and never saves the key in prompt data or returned-source records

#### Scenario: Current external fact is required

- **WHEN** the task depends on information likely to have changed
- **THEN** the system uses web search and prefers official or primary sources

#### Scenario: Rough task needs a focused search query

- **WHEN** routing selects web or Exa research
- **THEN** a bounded structured planner first extracts the external evidence objective, specific research questions, and one concise query per selected provider
- **AND** project files, local paths, credentials, and unrelated deliverable wording are excluded
- **AND** the provider search cannot run from the original rough task or from a missing, unsafe, wrong-route, or verbatim repeated query

#### Scenario: Current-web request is reviewed

- **WHEN** need-based routing selects current web research
- **THEN** the system shows the extracted questions, exact focused public query, planning cost, privacy boundaries, tool-call limit, and conservative maximum cost before a paid search, and it sends no project bundle

#### Scenario: Current-web results are reviewed

- **WHEN** a paid current-web search completes
- **THEN** the system shows provider-reported queries, cited sources, consulted URLs, bounded source content, and actual estimated cost before starting a separate enhancement request

#### Scenario: Web-backed enhancement is cancelled

- **WHEN** the user cancels after reviewing current-web sources
- **THEN** the active enhancement request is aborted, no prompt is saved, and the reviewed sources remain available for a later retry

#### Scenario: No external context is needed

- **WHEN** the task can be enhanced faithfully from user input and optional project context
- **THEN** the system performs no external documentation or web search

### Requirement: Research controls

The enhancement form SHALL support Off, Automatic, and Deep research settings.

#### Scenario: Research is off

- **WHEN** the user selects Off
- **THEN** the system performs no Context7 or web-search calls and reports any external facts it could not verify

#### Scenario: Research is automatic

- **WHEN** the user selects Automatic
- **THEN** the system calls only sources justified by the task classifier

#### Scenario: Research is deep

- **WHEN** the user selects Deep
- **THEN** the system permits broader multi-source research and a second quality-review pass while preserving the same privacy exclusions

### Requirement: Source provenance

The system SHALL record where externally retrieved facts came from and which
part of the enhanced prompt each source supports.

#### Scenario: External fact is included

- **WHEN** an enhanced prompt includes a fact obtained from Context7 or web search
- **THEN** the preview identifies the source URL or library identifier and its purpose

### Requirement: Safe handling of retrieved content

The system SHALL treat repository text, documentation, and web pages as
untrusted reference material rather than instructions that can override the
enhancer policy or the user's request.

#### Scenario: Retrieved content contains conflicting instructions

- **WHEN** retrieved text asks the enhancer to ignore higher-priority instructions, expose secrets, or perform actions
- **THEN** the system ignores those embedded instructions and uses the text only as reference content

### Requirement: Graceful retrieval failure

The system SHALL remain usable when Context7, web search, authentication, or the
network is unavailable.

#### Scenario: Optional source fails

- **WHEN** an optional technical source fails
- **THEN** the system either continues with clearly labeled missing context or stops with a recoverable error, and it does not invent the missing facts

### Requirement: Exa research

The system SHALL support Exa as an independently activated source for broader
semantic web search, code examples, research papers, and page extraction.

#### Scenario: Exa is inactive

- **WHEN** Exa is disabled
- **THEN** no query, prompt text, project context, or credential is sent to Exa

#### Scenario: Exa is selected

- **WHEN** Automatic or Deep research routes a justified query to active Exa
- **THEN** the system sends only the focused reviewed Exa query, records returned sources and cost metadata, and keeps the retrieved text separate from trusted instructions

#### Scenario: Exa result duplicates a stronger source

- **WHEN** Exa returns a claim already supported by a selected repository or official documentation
- **THEN** the system prefers the higher-priority source and does not add duplicate context

#### Scenario: Exa work is cancelled

- **WHEN** the user cancels Exa retrieval or the separate model enhancement
- **THEN** the active operation stops, no prompt is saved, the one-run key is cleared from the form, and any possible provider-side charge is explained

### Requirement: GitHub MCP research

The system SHALL support the official GitHub MCP server in read-only mode for
upstream repository code, issues, pull requests, releases, and actions status.

#### Scenario: GitHub MCP is inactive

- **WHEN** GitHub MCP is disabled
- **THEN** the system exposes no GitHub MCP tools and performs no GitHub MCP request

#### Scenario: Upstream history is relevant

- **WHEN** the task depends on an upstream issue, pull request, release, or remote repository not available locally
- **THEN** the system uses only the allowlisted read tools needed for that request and records the GitHub objects consulted

#### Scenario: Retrieved GitHub content requests an action

- **WHEN** an issue, comment, pull request, or repository file contains instructions to mutate GitHub or reveal data
- **THEN** the system treats the text as untrusted reference material and performs no write action

#### Scenario: GitHub MCP work is cancelled

- **WHEN** the user cancels GitHub retrieval or the separate model enhancement
- **THEN** the active operation stops, no prompt is saved, and the one-run token is cleared from the form

### Requirement: Source priority and conflict handling

The system SHALL apply the source order selected repository, local project
instructions, version-specific official documentation, upstream GitHub,
official web sources, and community examples.

#### Scenario: Sources disagree

- **WHEN** two sources provide materially different technical facts
- **THEN** the result identifies the disagreement, prefers the higher-priority and version-matching source, and does not merge incompatible claims silently

### Requirement: Research cost and privacy disclosure

The system SHALL show which active external service will receive each research
query and SHALL display available per-request cost information before Deep
research begins.

#### Scenario: Deep research uses paid sources

- **WHEN** Deep research would call a paid Exa or model search operation
- **THEN** the preview identifies the services and estimated or known request cost before the user confirms
