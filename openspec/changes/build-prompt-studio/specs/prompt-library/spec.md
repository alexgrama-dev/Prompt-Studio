## ADDED Requirements

### Requirement: Portable prompt records

The system SHALL store each prompt as a Markdown file containing a versioned,
machine-readable metadata block and a human-readable prompt body. The Markdown
directory SHALL remain the source of truth.

#### Scenario: Save a new prompt

- **WHEN** the user saves a valid new or enhanced prompt
- **THEN** the system writes one readable Markdown file containing its title, summary, target, tags, search terms, timestamps, source records, optional project binding, and prompt body

#### Scenario: Read an existing prompt

- **WHEN** the prompt directory contains a valid prompt file
- **THEN** the system loads the prompt without requiring a database or network connection

#### Scenario: Encounter an invalid prompt file

- **WHEN** one prompt file has missing or malformed required metadata
- **THEN** the system identifies that file as invalid without preventing valid prompts from loading

### Requirement: Visual prompt discovery

The system SHALL present prompts in a searchable Raycast list with a detail
preview. Search SHALL match titles, summaries, visible tags, and hidden search
terms.

#### Scenario: Open Prompt Studio from Raycast

- **WHEN** the user searches for the extension in Raycast
- **THEN** the global results expose Prompt Studio and Enhance Prompt as the two daily entry points
- **AND** manual saving and Feature Status remain available inside Prompt Studio rather than as competing global commands
- **AND** disabled feedback and optimization capabilities remain hidden

#### Scenario: Find a prompt without knowing its name

- **WHEN** the user searches with a related problem description or synonym contained in a prompt's search terms
- **THEN** the matching prompt appears in the result list

#### Scenario: Filter prompts

- **WHEN** the user selects a target, project, or task-type filter
- **THEN** the list shows only prompts matching the selected filter

#### Scenario: Preview a result

- **WHEN** the user selects a prompt
- **THEN** the detail pane first explains what the prompt does in wrapping text, then shows the complete prompt body
- **AND** library tags, search metadata, supporting assumptions, validation notes, and source records do not appear after the prompt body or look like part of the copy-ready prompt

### Requirement: Reuse across coding applications

The system SHALL let the user copy a complete prompt from the visual library to
the system clipboard.

#### Scenario: Copy a prompt

- **WHEN** the user invokes the primary copy action on a prompt
- **THEN** the complete prompt body is placed on the clipboard for use in Codex, Claude Code, or another application

### Requirement: Prompt maintenance

The system SHALL let the user create, edit, duplicate, and delete prompt records
without hand-editing Markdown.

#### Scenario: Save an existing prompt without enhancement

- **WHEN** the user pastes a non-empty prompt and chooses Save Existing Prompt
- **THEN** the prompt body is stored exactly as entered without calling an AI model or external service

#### Scenario: Find manual save from a populated library

- **WHEN** the user opens Browse Prompts with saved prompts already present
- **THEN** the search surface advertises the keyboard shortcut for saving another prompt without AI enhancement

#### Scenario: Edit a prompt

- **WHEN** the user changes a prompt's body or metadata and confirms the edit
- **THEN** the corresponding Markdown file is updated and the list reflects the change

#### Scenario: Delete a prompt

- **WHEN** the user confirms deletion
- **THEN** the prompt file is removed and the action is not performed without confirmation

### Requirement: Useful empty and failure states

The system SHALL explain how to recover when the prompt directory is missing,
empty, unreadable, or contains invalid records.

#### Scenario: Empty library

- **WHEN** the configured prompt directory contains no valid prompt files
- **THEN** the system offers a clear action to create or enhance the first prompt

#### Scenario: Unreadable directory

- **WHEN** the configured prompt directory cannot be read
- **THEN** the system reports the directory problem and does not replace or delete existing files
