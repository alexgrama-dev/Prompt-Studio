## ADDED Requirements

### Requirement: Completed enhancement draft boundary

The Raycast recovery draft SHALL represent unfinished work only. Prompt Studio
SHALL clear it after a validated enhancement is written successfully to
Enhancement History and before preview. It SHALL retain the draft when
generation, validation, cancellation, or the history write does not complete.
Explicit launch text SHALL override a stored draft.

#### Scenario: Enhancement history succeeds

- **WHEN** a validated result is written to Enhancement History
- **THEN** Prompt Studio clears the recovery draft before opening preview
- **AND** a later empty launch does not restore the completed work

#### Scenario: Enhancement does not complete

- **WHEN** generation, validation, cancellation, or the history write does not complete
- **THEN** Prompt Studio keeps the unfinished draft
- **AND** no provider request restarts automatically

#### Scenario: Enhancement history write fails

- **WHEN** a validated result cannot be written to Enhancement History
- **THEN** Prompt Studio blocks preview and reports the history failure
- **AND** it keeps the recovery draft for an explicit retry
- **AND** while the command view remains open, retrying the history write does not repeat the model call

#### Scenario: Explicit launch text is present

- **WHEN** Raycast launches Enhance Prompt with explicit text and a draft exists
- **THEN** the explicit text becomes the current task
- **AND** the stored task does not replace it

### Requirement: Repeat-safe history promotion

Saving one Enhancement History result to the main library SHALL require its
history identifier and reviewed content digest, meaning its content hash. It
SHALL create or update one stable prompt. Repeating the same approved Save
action after a process restart SHALL return that prompt instead of creating
another file. A later approved edit SHALL update the same prompt through normal
version history.

#### Scenario: Save a history result once

- **WHEN** the user approves one Enhancement History result for the library
- **THEN** Prompt Studio creates one library prompt and returns its identifier

#### Scenario: Repeat the same save

- **WHEN** the user repeats approval for the same unchanged history result after a process restart
- **THEN** Prompt Studio returns the same library prompt identifier
- **AND** it creates no extra prompt file or version

#### Scenario: History changed after review

- **WHEN** the history body no longer matches the reviewed content digest
- **THEN** Prompt Studio rejects the save and asks for a new review
- **AND** it creates or updates no library prompt

#### Scenario: Approve a later edit

- **WHEN** the user edits that history result and approves it again
- **THEN** Prompt Studio updates the same library prompt
- **AND** normal prompt version history preserves the previous approved body

### Requirement: Visible hidden-store repair

Seed Inbox and Enhancement History SHALL display invalid Markdown records with
their filename, validation error, and an Open File or Open Folder recovery
action. Valid neighboring records SHALL remain usable. Prompt Studio SHALL NOT
rewrite or delete an invalid record automatically.

#### Scenario: One hidden record is invalid

- **WHEN** Seed Inbox or Enhancement History contains valid and invalid files
- **THEN** valid records remain available
- **AND** each invalid file appears in a repair section
- **AND** the user can open the file or its containing folder

#### Scenario: Every hidden record is invalid

- **WHEN** every file in one hidden store is invalid
- **THEN** Prompt Studio shows a repair state instead of an empty state

### Requirement: Truthful enhancement completion state

Prompt Studio SHALL distinguish success, cancellation, and failure. It SHALL
not label a user cancellation as an enhancement failure.

#### Scenario: User cancels generation

- **WHEN** the user cancels an in-progress enhancement
- **THEN** Prompt Studio reports that the run was cancelled
- **AND** it does not claim provider or validation failure

### Requirement: Cross-surface durable enhancement history

Prompt Studio SHALL record every validated Raycast, CLI, and MCP enhancement
result as a local Markdown history entry before previewing or returning it.
Each entry SHALL retain the exact original thought and an unchanged saved-seed
identifier when one exists. Automatic history SHALL remain outside the prompt
search index until a separate approved Save action adds it to the library.

#### Scenario: Any enhancement surface completes

- **WHEN** Raycast, CLI, or MCP produces a validated enhancement
- **THEN** Prompt Studio records its result and original thought in Enhancement History first
- **AND** it returns the history identifier with the result

#### Scenario: Saved seed was unchanged

- **WHEN** enhancement starts from a saved seed without changing its thought
- **THEN** the history record retains that seed identifier

#### Scenario: User never saves to the library

- **WHEN** the user closes, copies, pastes, or cancels the preview without a separate approved Save action
- **THEN** the history entry remains available
- **AND** no current prompt-library record is created or changed
