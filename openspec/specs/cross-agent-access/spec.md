# cross-agent-access Specification

## Purpose
TBD - created by archiving change build-prompt-studio. Update Purpose after archive.
## Requirements
### Requirement: MacBook-first local operation

The MacBook Pro SHALL be a complete standalone Prompt Studio installation and
SHALL NOT depend on the Mac Mini being reachable at runtime.

#### Scenario: Mac Mini is unavailable

- **WHEN** the Mac Mini is powered off, asleep, or unreachable over SSH
- **THEN** the MacBook can still browse, search, enhance, save, and serve prompts using its local store and credentials

#### Scenario: Verify the visual application

- **WHEN** a Raycast capability reaches rendered acceptance testing
- **THEN** the check runs on the MacBook Pro while the Mac Mini remains only a clean build-and-test mirror

### Requirement: Local prompt CLI

The system SHALL provide a local command-line interface for listing, searching,
reading, copying, saving, and validating prompts against the same Markdown store
used by Raycast.

#### Scenario: Search from a terminal

- **WHEN** the user searches through the CLI
- **THEN** the CLI returns the same prompt identifiers and metadata as the visual library for the same query and active indexes

#### Scenario: Save through the CLI

- **WHEN** the user intentionally saves a valid prompt through the CLI
- **THEN** the CLI uses the same validation and atomic-write path as Raycast

### Requirement: Local prompt MCP server

The system SHALL expose prompt search and retrieval through a local MCP server
and SHALL expose mutation tools only when explicitly activated.

#### Scenario: Read-only default

- **WHEN** the MCP server starts with default settings
- **THEN** it exposes status, list, search, and get tools but no save, edit, delete, or enhancement mutation tools

#### Scenario: Mutation tools are activated

- **WHEN** the user explicitly activates MCP mutations
- **THEN** save and enhancement tools become available while delete remains confirmation-gated outside the model call

### Requirement: Shared behavior across surfaces

Raycast, the CLI, and the MCP server SHALL share prompt parsing, validation,
search, enhancement, source routing, and atomic-write behavior.

#### Scenario: Invalid prompt record

- **WHEN** any surface encounters the same malformed prompt file
- **THEN** all surfaces report the same validation failure without creating divergent copies

### Requirement: Coding-agent interoperability

The MCP server SHALL be connectable from Codex, Claude Code, and other
MCP-compatible clients without requiring copies of the prompt library.

#### Scenario: Retrieve from two clients

- **WHEN** Codex and Claude Code retrieve the same prompt identifier
- **THEN** both receive the same current prompt body and metadata from the shared store

### Requirement: Local server security

The MCP server SHALL use local-only transport, minimum permissions, bounded
outputs, and credential redaction.

#### Scenario: Non-local connection attempt

- **WHEN** a remote process attempts to connect through a network interface
- **THEN** the default MCP configuration refuses the connection

#### Scenario: Prompt contains secrets

- **WHEN** a prompt body contains a value marked or detected as sensitive
- **THEN** the MCP response redacts or refuses the sensitive field according to the saved prompt policy

