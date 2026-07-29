## ADDED Requirements

### Requirement: Root Search query handoff

With Prompt Studio configured as the first Raycast fallback, Browse Prompts
SHALL use fallback text as its initial search text. When the normalized text
matches exactly one active prompt by full identifier, title, or alias and that
prompt has no placeholder, Prompt Studio SHALL paste it immediately. Full
identifier matches MAY resolve directly. Title and alias matches SHALL resolve
only when exactly one active record matches. Partial, semantic, body, tag,
search-term, archived, ambiguous, and placeholder-bearing matches SHALL NOT
paste without review. For an exact query of `q` characters, the repeatable path
SHALL fall from `q + 15` keys to `q + 2` keys.

#### Scenario: Launch one exact prompt from fallback search

- **WHEN** fallback text exactly names one active prompt by full identifier, title, or alias
- **AND** the prompt has no placeholders
- **THEN** Prompt Studio pastes that prompt without a second Enter press
- **AND** records its use only after paste succeeds

#### Scenario: Exact match needs placeholder input

- **WHEN** fallback text exactly names one active prompt with placeholders
- **THEN** Prompt Studio opens the placeholder form
- **AND** does not paste until the user reviews and submits that form

#### Scenario: Match is not uniquely exact

- **WHEN** fallback text has zero exact matches, multiple title or alias matches, or only a partial or meaning-based match
- **THEN** Browse Prompts opens with that text still visible
- **AND** Prompt Studio does not paste an unseen result

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

### Requirement: Remembered non-sensitive placeholder values

The placeholder form SHALL let the user explicitly remember non-sensitive
values for one prompt. Saved values SHALL be local to Prompt Studio, SHALL bind
to the prompt's current update time, and SHALL contain only current placeholder
names and their values. Prompt Studio SHALL save them only after Paste or Copy
succeeds. It SHALL NOT save blanks, prompt bodies, secret-like placeholder
names, or values rejected by the existing secret detector. A storage failure
SHALL NOT block Paste or Copy.

#### Scenario: Remember values after successful use

- **WHEN** the user opts in and successfully pastes or copies a prompt
- **THEN** the next use of the unchanged prompt prefills eligible values
- **AND** the placeholder form still opens for review

#### Scenario: Prompt or placeholders change

- **WHEN** the prompt update time changes or a saved name is no longer a current placeholder
- **THEN** Prompt Studio does not restore that stale value

#### Scenario: Value may contain a secret

- **WHEN** a placeholder name is credential-like or its value matches the existing secret detector
- **THEN** Prompt Studio does not store that name or value
- **AND** Paste or Copy still uses the reviewed form value

#### Scenario: Forget saved values

- **WHEN** the user chooses Forget Saved Values
- **THEN** Prompt Studio removes the saved values for that prompt
- **AND** it does not change the prompt or usage evidence

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
actions SHALL retain confirmation. Browse SHALL keep Paste or Fill and Paste at
the first level. Edit, favorite, duplicate, archive, and delete SHALL appear in
a Manage Prompt submenu. Version, feedback, and improvement actions SHALL
appear in a Review submenu. Status and settings actions SHALL appear in a
System submenu. No submenu SHALL contain another submenu.

#### Scenario: Review available actions

- **WHEN** the user opens an action panel changed by this work
- **THEN** the primary action uses Enter
- **AND** the secondary action uses Command-Enter
- **AND** every remaining action displays an explicit shortcut

#### Scenario: Open the Prompt Studio action menu

- **WHEN** the user opens actions for one prompt
- **THEN** Paste or Fill and Paste remains immediately visible
- **AND** management, review, and system actions are grouped by task
- **AND** destructive actions remain confirmed inside Manage Prompt
