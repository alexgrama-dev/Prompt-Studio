## Why

The 2026-07-23 dissection of the accepted evaluation run found three
systematic compiler defects: rendered-UI verification boilerplate leaking
into non-UI prompts (4 of 24 cases), softening of user-stated proof
thresholds (one clear case, one borderline), and hidden search metadata
naming technologies the user never mentioned.

## What Changes

- Revise the compiler instructions to `prompt-studio-compiler/1.2.0`:
  1. User-stated evidence, proof, authorization, and safety thresholds are
     exact lower bounds that must never be softened.
  2. Codex and Claude Code target adaptations mention rendered UI
     verification only for tasks that can change rendered UI behavior and
     omit it entirely otherwise.
  3. Tags, aliases, and hidden search phrases may name a specific
     technology only when the user or supplied context named it; otherwise
     the category is described generically.
- Pin all three rules with a content-level regression test.
- The frozen 24-case evaluation must be re-run against 1.2.0 before the
  first optimization cycle so the accepted baseline matches the shipped
  compiler (blocked on a one-run `OPENAI_API_KEY`; roughly $0.36).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prompt-enhancement`: compiler contract rules for threshold preservation,
  conditional UI verification, and grounded discovery metadata.

## Impact

- One constant module (`src/core/enhancement.ts`) and its tests. No storage,
  network, schema, or surface changes. Existing saved prompts are untouched;
  the accepted 98.67 baseline remains recorded as compiler 1.0.0 evidence.
