## MODIFIED Requirements

### Requirement: Preview and control

The main review surface SHALL show exactly the copy-ready enhanced prompt.
Assumptions, missing information, project files, external sources, and search
metadata SHALL remain available through a separate details action. A validated
result SHALL enter enhancement history automatically. Paste into the frontmost
application SHALL be the primary action, Copy SHALL be secondary, and neither
action SHALL save to the main prompt library.

#### Scenario: Paste immediately

- **WHEN** the user presses Enter on a successful enhancement preview
- **THEN** Raycast pastes exactly the enhanced prompt body
- **AND** no library prompt is created or changed

#### Scenario: Copy remains available

- **WHEN** the user presses Command-Enter on a successful preview
- **THEN** Raycast copies exactly the same enhanced prompt body

#### Scenario: Paste from history

- **WHEN** the user presses Enter on an Enhancement History result
- **THEN** Raycast pastes that result into the frontmost application
- **AND** no library prompt is created or changed

#### Scenario: Copy from history

- **WHEN** the user presses Command-Enter on an Enhancement History result
- **THEN** Raycast copies exactly the visible history body
- **AND** no library prompt is created or changed

#### Scenario: Review supporting details

- **WHEN** the user chooses Review Enhancement Details
- **THEN** the system shows assumptions, missing information, project files, external sources, and search metadata separately

#### Scenario: User edits before saving

- **WHEN** the user changes the generated prompt or metadata before approval
- **THEN** the edited version is used by the separate library-save action

#### Scenario: User cancels

- **WHEN** the user cancels from the preview
- **THEN** no current prompt-library record is created or changed
- **AND** the enhancement-history entry remains available

### Requirement: Task-based enhancement actions

Enhance Prompt SHALL keep its current primary Generate, Paste, or Continue
action at the first level. Project and research actions SHALL appear in a
Context submenu. Saved ideas and enhancement history SHALL appear in a Saved
Work submenu. Provider evaluation, feature status, and preferences SHALL appear
in a System submenu. Saving a validated result to the prompt library SHALL
remain visible in review but SHALL not replace Paste as the primary action. No
submenu SHALL contain another submenu.

#### Scenario: Open an Enhance Prompt action menu

- **WHEN** the user opens an action panel in Enhance Prompt
- **THEN** the next step in the current enhancement remains immediately visible
- **AND** optional context, saved work, and system controls are grouped by task
- **AND** no required step is hidden behind a submenu
