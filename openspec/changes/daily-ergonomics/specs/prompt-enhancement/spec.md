## ADDED Requirements

### Requirement: Prefilled rough thoughts

The Enhance Prompt command SHALL accept an optional rough-thoughts text
argument from Raycast root search and SHALL prefill the form from that
argument or from Raycast fallback text. An empty argument SHALL open the
normal empty form.

#### Scenario: Argument prefill

- **WHEN** the user types rough thoughts into the command argument before launching Enhance Prompt
- **THEN** the form opens with the rough-thoughts field already containing that text

#### Scenario: Fallback text

- **WHEN** the user launches Enhance Prompt as a fallback for unmatched root-search text
- **THEN** the form opens with the rough-thoughts field containing the search text
