## ADDED Requirements

### Requirement: Preview-gated agent enhancement

CLI and MCP enhancement SHALL generate, validate, and record a history result
without creating or updating a main-library prompt in the same call. They SHALL
return the copy-ready body and history identifier for review. Library saving
SHALL require a later explicit, confirmed action for that exact history
identifier and reviewed content digest.

#### Scenario: Generate through CLI or MCP

- **WHEN** an agent or terminal user requests enhancement
- **THEN** Prompt Studio returns the validated body and history identifier
- **AND** it does not create or update a main-library prompt

#### Scenario: Old one-call save option is used

- **WHEN** a caller requests generation and library saving in one operation
- **THEN** Prompt Studio rejects the request before credential access, model cost, history creation, or library mutation with a clear two-step instruction
- **AND** no main-library prompt is created or changed

#### Scenario: Save a reviewed history result

- **WHEN** the caller separately confirms the exact reviewed history identifier and matching content digest
- **THEN** Prompt Studio uses the shared repeat-safe history-to-library path
- **AND** the library prompt retains the history result's original-thought and seed evidence

#### Scenario: Reviewed history changed

- **WHEN** the history identifier exists but its content digest no longer matches
- **THEN** Prompt Studio rejects the save before library mutation
