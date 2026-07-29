## ADDED Requirements

### Requirement: Rebuild-safe recorded usage

A development SQLite rebuild SHALL copy every valid usage row present when the
rebuild starts for a prompt that remains in the Markdown library. It SHALL
preserve the recorded count and last-use time exactly. If an existing index
cannot provide readable usage evidence, the rebuild SHALL leave that index
unchanged and report the failure.

#### Scenario: Rebuild a readable index

- **WHEN** a prompt has recorded uses and Prompt Studio rebuilds the index
- **THEN** the rebuilt index contains the same count and last-use time

#### Scenario: Build a missing index

- **WHEN** no prior index exists
- **THEN** Prompt Studio builds a new index without inventing usage

#### Scenario: Prior usage cannot be read

- **WHEN** a prior index exists but its usage rows cannot be read or validated
- **THEN** Prompt Studio does not replace that index
- **AND** it reports that usage preservation could not be established
