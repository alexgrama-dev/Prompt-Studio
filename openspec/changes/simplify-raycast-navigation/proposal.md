## Why

Prompt Studio's native Raycast screens work, but the launcher names and Capture
Inbox action hierarchy hide the job each surface performs. Repeated command
icons, inconsistent paste labels, and a long first-level capture action list
slow scanning and keep Delete below the fold.

## What Changes

- Rename the five launcher commands to Prompt Library, Enhance Prompt, Capture
  Inbox, Quick Capture, and Frequent Prompts Menu.
- Give each launcher command a distinct icon while preserving the Prompt Studio
  extension identity.
- Use Paste in Active App and Target consistently across equivalent surfaces.
- Keep five Capture Inbox item actions at the first level: Paste, Complete or
  Restore, Edit, More Actions, and Delete.
- Move Copy, Enhance, AI Title, Convert to Prompt, Capture Item, Capture
  Clipboard, and duplicate review into More Actions.
- Keep Capture Inbox rows focused on the full title and type icon. Move all
  other item facts into the detail pane.
- Make Copy Prompt the visible primary action on a newly enhanced result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-library`: launcher labels, command icons, and consistent prompt-use
  labels.
- `prompt-enhancement`: Capture Inbox naming, item action hierarchy, compact
  rows, and enhanced-result copy priority.

## Impact

- Raycast manifest, Store manifest, native Raycast command surfaces, command
  icon assets, tests, and public command documentation.
- No storage, network, prompt-format, feature-state, or migration change.

## Superseded Behavior

This later navigation decision replaces the following still-active requirements
where they conflict:

- `rough-ideas-workflow` — Complete Idea Studio actions
- `idea-studio-capture-queue` — Complete native queue actions
- `fast-daily-reuse` — Task-based enhancement actions and Complete action
  shortcuts

Their storage, safety, and confirmation guarantees remain in force. Shortcuts
tied to the superseded action layouts are code-defined Raycast action shortcuts
and are replaced by the new hierarchy. They are not persisted user bindings, so
no shortcut migration is required. Launcher command identities remain unchanged,
so user-assigned command shortcuts remain intact. This change affects command
names, icons, action grouping and labels, row presentation, prompt-use labels,
and new-enhancement Copy/Paste priority. It does not change storage, networking,
prompt formats, feature state, or migrations.
