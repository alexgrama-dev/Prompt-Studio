## ADDED Requirements

### Requirement: Saved prompt seeds

The system SHALL let the user explicitly save the current rough thought as a
local Markdown seed without making a model request. Seeds SHALL remain separate
from the current prompt library and search index.

#### Scenario: Save a thought before enhancement

- **WHEN** the user chooses Save Rough Thought with non-empty rough thoughts
- **THEN** Prompt Studio records the exact thought and selected target in the Seed Inbox
- **AND** no provider request or main-library mutation occurs

#### Scenario: Reuse a saved seed

- **WHEN** the user chooses a seed from the Seed Inbox
- **THEN** Prompt Studio refills the rough-thought and target fields
- **AND** waits for explicit enhancement submission

#### Scenario: Delete a saved seed

- **WHEN** the user confirms Delete Rough Thought in the Seed Inbox
- **THEN** Prompt Studio permanently removes only that saved seed
- **AND** existing enhancement history and main-library prompts remain intact

### Requirement: Seed-to-prompt traceability

Every completed enhancement SHALL retain the exact original rough thought.
When the thought came from a saved seed, the enhanced history and library
records SHALL also retain that seed's identity.

#### Scenario: Enhance a saved seed

- **WHEN** a validated enhancement completes from an unchanged saved seed
- **THEN** the history entry links to that seed
- **AND** the Seed Inbox counts the resulting enhancement

#### Scenario: Edit a saved seed before enhancement

- **WHEN** the user changes the rough thought after selecting or saving a seed
- **THEN** the prior seed identity is removed from the form
- **AND** the completed result still retains the edited rough thought without falsely linking to the prior seed

#### Scenario: Save an enhanced result to the main library

- **WHEN** the user explicitly saves a linked enhancement
- **THEN** the main prompt record preserves the same original thought and optional seed identity
