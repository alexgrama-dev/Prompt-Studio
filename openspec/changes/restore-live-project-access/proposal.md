# Restore Live Project Access

## Why

Enhance Prompt currently hides configured repositories until Alex opens the
action panel and manually chooses Load Saved Projects. The project picker
therefore looks as if access to both Developer folders was lost.

## What Changes

- When Local Project Context is Preview or Active, discover configured MacBook
  and Mac Mini repositories automatically once per Enhance Prompt view.
- Keep Disabled inert: it performs no folder scan or SSH request.
- Default the personal Mac Mini source to `mini:~/Developer`.
- Keep a manual Refresh Projects action for availability changes.
- Preserve bounded, read-only inspection and the existing exact-folder option.

## Impact

- Affected capability: `project-context`
- Affected files: `package.json`, `src/enhance-prompt.tsx`
- Runtime target: MacBook Pro only
