## Why

Enhance Prompt starts local and remote project discovery before Alex asks for
project context. It also reads the Context7 credential while Context7 is
Disabled, and it allows Disabled providers to become a saved selection. These
actions slow the first screen and break the rule that Disabled capabilities do
nothing.

## What Changes

- Render the Enhance form without scanning either Mac or making an SSH request.
- Start project discovery only after an explicit Load Projects choice.
- Read an optional provider or research credential only after its capability is
  enabled and the user reaches the action that needs it.
- Keep Disabled provider profiles visible as unavailable but not selectable.
- Recover a stored draft that names a Disabled provider without discarding the
  task text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `controlled-activation`: a Disabled optional enhancement capability means no
  credential or capability-owned data read.
- `model-routing`: only enabled providers can be selected for a run.
- `technical-context`: optional credentials are read at the reviewed request,
  not on initial render.
- `project-context`: project discovery is explicit and on demand.

## Impact

- Reuses current feature state, project discovery, exact-folder selection, and
  provider profiles.
- Uses the existing `CONTEXT7_API_KEY` environment value on demand instead of
  reading the shared Enhance command preference; it copies or rewrites no
  stored credential.
- Adds no dependency, cache, provider, feature flag, activation-order change,
  default-state change, or network request.
- Keeps Git inspection read-only and keeps Anthropic, Google, and GitHub MCP
  Disabled.
