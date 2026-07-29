## ADDED Requirements

### Requirement: Disabled enhancement capability isolation

A Disabled optional enhancement capability SHALL perform no credential read,
owned payload-data read, background work, network request, or data mutation.
Control-state metadata needed to explain why it is Disabled MAY be read. Its
unavailable options MAY remain visible for explanation but SHALL NOT be
selectable.

#### Scenario: Disabled capability has stored configuration

- **WHEN** a Disabled capability has a stored credential or owned payload file
- **THEN** Prompt Studio does not read that credential or payload
- **AND** it may read only the activation metadata needed to explain the state

#### Scenario: Disabled provider is listed

- **WHEN** an unavailable provider profile is shown for context
- **THEN** the control identifies it as Disabled
- **AND** the user cannot select it for a run

#### Scenario: Draft names a Disabled provider

- **WHEN** a restored draft names a provider that is now Disabled
- **THEN** Prompt Studio keeps the task text
- **AND** it requires the user to choose an enabled provider before submission
