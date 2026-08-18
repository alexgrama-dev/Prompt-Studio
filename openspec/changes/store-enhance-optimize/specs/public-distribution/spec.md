## MODIFIED Requirements

### Requirement: Honest Store surface

The Raycast Store package SHALL expose Prompt Library, Enhance Prompt, and
Frequent Prompts. It SHALL request only a local prompt-directory preference on
install. Enhance Prompt SHALL start with the task and SHALL request a provider
key only when the user submits an enhancement.

#### Scenario: Inspect the Store manifest

- **WHEN** the public Store package is prepared
- **THEN** its commands are Prompt Library, Enhance Prompt, and Frequent Prompts
- **AND** its only preference is the local prompt directory
- **AND** it contains no provider credential, remote project, SSH, or external search setting

#### Scenario: Open a fresh Store installation

- **WHEN** a user installs Prompt Studio without changing preferences
- **THEN** the user can create, browse, search, preview, paste, and copy local prompts
- **AND** Enhance Prompt opens on the task form without requesting a credential
- **AND** Prompt Library and Frequent Prompts make no Prompt Studio network request
- **AND** the commands load without requiring `node:sqlite`

#### Scenario: Enhance after first open

- **WHEN** the user submits Enhance Prompt without a saved provider key
- **THEN** Prompt Studio asks for a one-run key
- **AND** the compiled prompt is reviewed before save or copy
