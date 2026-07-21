## ADDED Requirements

### Requirement: Enhancement input

The system SHALL provide an enhancement form with required rough thoughts and
optional target, project, and research settings.

#### Scenario: Project-agnostic enhancement

- **WHEN** the user submits rough thoughts with no project selected
- **THEN** the system produces a reusable prompt without inventing project-specific files, commands, or constraints

#### Scenario: Target-specific enhancement

- **WHEN** the user selects Generic, Codex, or Claude Code as the target
- **THEN** the system applies that target's prompt profile while preserving the same requested outcome

### Requirement: Simple surface with progressive control

The default enhancement form SHALL expose only rough thoughts, target, and
optional project. Customize SHALL reveal only research depth and one-run
special instructions. Provider selection SHALL remain available through an
Advanced action, while technical library and version SHALL be detected
automatically from the task and selected project.

#### Scenario: Use Smart Defaults

- **WHEN** the user does not open Customize or Advanced
- **THEN** the system uses the evaluated Standard profile with external research off
- **AND** it shows a compact provider, maximum-cost, transmission, and review-before-save summary

#### Scenario: Customize one run

- **WHEN** the user chooses Customize
- **THEN** the system reveals only research depth and special instructions inline
- **AND** changing those controls affects only that enhancement

#### Scenario: Choose a provider explicitly

- **WHEN** the user opens Advanced Provider
- **THEN** the system offers the measured provider profiles without adding them to the normal or Customize form
- **AND** the chosen provider is shown in the compact setup summary

#### Scenario: Review full disclosure

- **WHEN** the user wants the complete pricing or privacy boundary
- **THEN** a secondary action shows it without adding permanent form clutter

### Requirement: Faithful prompt compilation

The system SHALL preserve every explicit user requirement and SHALL distinguish
verified facts, assumptions, and missing information. It SHALL NOT silently add
features, permissions, deadlines, files, commands, or technical facts that were
not supplied or verified.

#### Scenario: Important information is missing but non-blocking

- **WHEN** the enhancer can produce a useful prompt using a reasonable assumption
- **THEN** it records the assumption separately and does not present it as a verified fact

#### Scenario: Important information is missing and blocking

- **WHEN** different answers would materially change the requested work
- **THEN** the result identifies the missing information instead of choosing an answer silently

#### Scenario: Source and user instruction conflict

- **WHEN** retrieved context conflicts with the user's explicit requirement
- **THEN** the result reports the conflict and does not silently overwrite the user's requirement

### Requirement: Complete but lean output

The enhanced prompt SHALL include the relevant outcome, context, requirements,
scope boundaries, success criteria, validation, deliverable, and authorization
boundaries. It SHALL omit irrelevant sections and repeated instructions.

#### Scenario: Simple task

- **WHEN** the rough thoughts already contain enough information for a simple task
- **THEN** the enhancer returns a short prompt without adding ceremonial sections or generic process instructions

#### Scenario: Complex implementation task

- **WHEN** the task spans multiple requirements and has validation or safety constraints
- **THEN** the enhancer organizes the necessary information into clearly labeled sections

### Requirement: Deterministic execution guardrails

Every enhanced prompt SHALL end with one compact, versioned, target-aware
execution-guardrail section applied locally after provider output. The same
normalizer SHALL run before saving an edited result and SHALL replace its own
prior section rather than duplicate it.

The guardrails SHALL require applicable repository instructions and current
state to be inspected; a brief plan for multi-step work but no ceremony for a
trivial one-step task; preservation of user work and unrelated changes;
explicit authorization for destructive, external, paid, production,
infrastructure, or scope-expanding actions; secret protection; safe handling of
retrieved text; proportionate validation and truthful reporting; a focused
question only for materially blocking information or authority; and
preservation of any stricter rule in the prompt.

#### Scenario: Provider omits a safety rule

- **WHEN** a valid provider result does not contain the default execution guardrails
- **THEN** the local normalizer appends the complete canonical section before preview, copy, or save

#### Scenario: Guardrails are normalized again

- **WHEN** an enhanced prompt containing Prompt Studio's guardrail marker is validated again after editing
- **THEN** the system replaces the marked section and keeps exactly one canonical section at the end

#### Scenario: Simple task remains lean

- **WHEN** the task is a trivial one-step change
- **THEN** the guardrail wording permits direct action rather than demanding a ceremonial plan

#### Scenario: User has stricter requirements

- **WHEN** the original prompt sets stricter evidence, safety, scope, or authorization boundaries
- **THEN** the default guardrails preserve those stricter requirements

### Requirement: Structured enhancement result

The enhancement service SHALL return a validated structured result containing a
title, summary, target, enhanced prompt, assumptions, missing information,
visible tags, hidden search terms, taxonomy, sources, and optional project
binding.

#### Scenario: Successful structured response

- **WHEN** the model returns a result matching the required schema
- **THEN** the application renders a preview and makes the result eligible to save

#### Scenario: Invalid structured response

- **WHEN** the model response is missing required fields or contains invalid field types
- **THEN** the application reports the failure and does not save a partial prompt

### Requirement: Search metadata generation

The system SHALL generate five to eight visible tags and twenty to fifty hidden
search terms for each enhanced prompt. Search metadata SHALL cover task type,
technology, artifact, problem, and workflow where applicable.

#### Scenario: Generate discoverable metadata

- **WHEN** enhancement succeeds
- **THEN** the result includes concise display tags and broader synonyms or likely future search phrases without displaying a wall of tags

