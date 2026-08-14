## ADDED Requirements

### Requirement: Last Enhance setup is restored

Enhance Prompt SHALL remember the last used target and project after a
successful generate. When launch does not name a target, it SHALL restore
that target. When the last project is still a discovered or recent path and
the form has no project yet, it SHALL restore that project.

#### Scenario: Launch with thoughts keeps last target

- **WHEN** the user launches Enhance with rough thoughts and no launch target
- **THEN** the form uses the last successful target instead of always Codex

#### Scenario: Last project is selected when still known

- **WHEN** the last project path is in Recent, MacBook, or Mini discovery
- **AND** the form project is still none
- **THEN** that project is selected

### Requirement: Blocking questions before generate

When `planCompilerStages` produces elicitation questions, Enhance Prompt
SHALL show at most three questions before any enhancement model call. Answers
SHALL append to the rough thoughts. Skipping SHALL proceed with the existing
missing-information compiler path. After the form, the compiler addendum
SHALL NOT say elicitation is off.

#### Scenario: Bugfix without expected versus actual

- **WHEN** the thoughts are a bugfix without expected versus actual behavior
- **THEN** Enhance asks before generate and does not call the compiler first

#### Scenario: User skips questions

- **WHEN** the user continues without answers
- **THEN** generate still runs and missing information stays listed

### Requirement: Similar prompts are compiler few-shots only

Before generate, Enhance Prompt SHALL recall up to two similar library
prompts by lexical search over saved records. Those bodies SHALL be passed
to `enhancementCompilerInstructions` as style examples. They SHALL NOT be
copied into `enhancedPrompt` as project facts the user did not name.

#### Scenario: Empty library

- **WHEN** the library has no prompts
- **THEN** generate proceeds with no similar-prompt section

### Requirement: Judged variants are the default Enhance path

The Enhance Prompt variant preference default SHALL be 3. Variant ranking
SHALL use the v2 Anthropic judge when an Anthropic key is present, otherwise
the v1 OpenAI judge. Each variant record SHALL include required facts and
prohibited inventions derived from this request, not empty checklists.

#### Scenario: Anthropic key present

- **WHEN** variants are 2 or more and an Anthropic key is saved
- **THEN** scoring uses the twelve-dimension v2 judge

#### Scenario: Only OpenAI key present

- **WHEN** variants are 2 or more and no Anthropic key is saved
- **THEN** scoring uses the v1 OpenAI judge with derived facts

### Requirement: Hard anti-patterns block library save

Preview SHALL show anti-pattern findings. Save to Prompt Library and editor
save SHALL refuse when any hard finding remains (`fabricated-specifics`,
`injection-passthrough`, `merged-conflict-rendering`, `unguarded-tool-trust`).
Copy and paste SHALL remain available. An edit that clears hard findings
SHALL allow save.

#### Scenario: Injection passthrough

- **WHEN** the compiled prompt copies instruction-shaped untrusted text
- **THEN** Save to Prompt Library is refused until the user edits it out

### Requirement: Downstream fixtures exist

`evals/fixtures` SHALL contain three license-clean fixture trees: one
bugfix, one diagnose-only, and one UI change. Each manifest `successChecks`
SHALL be a command the future runner can execute. The planner SHALL load
them without `--confirm-spend` as a dry run.

#### Scenario: Default planner without spend confirmation

- **WHEN** `planDownstreamEvaluation({})` runs against the repo fixtures
- **THEN** mode is dry-run, skip reason is `no-confirm-spend`, and at least
  three fixtures load
