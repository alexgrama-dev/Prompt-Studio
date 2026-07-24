## ADDED Requirements

### Requirement: Durable enhancement history

The system SHALL record every validated enhancement result as a local Markdown
history entry before opening its preview. Automatic history SHALL remain
separate from the current prompt library and SHALL NOT enter the prompt search
index until the user explicitly saves it to the library.

#### Scenario: Enhancement completes while Raycast is not frontmost

- **WHEN** a provider returns a valid enhancement after the user switches to another application
- **THEN** Prompt Studio records the result in enhancement history before relying on the live preview
- **AND** the result remains available after Raycast unloads and recreates the command view

#### Scenario: Revisit a historical enhancement

- **WHEN** the user opens Enhancement History
- **THEN** the system lists prior results newest first
- **AND** the user can copy a result or explicitly save it into the main prompt library

#### Scenario: User never saves to the library

- **WHEN** the user closes or cancels the preview without choosing Save to Prompt Library
- **THEN** the historical enhancement remains available
- **AND** no current prompt-library record is created or changed

### Requirement: Reset-safe enhancement draft

The system SHALL preserve unfinished enhancement form values in Raycast local
storage and restore them when the command view is recreated.

#### Scenario: Raycast unloads an unfinished command

- **WHEN** the user switches away before enhancement completes and Raycast unloads the command
- **THEN** reopening Enhance Prompt restores the unfinished form values
- **AND** no provider request restarts without an explicit user action

## MODIFIED Requirements

### Requirement: Preview and control

The main review surface SHALL show exactly the copy-ready enhanced prompt.
Assumptions, missing information, project files, external sources, and search
metadata SHALL remain available through a separate enhancement-details action
without appearing inside the prompt preview or copied text. A validated result
SHALL enter enhancement history automatically, while the main prompt library
SHALL change only after explicit user approval.

#### Scenario: Copy immediately

- **WHEN** the user opens a successful enhancement result
- **THEN** the primary action copies exactly the enhanced prompt body without library, source, project-file, or search metadata

#### Scenario: Review supporting details

- **WHEN** the user chooses Review Enhancement Details
- **THEN** the system shows assumptions, missing information, project files, external sources, and search metadata separately from the copy-ready prompt

#### Scenario: User edits before saving

- **WHEN** the user changes the generated prompt or metadata in the preview
- **THEN** the edited version, not the original generated version, is saved to the main prompt library

#### Scenario: User cancels

- **WHEN** the user cancels from the preview
- **THEN** no current prompt-library record is created or changed
- **AND** the automatically recorded enhancement-history entry remains available
