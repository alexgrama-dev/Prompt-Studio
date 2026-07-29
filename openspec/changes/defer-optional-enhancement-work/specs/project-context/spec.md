## ADDED Requirements

### Requirement: On-demand project discovery

The initial enhancement form SHALL render without scanning local project roots
or making an SSH request. None and exact-folder selection SHALL remain
available immediately. Prompt Studio SHALL start saved-project discovery only
after the user explicitly chooses Load Projects and SHALL run it at most once
per command view.

#### Scenario: Open Enhance Prompt

- **WHEN** the enhancement form first renders
- **THEN** no local project scan or SSH request starts
- **AND** None and exact-folder selection are available

#### Scenario: Load saved projects

- **WHEN** the user explicitly chooses Load Projects
- **THEN** Prompt Studio starts local and configured Mac Mini discovery once

#### Scenario: Mac Mini discovery fails

- **WHEN** the Mac Mini is unavailable after explicit discovery
- **THEN** local project choices remain available
- **AND** project-free enhancement remains available
