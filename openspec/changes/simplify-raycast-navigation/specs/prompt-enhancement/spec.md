## MODIFIED Requirements

### Requirement: Preview and control

The main review surface SHALL show exactly the copy-ready enhanced prompt.
Assumptions, missing information, project files, external sources, and search
metadata SHALL remain available through a separate enhancement-details action
without appearing inside the prompt preview or copied text. Copy Prompt SHALL
be the primary action and Paste in Active App SHALL be the secondary action.
Enhancement History SHALL continue to offer both actions.

#### Scenario: Copy immediately

- **WHEN** the user opens a successful enhancement result
- **THEN** the primary action copies exactly the enhanced prompt body without library, source, project-file, or search metadata
- **AND** Paste in Active App remains available as the secondary action

#### Scenario: Review supporting details

- **WHEN** the user chooses Review Enhancement Details
- **THEN** the system shows assumptions, missing information, project files, external sources, and search metadata separately from the copy-ready prompt

#### Scenario: User edits before saving

- **WHEN** the user changes the generated prompt or metadata in the preview
- **THEN** the edited version, not the original generated version, is saved

#### Scenario: User cancels

- **WHEN** the user cancels from the preview
- **THEN** no prompt file is created or changed

## ADDED Requirements

### Requirement: Distilled Capture Inbox actions

Each valid Capture Inbox item SHALL show exactly five first-level actions:
Paste in Active App, Complete Item or Restore Item, Edit Item, More Actions,
and Delete Item. More Actions SHALL contain Copy Item, Enhance Item, Generate
or Regenerate AI Title, Convert to Prompt, Capture Item, Capture Clipboard, and
Review Exact Duplicates. More Actions SHALL NOT contain another submenu.
This requirement supersedes the older Complete Idea Studio actions and Complete
native queue actions requirements.

#### Scenario: Open one active item

- **WHEN** the user opens the item action panel
- **THEN** Paste, Complete, Edit, More Actions, and Delete are immediately visible
- **AND** Copy, Enhance, AI Title, Convert, Capture, Clipboard, and duplicate review appear in More Actions
- **AND** Delete remains destructive and requires confirmation

#### Scenario: Open one completed item

- **WHEN** the user opens a completed item action panel
- **THEN** Restore Item replaces Complete Item
- **AND** the other four first-level actions remain unchanged

### Requirement: Compact Capture Inbox rows

Capture Inbox SHALL identify each item with its full title and capture-type
icon. Body preview, target, enhancement count, title provenance, and saved time
SHALL remain in the detail pane instead of competing for list width.

#### Scenario: Scan the Capture Inbox list

- **WHEN** the split list view is narrow
- **THEN** the item title receives the available row width
- **AND** secondary item facts remain available in the detail pane
