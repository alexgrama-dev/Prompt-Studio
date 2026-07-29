## ADDED Requirements

### Requirement: Explicit search recovery

Prompt Studio SHALL distinguish an empty library, a query with no match, and a
load failure. A no-match state SHALL preserve the query and offer explicit
Enhance This Search when OpenAI enhancement is Preview or Active and Save Rough
Thought when the portable Markdown store is available. Opening either route
SHALL NOT create an authoritative record. Enhance MAY retain its normal local
recovery draft.

#### Scenario: Query has no match

- **WHEN** exact, fallback, and trusted semantic search return no prompt
- **THEN** the no-result state keeps the query visible
- **AND** it offers only the recovery routes whose stated prerequisites are available

#### Scenario: Start a recovery route

- **WHEN** the user opens Enhance This Search or Save Rough Thought
- **THEN** the selected view receives the query
- **AND** no seed, prompt, history, usage, or feedback record is created until the user completes its existing Save action

#### Scenario: Library cannot load

- **WHEN** Markdown records cannot be read
- **THEN** Prompt Studio shows a load failure and a settings or reload action
- **AND** it does not describe the library as empty