### Requirement: Preview and control

The main review surface SHALL show exactly the copy-ready enhanced prompt.
Assumptions, missing information, project files, external sources, and search
metadata SHALL remain available through a separate enhancement-details action
without appearing inside the prompt preview or copied text.

#### Scenario: Copy immediately

- **WHEN** the user opens a successful enhancement result
- **THEN** the primary action copies exactly the enhanced prompt body without library, source, project-file, or search metadata

#### Scenario: Review supporting details

- **WHEN** the user chooses Review Enhancement Details
- **THEN** the system shows assumptions, missing information, project files, external sources, and search metadata separately from the copy-ready prompt

#### Scenario: User edits before saving

- **WHEN** the user changes the generated prompt or metadata in the preview
- **THEN** the edited version, not the original generated version, is saved

#### Scenario: User cancels

- **WHEN** the user cancels from the preview
- **THEN** no prompt file is created or changed

### Requirement: Enhancement quality evaluation

The project SHALL maintain a representative evaluation set and SHALL compare
enhancer changes against explicit quality criteria before changing the default
model, model settings, compiler instructions, or deterministic prompt
post-processing.

#### Scenario: Change the compiler instructions

- **WHEN** the enhancement instructions are modified
- **THEN** the evaluation reports fidelity, completeness, unsupported facts, actionability, unnecessary length, latency, and estimated cost against the saved cases

#### Scenario: Change deterministic prompt post-processing

- **WHEN** a local transformation changes the final prompt without changing the provider request
- **THEN** focused tests apply that transformation across representative saved results and verify fidelity, bounded length, ordering, and safety before activation

#### Scenario: Compare another model

- **WHEN** a candidate model is considered for the default
- **THEN** its outputs are reviewed blind against the current default on the same evaluation cases

### Requirement: Prompt-use feedback

The system SHALL let the user record useful or not useful feedback, an optional
critique, the final edited prompt, target application, and an optional outcome
without requiring downstream task data.

#### Scenario: Record useful feedback

- **WHEN** the user marks an enhanced prompt useful
- **THEN** the system stores the prompt version, compiler profile, model profile, project binding, source set, and optional note as a local evaluation record

#### Scenario: Decline outcome collection

- **WHEN** the user does not provide downstream outcome information
- **THEN** the prompt remains usable and no outcome is inferred

#### Scenario: Preserve the judged prompt version

- **WHEN** feedback is recorded and the source prompt is later edited, archived, or deleted
- **THEN** the feedback retains the exact prompt snapshot, metadata, source set, and content digest originally judged

#### Scenario: Edit or delete feedback

- **WHEN** the user edits a feedback record
- **THEN** the system increments the feedback revision without replacing its prompt snapshot
- **AND WHEN** the user deletes the feedback record
- **THEN** only that feedback record is removed and the prompt remains unchanged

#### Scenario: Feedback feature is disabled

- **WHEN** Activation 14 is Disabled
- **THEN** Raycast and CLI feedback flows stop before reading, creating, or changing the feedback directory

### Requirement: Outcome-backed optimization

The system SHALL distinguish one-shot enhancement from optimization that
generates candidate prompts and compares them against saved examples, feedback,
and explicit scoring criteria.

#### Scenario: Insufficient evaluation evidence

- **WHEN** a prompt has too few representative examples or no usable scoring criteria
- **THEN** the system offers enhancement but does not label the result optimized

#### Scenario: Run optimization

- **WHEN** sufficient examples and scoring criteria exist and optimization is active
- **THEN** the system generates multiple candidate prompts, evaluates them on separate development and validation cases, and presents the best-scoring candidate with its score breakdown

#### Scenario: Candidate regresses an important case

- **WHEN** a candidate's aggregate score improves but it fails a protected validation case
- **THEN** the system rejects the candidate or requires explicit human acceptance

#### Scenario: Generate optimization candidates

- **WHEN** the user explicitly selects sufficient feedback, frozen evaluation cases, candidate count, and cost limit
- **THEN** the system shows the exact evidence payload and privacy exclusions before one candidate-generation request
- **AND** it creates two to four additive compiler candidates without changing the active compiler

#### Scenario: Conflicting feedback

- **WHEN** useful and not-useful evidence refer to the same prompt version
- **THEN** the conflict remains visible and the winning candidate must identify every conflicting record it claims to address

#### Scenario: Validate a development winner

- **WHEN** development cases identify the highest-scoring candidate
- **THEN** the system checks that candidate on separate validation cases, blocks any protected-case hard failure or regression, and enforces the explicit cost limit

#### Scenario: Approve an evaluated candidate

- **WHEN** the human approves the winning candidate using its exact policy digest and the active compiler still matches the proposal baseline
- **THEN** the accepted policy becomes current only when optimization is Active and the prior policy remains available for rollback

#### Scenario: Compiler changed after review

- **WHEN** the active compiler digest differs from the proposal baseline
- **THEN** approval stops and requires a new proposal and evaluation

### Requirement: Prompt version history

The system SHALL preserve previous prompt versions and their evaluation records
when an enhanced or optimized version is accepted.

#### Scenario: Roll back a prompt

- **WHEN** the user selects a previous accepted prompt version
- **THEN** that version becomes current without deleting later versions or their evaluation evidence

#### Scenario: Roll back compiler instructions

- **WHEN** the user confirms a prior compiler policy digest
- **THEN** that policy becomes current without deleting later policies, proposals, scores, feedback, or prompt versions
