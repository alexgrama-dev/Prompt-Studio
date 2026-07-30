## ADDED Requirements

### Requirement: Typed local capture items

Idea Studio SHALL support Next Prompt, Keep, and Idea items in local seed
Markdown. The item kind and optional completion time SHALL be validated before
write. Seed Markdown without capture metadata SHALL remain valid and SHALL
behave as an active Idea without an automatic rewrite.

#### Scenario: Read an earlier idea

- **WHEN** Idea Studio reads valid seed Markdown without capture metadata
- **THEN** it treats the record as an active Idea
- **AND** it does not rewrite the file

#### Scenario: Save a typed item

- **WHEN** the user reviews and saves a Next Prompt, Keep, or Idea
- **THEN** Prompt Studio writes the selected kind to that seed Markdown
- **AND** writes no completion time for an active item

### Requirement: Three capture queue sections

Idea Studio SHALL group active Next Prompt items under Up Next. It SHALL group
active Keep and Idea items under Saved for Later. It SHALL group every completed
item under Completed. Invalid seed Markdown SHALL remain visible under Needs
Repair. Search SHALL continue to cover title, body, target, aliases, and kind.

#### Scenario: Open the capture queue

- **WHEN** valid items of every kind and state exist
- **THEN** active Next Prompt items appear under Up Next
- **AND** active Keep and Idea items appear under Saved for Later
- **AND** completed items appear under Completed
- **AND** no record appears in more than one section

### Requirement: Separate paste and completion

Every valid capture item SHALL offer a native Paste action that inserts the
exact body into the frontmost application and writes no prompt or completion
state. Completing an item SHALL require a separate action that records a
completion time. A completed item SHALL offer Restore, which removes the
completion time without changing its kind, body, identity, or links.

#### Scenario: Paste a next prompt

- **WHEN** the user chooses Paste for an active Next Prompt
- **THEN** Raycast inserts the exact captured body into the frontmost application
- **AND** the item remains active under Up Next

#### Scenario: Complete and restore an item

- **WHEN** the user chooses Complete
- **THEN** the same item moves to Completed with a completion time
- **WHEN** the user later chooses Restore
- **THEN** the same item returns to the section selected by its kind

### Requirement: Manual selected-text and clipboard capture

Idea Studio SHALL retain manual capture and SHALL offer a Capture Clipboard
action that reads current plain text only after the user selects that action.
The capture form SHALL preserve the exact text and let the user review its kind,
target, and title before saving. The auxiliary Quick Capture command SHALL
declare no command arguments, so its global hotkey runs immediately. It SHALL
use selected text when available, otherwise clipboard text, and save it as a
Next Prompt. It SHALL make no network, provider, credential, project,
background, usage, or feedback work.

#### Scenario: Capture clipboard text with review

- **WHEN** the user chooses Capture Clipboard and plain text exists
- **THEN** Idea Studio opens a form containing that exact text
- **AND** writes nothing until the user chooses Save

#### Scenario: Run Quick Capture

- **WHEN** Quick Capture finds selected text or clipboard text
- **THEN** it immediately saves one repeat-safe local Next Prompt
- **AND** concurrent identical captures resolve to one item and one file
- **AND** reports whether the item was saved or reused
- **AND** performs no network request

#### Scenario: Quick Capture finds a conflicting claimed file

- **WHEN** the deterministic capture path contains a different valid item
- **THEN** Quick Capture rejects the identity conflict
- **AND** preserves the conflicting file unchanged for repair

#### Scenario: Quick Capture has no text

- **WHEN** selected text and clipboard text are both unavailable
- **THEN** Quick Capture writes nothing
- **AND** tells the user to select or copy text

### Requirement: Repeat-safe direct prompt conversion

Every valid capture item SHALL offer Convert to Prompt. A review form SHALL show
editable title, body, and target before saving. The saved library prompt SHALL
link to the canonical seed identity. Repeating conversion for the same seed
SHALL return the same library prompt without creating another prompt or version.

#### Scenario: Convert one captured item

- **WHEN** the user reviews and saves a captured item as a prompt
- **THEN** Prompt Studio creates one main-library prompt with that reviewed content
- **AND** links it to the captured item's canonical seed identity

#### Scenario: Repeat conversion

- **WHEN** the same captured item is converted again
- **THEN** Prompt Studio returns the existing linked library prompt
- **AND** creates no duplicate prompt or version

### Requirement: Complete native queue actions

Idea Studio SHALL keep every item action at the first action level. It SHALL
group actions under the flat Use, Improve, Add, and Maintenance sections.
Deletion SHALL appear under Maintenance and retain confirmation. Every changed
action SHALL display a native or explicit conflict-free shortcut. The item
action panel SHALL contain no submenu.

#### Scenario: Review an item action panel

- **WHEN** the user opens an active or completed item action panel
- **THEN** Paste and Complete or Restore are separate actions
- **AND** every item action is visible without opening a submenu
- **AND** Delete Item appears under Maintenance
- **AND** every action displays a shortcut
- **AND** destructive actions require confirmation
