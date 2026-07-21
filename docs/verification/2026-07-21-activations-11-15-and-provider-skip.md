# Provider Skip Decision and Activations 11–15

Date: 2026-07-21  
Runtime: MacBook Pro  
Build and test host: Mac Mini mirror at `~/Developer/work/prompt-studio`

## Decision: Activations 9 and 10 skipped by user choice

Alex chose not to fund live Anthropic or Google evaluation runs. Following the
Activation 8 precedent, both providers are recorded as skipped:

- `anthropic-provider` moved Preview → Disabled with recorded history.
- `google-provider` is Disabled.
- Both registry entries now default to Disabled, no longer block later
  activations, and state the skip in their descriptions.
- The tested implementations, provider profiles, and frozen 24-case evaluation
  remain in the initial architecture for future opt-in. Both dry runs passed
  before the decision (Anthropic maximum $2.03, Google maximum $1.81).
- OpenAI remains the only measured provider (98.67/100 accepted baseline) and
  stays the default and only selectable enhancement provider.

A disabled provider performs no network request, credential read, background
work, or data mutation.

## Shared automated evidence

The synchronized Mac Mini mirror ran `pnpm check` after the registry change
and returned exit 0: 56/56 shared tests, TypeScript, ESLint, Raycast, CLI, and
MCP production builds, and the MCP runtime, bundle, mutation, feedback, and
optimization probes. Strict OpenSpec validation passed on the MacBook.

Each activation below additionally ran its own MacBook Pro runtime proof
before its state changed, in numbered order, one at a time.

## Activation 11 — Local CLI

- State: Disabled → Preview → **Active** with a recorded verification.
- Real-library MacBook checks against the five-prompt live library:
  `status` (ok), `list` (4 active records), `search "webgpu"` (1 hit, correct
  record), `get` (metadata above the copy-ready body per task 7.23),
  `copy` (clipboard matched the body), `validate` (5 valid, 0 invalid).
- No mutation was run against the real library; mutation behavior is covered
  by the isolated CLI probes.

## Activation 12 — Read-only MCP

- State: Disabled → Preview → **Active** with a recorded verification.
- `verify:mcp-bundle` and `verify:mcp-runtime` passed on the MacBook: only the
  four read tools exposed, the Disabled path read no data and created no
  files, and disabled `list` was rejected.
- A live stdio session against the real library initialized the server and
  `prompt_studio_search "webgpu"` returned the real WebGPU record.

## Activation 13 — MCP Mutations

- State: Disabled → Preview → **Active** with a recorded verification.
- `verify:mcp-mutations` passed on the MacBook: create, update, archive, and
  enhance exposed; delete never exposed; short-lived single-use confirmation
  tokens required for the exact request digest; privacy-safe audit log.

## Activation 14 — Outcome Feedback

- State: Disabled → Preview → **Active** with a recorded verification.
- `verify:feedback-cli` passed on the MacBook while feedback was still
  Disabled locally: the Disabled path touched no data, mutations required
  confirmation, immutable prompt-version snapshots were preserved, exports
  redacted runtime paths, and deleting feedback preserved the prompt.
- Sequencing note: an early Preview flip before the probe made the Disabled
  assertion fail once; the state was reverted, the probe passed, and the
  Preview → Active flips were repeated in the correct order. The wiggle is
  recorded in the feature history.

## Activation 15 — Prompt Optimization

- State: Disabled → Preview → **Active** with a recorded verification.
- `verify:optimization-cli` passed on the MacBook while optimization was still
  Disabled locally: the Disabled path touched no data, proposals required
  exact-digest confirmation, candidate evaluation selected a winner, compiler
  accept and rollback both worked, and the accepted proposal was preserved.

## Final activation state

| Order | Capability          | State                  |
| ----- | ------------------- | ---------------------- |
| 1–7   | SQLite through Exa  | Active                 |
| 8     | GitHub MCP Research | Disabled (user choice) |
| 9     | Anthropic Provider  | Disabled (user choice) |
| 10    | Google Provider     | Disabled (user choice) |
| 11    | Local CLI           | Active                 |
| 12    | Read-only MCP       | Active                 |
| 13    | MCP Mutations       | Active                 |
| 14    | Outcome Feedback    | Active                 |
| 15    | Prompt Optimization | Active                 |

Markdown remains the recoverable source of truth; SQLite and QMD remain
disposable indexes; the real prompt library was only read, never written,
during these activations.
