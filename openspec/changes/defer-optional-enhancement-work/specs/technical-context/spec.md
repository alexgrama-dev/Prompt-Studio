## ADDED Requirements

### Requirement: On-demand optional credentials

Prompt Studio SHALL read an optional research credential only after that
capability is Preview or Active and the user approves the reviewed request that
needs it. Initial form rendering and unrelated enhancement paths SHALL NOT
inspect the credential.

#### Scenario: Open Enhance Prompt

- **WHEN** the enhancement form first renders
- **THEN** Prompt Studio does not read the Context7 credential

#### Scenario: Context7 is Disabled

- **WHEN** enhancement proceeds without enabled Context7
- **THEN** Prompt Studio does not read the Context7 credential
- **AND** it makes no Context7 request

#### Scenario: Reviewed Context7 request proceeds

- **WHEN** Context7 is Preview or Active and the user approves its exact query
- **THEN** Prompt Studio reads the credential for that request
- **AND** a missing credential produces a clear error without provider fallback
