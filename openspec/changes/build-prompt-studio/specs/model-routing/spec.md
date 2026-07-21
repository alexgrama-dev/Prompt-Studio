## ADDED Requirements

### Requirement: Supported enhancement providers

The system SHALL support OpenAI, Anthropic, and Google as independently
configured enhancement providers.

#### Scenario: Configure one provider

- **WHEN** the user supplies valid credentials for one provider
- **THEN** only that provider becomes eligible for selection or activation

#### Scenario: Provider is inactive

- **WHEN** a provider is disabled
- **THEN** the system makes no request to that provider and does not require its credentials

### Requirement: Explicit model profiles

The system SHALL store versioned profiles containing the provider, model
identifier, reasoning setting, target-agent compiler instructions, supported
tools, and output schema.

#### Scenario: Select a profile

- **WHEN** the user chooses a model profile
- **THEN** the preview identifies the exact provider, model, and reasoning setting that will be used

#### Scenario: Profile becomes invalid

- **WHEN** a provider retires a model or rejects a configured setting
- **THEN** the system disables that profile with a clear migration message rather than silently substituting another model

### Requirement: Measured default selection

The default enhancement profile SHALL be selected using the saved evaluation
set, human preference, unsupported-fact rate, latency, and cost.

#### Scenario: Challenger outperforms the default

- **WHEN** a candidate profile meets the required quality threshold and materially improves the agreed selection criteria
- **THEN** it becomes eligible for controlled activation as the new default

### Requirement: Manual provider choice

The user SHALL be able to override the default model profile for an individual
enhancement.

#### Scenario: One-off provider override

- **WHEN** the user selects a non-default active profile
- **THEN** only that enhancement uses the selected profile and the saved prompt records it

### Requirement: Provider failure behavior

The system SHALL NOT silently send the same prompt or project context to another
provider after a failure.

#### Scenario: Selected provider fails

- **WHEN** the selected provider times out, rejects the request, or reaches a rate limit
- **THEN** the system reports the failure and asks before retrying with a different provider
