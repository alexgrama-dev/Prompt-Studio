## ADDED Requirements

### Requirement: Root Search query handoff

With Prompt Studio configured as the first Raycast fallback, Browse Prompts
SHALL use fallback text as its initial search text. The default Enter action
SHALL paste the selected visible result when it has no unresolved placeholder.
A result with placeholders SHALL open the existing fill form first. Prompt
Studio SHALL NOT paste a result that the user has not seen. For a query of `q`
characters and a result without placeholders, the repeatable path SHALL fall
from `q + 15` keys to `q + 3` keys.

#### Scenario: Launch from fallback search

- **WHEN** the user selects Prompt Studio for unmatched Root Search text and the selected prompt has no placeholders
- **THEN** Browse Prompts opens with that text already applied
- **AND** Enter pastes the selected visible result

#### Scenario: Empty or failed search

- **WHEN** the initial query has no visible result
- **THEN** Prompt Studio does not paste a prompt
- **AND** the query remains visible in the no-result state

### Requirement: Filled prompt preview

The placeholder form SHALL use the existing `{{name}}` syntax and shared
parser. It SHALL update the filled prompt body as values change before Paste
or Copy. The pasted or copied body SHALL match that preview exactly.

#### Scenario: Fill placeholders

- **WHEN** the user enters placeholder values
- **THEN** the form updates and shows the resulting prompt body before use
- **AND** repeated placeholders use one field
- **AND** Paste and Copy use exactly the visible preview body

#### Scenario: Leave a value blank

- **WHEN** a placeholder value is blank
- **THEN** the original token remains visible in the preview

### Requirement: Fast feedback for the last paste

When feedback is Preview or Active, Prompt Studio SHALL retain a one-time
pointer containing the main-library prompt identifier, version evidence, and
paste time in local Raycast storage after Paste succeeds. It SHALL NOT
duplicate the prompt body in that storage. The existing menubar SHALL expose
Rate Last Prompt and SHALL save one explicit verdict for that exact version
through the existing feedback store.

#### Scenario: Rate the last paste

- **WHEN** the user opens Rate Last Prompt after a successful main-library paste
- **THEN** the menubar shows the prompt title and saved version
- **AND** Useful or Not Useful saves feedback for that exact version
- **AND** no rating or outcome is inferred
- **AND** the pointer clears only after the durable feedback write succeeds

#### Scenario: Quick feedback fails

- **WHEN** the feedback write fails
- **THEN** the one-time pointer remains available for retry
- **AND** no verdict is inferred or marked complete

#### Scenario: Paste is already rated

- **WHEN** one quick verdict has been stored for the last paste
- **THEN** Rate Last Prompt does not offer a second verdict for that paste

#### Scenario: Paste an enhancement result

- **WHEN** the user pastes from enhancement preview or history
- **THEN** Prompt Studio does not replace the last-library-paste pointer

#### Scenario: Feedback is disabled

- **WHEN** feedback is Disabled
- **THEN** Paste does not write a last-paste pointer
- **AND** the menubar hides Rate Last Prompt
- **AND** it does not read or mutate last-paste or feedback data

#### Scenario: No last paste exists

- **WHEN** no unrated library-paste pointer exists
- **THEN** the menubar explains that state and offers Browse Prompts

### Requirement: Complete action shortcuts

Every action in Browse results, the Browse no-result state, Placeholder Form,
Enhancement Preview, Enhancement History, and Rate Last Prompt SHALL use its
Raycast-native shortcut or an explicit conflict-free shortcut. Destructive
actions SHALL retain confirmation.

#### Scenario: Review available actions

- **WHEN** the user opens an action panel changed by this work
- **THEN** the primary action uses Enter
- **AND** the secondary action uses Command-Enter
- **AND** every remaining action displays an explicit shortcut
