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
