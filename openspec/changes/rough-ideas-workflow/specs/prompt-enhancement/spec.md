## ADDED Requirements

### Requirement: Three clear daily commands

Raycast SHALL expose Prompt Studio, Enhance Prompt, and Idea Studio as the
three view commands for daily work. The existing menubar MAY remain an
auxiliary command. Idea Studio SHALL replace Seed Inbox and Rough Ideas in all
user-facing labels.

#### Scenario: Review the extension commands

- **WHEN** the user searches for Prompt Studio commands in Raycast
- **THEN** Prompt Studio opens the reusable prompt library
- **AND** Enhance Prompt opens the model-assisted enhancement form
- **AND** Idea Studio opens manually saved ideas

### Requirement: Visible local Idea Studio

Prompt Studio SHALL expose Idea Studio as a top-level Raycast command. Opening
the command without text SHALL show a searchable inbox. Opening it with optional
text SHALL show an explicit-save form prefilled with that text and SHALL NOT
save automatically. Listing, editing, and repair SHALL remain available without
an enabled model provider.

#### Scenario: Open the inbox

- **WHEN** the user opens Idea Studio without text
- **THEN** Raycast shows searchable Ready to Enhance and Enhanced sections
- **AND** the user can create a new idea with Command-N

#### Scenario: Capture from Root Search

- **WHEN** the user opens Idea Studio with optional text
- **THEN** the create form contains that exact text
- **AND** no seed, prompt, history, usage, or feedback record exists until the user chooses Save

#### Scenario: Enhancement is unavailable

- **WHEN** every model provider is Disabled or unavailable
- **THEN** Idea Studio list, edit, repair, and manual-title fallback remain usable
- **AND** no credential, project, provider, or network work starts

### Requirement: Reviewed AI-generated idea titles

Creating an idea SHALL make Generate AI Title the default action. The form
SHALL state that the exact idea text and selected target will be sent to
OpenAI. Prompt Studio SHALL read one encrypted extension-wide OpenAI password
preference only after the OpenAI capability is Preview or Active and the user
chooses that action. The response SHALL contain one plain-text title, SHALL be
validated for length and format, and SHALL be shown in an editable review
before Save Idea writes the Markdown record. No API key, prompt body, or title
request SHALL be stored outside the normal idea record.

#### Scenario: Generate a title for a new idea

- **WHEN** the user chooses Generate AI Title with non-empty idea text
- **THEN** Prompt Studio sends only that text, its target, and the bounded title instruction to OpenAI
- **AND** shows the validated title with the unchanged idea for review
- **AND** writes no idea until the user chooses Save Idea

#### Scenario: Title generation fails

- **WHEN** OpenAI is Disabled, missing its key, returns invalid output, or fails
- **THEN** Idea Studio keeps the exact unsaved draft
- **AND** makes no provider fallback
- **AND** offers a clearly labeled manual-title path

#### Scenario: Title an earlier idea

- **WHEN** an existing idea has no AI-title provenance and the user chooses Generate AI Title
- **THEN** Idea Studio shows the generated title for review
- **AND** retains the idea identifier, exact body, target, and links after Save

#### Scenario: Existing enhancement key

- **WHEN** the encrypted OpenAI preference is configured for the extension
- **THEN** Enhance Prompt and Idea Studio use that one preference
- **AND** neither command copies the key to Raycast local storage, Markdown, logs, CLI state, or MCP state

### Requirement: Repeat-safe editable ideas

Saving a rough idea SHALL preserve its exact text and target in the existing
local Markdown seed store. A save whose normalized text and target exactly
match an unconsolidated idea SHALL return that existing idea instead of writing
a duplicate. The user SHALL be able to edit one idea while retaining its
identity.

#### Scenario: Save the same idea twice

- **WHEN** the normalized text and target exactly match an existing idea
- **THEN** Prompt Studio returns the existing identifier
- **AND** writes no second seed file

#### Scenario: Edit an idea

- **WHEN** the user edits and saves an Idea Studio record
- **THEN** Prompt Studio updates that Markdown record
- **AND** retains its identifier and existing enhancement links

### Requirement: Explicit duplicate consolidation

Prompt Studio SHALL identify historical duplicates only when normalized text
and target match exactly. It SHALL preview each group, the retained record, the
records removed, and the number of linked enhancement and prompt records before
asking for confirmation. After confirmation, the oldest record SHALL retain the
removed identifiers as aliases and the duplicate seed files SHALL be removed.
Existing enhancement-history and main-prompt records SHALL not be rewritten,
deleted, or recounted.

#### Scenario: Review duplicates

- **WHEN** exact historical duplicates exist
- **THEN** Idea Studio shows a Review Exact Duplicates action
- **AND** the review names the retained idea, removal count, and linked-record count
- **AND** no file changes before confirmation

#### Scenario: Confirm consolidation

- **WHEN** the user confirms one reviewed duplicate group
- **THEN** the oldest seed retains every removed seed identifier as an alias
- **AND** duplicate seed files are removed
- **AND** old seed links resolve to the retained idea
- **AND** enhancement-history and main-prompt record counts remain unchanged

#### Scenario: Cancel consolidation

- **WHEN** the user cancels the review
- **THEN** no seed, history, prompt, usage, or feedback file changes

### Requirement: Honest recovery states

Idea Studio SHALL distinguish an empty inbox, a history-read failure, a
seed-read failure, and invalid seed Markdown. Valid ideas SHALL remain usable
when enhancement history cannot load. Invalid files SHALL appear under Needs
Repair with Open File and Show in Finder actions.

#### Scenario: History cannot load

- **WHEN** valid seed Markdown loads but enhancement history fails
- **THEN** Idea Studio still lists the valid ideas
- **AND** marks enhancement counts unavailable

#### Scenario: Seed file is invalid

- **WHEN** one seed Markdown file cannot be parsed
- **THEN** valid ideas remain visible
- **AND** the invalid file appears under Needs Repair
- **AND** no automatic rewrite or deletion occurs

### Requirement: Explicit enhancement handoff

Pressing Enter on a valid Idea Studio record SHALL open Enhance Prompt with the exact
idea text, target, and canonical seed identity. It SHALL not make a model
request until the user explicitly submits the enhancement form. Editing the
text after handoff SHALL clear the seed link as specified by Saved prompt seeds.

#### Scenario: Enhance one idea

- **WHEN** the user presses Enter on a valid Idea Studio record
- **THEN** Enhance Prompt opens with its text and target
- **AND** no model request starts
- **AND** a later unchanged result links to the canonical idea

### Requirement: Complete Idea Studio actions

The Idea Studio list, create form, title review, edit form, duplicate review, repair state,
and Enhance Prompt idea actions SHALL use plain-language labels and a native or
explicit conflict-free shortcut for every action. Deletion and consolidation
SHALL retain confirmation. The primary Enhance or Generate Title action SHALL
stay at the first level. Create and Edit SHALL appear in an Idea submenu,
duplicate review and deletion SHALL appear in an Organize submenu, and recovery
actions SHALL appear in a Repair submenu. No submenu SHALL contain another
submenu.

#### Scenario: Review Rough Ideas actions

- **WHEN** the user opens an Idea Studio action panel changed by this work
- **THEN** the primary action uses Enter
- **AND** create uses Command-N and edit uses Command-E
- **AND** every remaining action displays a shortcut
- **AND** destructive actions require confirmation
