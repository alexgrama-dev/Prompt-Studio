## ADDED Requirements

### Requirement: Selectable provider availability

Only a provider whose capability is Preview or Active and whose profile is
valid SHALL be selectable for an enhancement. Prompt Studio SHALL NOT silently
replace an unavailable stored choice.

#### Scenario: Provider is Disabled

- **WHEN** the user opens provider selection
- **THEN** the Disabled provider is identified as unavailable
- **AND** it cannot become the submitted or stored selection

#### Scenario: Stored choice is unavailable

- **WHEN** a draft restores a provider that is no longer available
- **THEN** Prompt Studio asks for an enabled provider
- **AND** it does not silently choose another provider
