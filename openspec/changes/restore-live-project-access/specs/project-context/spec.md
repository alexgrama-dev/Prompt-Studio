## ADDED Requirements

### Requirement: Live configured project discovery

When Local Project Context is Preview or Active, the enhancement form SHALL
automatically discover Git repositories under the configured local roots and
the configured SSH root once per command view. Disabled SHALL continue to
perform no local scan or SSH request. The user SHALL be able to refresh the
same bounded discovery explicitly.

#### Scenario: Open Enhance Prompt with project context enabled

- **WHEN** Enhance Prompt opens while Local Project Context is Preview or Active
- **THEN** configured MacBook and Mac Mini discovery starts automatically
- **AND** the Project picker updates with Recent, MacBook, and Mac Mini groups

#### Scenario: Open Enhance Prompt with project context disabled

- **WHEN** Enhance Prompt opens while Local Project Context is Disabled
- **THEN** no local folder scan or SSH request starts
- **AND** No Project remains available

#### Scenario: Refresh configured projects

- **WHEN** the user chooses Refresh Projects
- **THEN** Prompt Studio repeats one bounded local and SSH discovery
- **AND** overlapping refresh requests do not run concurrently

#### Scenario: Mac Mini is unavailable

- **WHEN** automatic or refreshed SSH discovery fails
- **THEN** discovered MacBook repositories and No Project remain available
- **AND** the form explains that only Mac Mini projects are unavailable
