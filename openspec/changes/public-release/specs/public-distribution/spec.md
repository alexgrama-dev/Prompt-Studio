## ADDED Requirements

### Requirement: Honest initial Store surface

The initial Raycast Store package SHALL expose only the working local prompt
library and menu-bar commands. It SHALL request only a local prompt-directory
preference and SHALL not advertise an unavailable enhancement workflow.

#### Scenario: Inspect the Store manifest

- **WHEN** the public Store package is prepared
- **THEN** its commands are Prompt Studio and Most-Used Prompts
- **AND** its only preference is the local prompt directory
- **AND** it contains no provider credential, remote project, SSH, or external search setting

#### Scenario: Open a fresh Store installation

- **WHEN** a user installs Prompt Studio without changing preferences
- **THEN** the user can create, browse, search, preview, paste, and copy local prompts
- **AND** the released commands make no Prompt Studio network request
- **AND** the commands load without requiring `node:sqlite`

#### Scenario: Rank menu-bar prompts in the Store runtime

- **WHEN** a user copies or pastes a prompt from the Store release
- **THEN** Prompt Studio records its count and last-used time in a local JSON cache
- **AND** the menu bar ranks used prompts without requiring SQLite

### Requirement: Allowlisted Store package

The system SHALL prepare publication in a fixed ignored directory by copying an
explicit list of public source, asset, metadata, and user-documentation entries.
It SHALL verify the exact top-level result before publication.

#### Scenario: Prepare a Store submission

- **WHEN** the package preparation command succeeds
- **THEN** the output contains only the released commands and their local source dependencies, public assets, public documentation, build configuration, Store manifest, and npm dependency lock
- **AND** the exact top-level entries match the maintained allowlist

#### Scenario: An unexpected file enters the output

- **WHEN** the prepared directory contains an entry outside the allowlist
- **THEN** preparation fails before lint, build, or publication

### Requirement: Explicit remote configuration

A fresh development or Store installation SHALL have no default SSH host or
remote project path. Remote project discovery SHALL begin only after the user
enters an explicit `host:path` value in a development build that exposes that
setting.

#### Scenario: Start without remote settings

- **WHEN** a fresh installation loads its preferences
- **THEN** no SSH destination is configured
- **AND** Prompt Studio makes no remote project discovery attempt

### Requirement: Public maintenance routes

The public repository SHALL state its license, privacy boundary, supported
security-reporting route, contribution checks, initial release changes, and
structured issue and pull request expectations.

#### Scenario: A new contributor evaluates the project

- **WHEN** a contributor opens the repository
- **THEN** they can identify what the product does, how to run its checks, what data must not be submitted, and how their contribution is licensed

#### Scenario: A reporter finds a suspected vulnerability

- **WHEN** the reporter follows the security policy
- **THEN** they are directed to a private GitHub vulnerability report instead of a public issue
