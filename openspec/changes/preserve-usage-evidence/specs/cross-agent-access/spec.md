## ADDED Requirements

### Requirement: Usage evidence availability

The CLI stats command SHALL describe use counts and last-use times as recorded
evidence, not lifetime reuse. A readable usage source SHALL exist before a
prompt is classified as having no recorded use. When usage evidence is
unavailable, the numeric usage total MAY remain zero for output compatibility,
but Prompt Studio SHALL identify that value as unavailable evidence and SHALL
return no inferred zero-use prompt rows.

#### Scenario: Stats reads valid evidence

- **WHEN** stats reads a valid usage index
- **THEN** it reports recorded counts and last-use times
- **AND** it identifies usage evidence as available

#### Scenario: Feedback exists without recorded usage

- **WHEN** a prompt has feedback but no usage row
- **THEN** stats reports both facts separately
- **AND** it does not claim that the prompt was never used

#### Scenario: Usage evidence is unavailable

- **WHEN** the index is missing, corrupt, or unreadable
- **THEN** stats identifies usage evidence as unavailable
- **AND** any compatible zero total is labeled as unavailable evidence
- **AND** it returns no inferred usage or zero-use prompt rows
- **AND** available feedback totals remain separate
