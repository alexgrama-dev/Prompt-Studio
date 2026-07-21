# controlled-activation Specification

## Purpose
TBD - created by archiving change build-prompt-studio. Update Purpose after archive.
## Requirements
### Requirement: Per-capability activation state

The system SHALL maintain a local activation state for every optional
capability with Disabled, Preview, and Active states.

#### Scenario: New installation

- **WHEN** Prompt Studio starts for the first time
- **THEN** only the portable prompt store, visual library, exact search, and clipboard access are Active while networked and mutation capabilities are Disabled

#### Scenario: Capability is disabled

- **WHEN** a capability is Disabled
- **THEN** its UI clearly identifies that state and its code performs no background work, network calls, or data mutation

### Requirement: Activation prerequisites

Each capability SHALL declare the configuration, dependency, privacy, test, and
verification checks required before entering Preview or Active state.

#### Scenario: Prerequisite is missing

- **WHEN** the user attempts to activate a capability with an unmet prerequisite
- **THEN** activation is refused and the missing requirement is identified

#### Scenario: Prerequisites pass

- **WHEN** every declared prerequisite and acceptance check passes
- **THEN** the capability becomes eligible for Preview

#### Scenario: User omits an optional capability

- **WHEN** the user explicitly excludes an unneeded optional capability
- **THEN** it remains Disabled, performs no work, is visibly identified as skipped, and is not treated as a prerequisite for later capabilities

### Requirement: One-at-a-time rollout

The initial rollout SHALL change at most one capability from Preview to Active
between complete verification runs.

#### Scenario: Another capability is awaiting verification

- **WHEN** one newly activated capability has not completed its verification run
- **THEN** the system prevents a second Preview capability from becoming Active

### Requirement: Reversible deactivation

The user SHALL be able to disable an optional capability without deleting prompt
files, source records, credentials for other providers, or unrelated indexes.

#### Scenario: Disable a failing integration

- **WHEN** the user disables Exa, GitHub MCP, QMD, a model provider, or MCP mutations
- **THEN** that integration stops operating and the remaining active capabilities continue to work

### Requirement: Activation status surface

The visual application and CLI SHALL display every capability's state,
prerequisites, last verification result, and last error.

#### Scenario: Review rollout status

- **WHEN** the user opens capability status
- **THEN** the system groups readable capability names by Disabled, Preview, or Active state and shows the selected capability's complete description and activation sequence in the detail pane

### Requirement: Safe configuration storage

Activation settings SHALL be stored locally and secrets SHALL remain in secure
credential storage rather than feature configuration files.

#### Scenario: Export configuration

- **WHEN** the user exports non-secret Prompt Studio settings
- **THEN** the export contains activation states and provider names but no API keys, OAuth tokens, or repository credentials

