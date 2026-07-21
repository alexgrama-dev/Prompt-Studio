## ADDED Requirements

### Requirement: Paste-first prompt use

The system SHALL offer Paste into the frontmost application as the primary
action for a prompt and Copy to clipboard as the secondary action. Both
actions SHALL record a use event when the search index is available.

#### Scenario: Paste a prompt

- **WHEN** the user presses Enter on a prompt in the library
- **THEN** the prompt body is pasted into the frontmost application and a use event is recorded

#### Scenario: Copy remains available

- **WHEN** the user invokes the copy action
- **THEN** the prompt body is copied to the clipboard and a use event is recorded

### Requirement: Usage-ranked default ordering

The system SHALL order the default unsearched prompt list by recorded use
recency and frequency, falling back to update time for prompts without
recorded use. A missing or unavailable index SHALL fall back to update-time
ordering without an error.

#### Scenario: Frequently used prompt rises

- **WHEN** one prompt has recorded use events and another has none
- **THEN** the used prompt is listed first in the default view

#### Scenario: Index unavailable

- **WHEN** the SQLite index cannot be read
- **THEN** the list falls back to update-time ordering and stays usable

### Requirement: Placeholder variables

The system SHALL treat `{{name}}` tokens in a prompt body as placeholders.
When a prompt containing placeholders is pasted or copied, the system SHALL
collect a value for each distinct placeholder first and use the filled body.

#### Scenario: Use a prompt with placeholders

- **WHEN** the user pastes a prompt whose body contains `{{goal}}`
- **THEN** a form asks for the goal value and the pasted body contains the value instead of the token

#### Scenario: Prompt without placeholders

- **WHEN** the body contains no placeholder tokens
- **THEN** paste and copy proceed immediately without a form

### Requirement: Menubar quick access

The system SHALL provide a macOS menubar command listing the most-used
prompts for one-click copy without opening the main Raycast window.

#### Scenario: Copy from the menubar

- **WHEN** the user clicks a prompt title in the menubar list
- **THEN** the prompt body is copied to the clipboard and a use event is recorded

#### Scenario: No usage yet

- **WHEN** no prompt has recorded use events
- **THEN** the menubar lists the most recently updated prompts instead

### Requirement: Feedback nudge after repeated use

The system SHALL passively suggest recording feedback after repeated use of
the same prompt, without blocking the use action.

#### Scenario: Repeated use

- **WHEN** the same prompt reaches a repeated-use threshold
- **THEN** the confirmation toast mentions that feedback can be recorded, and the paste or copy still completes normally
