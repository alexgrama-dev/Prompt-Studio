## ADDED Requirements

### Requirement: User thresholds are exact lower bounds

The compiler SHALL restate user-stated evidence, proof, authorization, and
safety thresholds at least as strictly as the user stated them and SHALL NOT
soften them.

#### Scenario: Proof threshold preserved

- **WHEN** the rough thoughts authorize a fix only when the cause is proven
- **THEN** the enhanced prompt requires proof before a fix and does not substitute a weaker standard such as strong suggestion

### Requirement: Conditional rendered-UI verification

Target adaptations SHALL require rendered UI verification only for tasks
that can change rendered user-interface behavior and SHALL omit UI
verification language from prompts for tasks that cannot.

#### Scenario: Non-UI task

- **WHEN** the rough thoughts describe an API or test-only task with no user interface
- **THEN** the enhanced prompt contains no rendered-UI verification requirement

### Requirement: Grounded discovery metadata

Tags, aliases, and hidden search phrases SHALL name a specific technology,
framework, standard, or tool only when the user or supplied context named
it; otherwise the metadata SHALL describe the category generically.

#### Scenario: Technology-neutral request

- **WHEN** the rough thoughts do not name a framework
- **THEN** generated metadata uses generic category terms instead of naming a specific framework
