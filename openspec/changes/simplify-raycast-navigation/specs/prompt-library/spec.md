## MODIFIED Requirements

### Requirement: Visual prompt discovery

The system SHALL present prompts in a searchable Raycast list with a detail
preview. Search SHALL match titles, summaries, visible tags, and hidden search
terms. The Raycast launcher SHALL expose Prompt Library, Enhance Prompt, Capture
Inbox, Quick Capture, and Frequent Prompts Menu. Each command SHALL use a
distinct command icon. The extension SHALL remain named Prompt Studio.

#### Scenario: Open Prompt Studio from Raycast

- **WHEN** the user searches for the extension in Raycast
- **THEN** the five job-based titles appear
- **AND** no two commands use the same icon asset
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

## ADDED Requirements

### Requirement: Consistent prompt-use language

Prompt Library and its placeholder form SHALL label the action that inserts
text into the frontmost application as Paste in Active App. Prompt target
selectors and metadata SHALL use Target.

#### Scenario: Review equivalent prompt actions

- **WHEN** the user opens a saved prompt or placeholder form
- **THEN** the insertion action is named Paste in Active App
- **AND** target fields are named Target

### Requirement: Clear optional action groups

Prompt Library SHALL group review actions under Review & Improve and settings
under Settings & Status. Enhance Prompt SHALL group setup choices under Setup &
Context, saved results under History & Captures, and provider controls under
Settings & Quality. These submenus SHALL contain no submenu.

#### Scenario: Open an optional-action group

- **WHEN** the user opens a Prompt Library or Enhance Prompt action panel
- **THEN** each submenu names the job performed by its children
- **AND** the primary task remains outside the submenus
