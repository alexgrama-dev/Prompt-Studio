## ADDED Requirements

### Requirement: Evaluation judging receives supplied case context

The evaluation judge SHALL receive the case's supplied project name, project
path, and allowed project files as case-provided evidence. The judge SHALL NOT
score those supplied paths or names as invented facts.

#### Scenario: Supplied file is not an invention

- **WHEN** a frozen case supplies `test/jobs/worker.test.ts` in
  `allowedProjectFiles`
- **AND** the compiled prompt names that file
- **THEN** the judging request includes that path in supplied context
- **AND** the judging instructions state that supplied project context and
  allowed file paths must not be treated as inventions

### Requirement: Product guardrails are exempt from length scoring

The evaluation judge SHALL score appropriate length from the task prompt only.
The product-appended Execution Guardrails block SHALL be shown separately. The
judge SHALL still inspect that block for contradictions, weakened requirements,
authorization defects, or unsafe behavior.

#### Scenario: Guardrails are split from the task prompt

- **WHEN** a compiled prompt contains the Execution Guardrails marker
- **THEN** the judging payload places the text before the marker in
  `taskPrompt`
- **AND** places the marker and following text in
  `productAppendedExecutionGuardrails`
- **AND** omits a combined `enhancedPrompt` field from the judging payload

### Requirement: Accept or reject uses repeated generations

An evaluation run used for compiler accept or reject SHALL generate each case
at least three times by default. The review summary SHALL report a majority
verdict and adjacent flip rate per case. A single-generation report SHALL remain
readable and SHALL NOT be baseline-eligible.

#### Scenario: Majority vote absorbs a minority hard failure

- **WHEN** three reviewed generations of one case include two passing scores
  and one hard failure
- **THEN** the case majority verdict is pass
- **AND** the run remains passing when other published score bars are met
