# Focused Research Planning and Raycast Simplification

Date: 2026-07-20

## Outcome

Prompt Studio no longer forwards the complete rough task as the web or Exa
search query. A bounded GPT-5.6 Terra planning request first extracts the
external evidence objective, specific questions, and one focused query per
selected provider. The focused query is shown before a provider search can
start.

Global Raycast search now exposes two daily entry points:

1. Prompt Studio
2. Enhance Prompt

Manual no-AI saving and Feature Status remain available inside Prompt Studio.
Feedback actions remain hidden while Activation 14 is Disabled. The
optimization implementation remains installed but hidden while Activation 15
is Disabled.

## Live MacBook Pro evidence

Raycast's development section rendered only **Prompt Studio** and **Enhance
Prompt** for this extension. The Prompt Studio action menu rendered **Save
Existing Prompt** and **Prompt Studio Status**. Opening the status action
rendered the complete Active, Preview, and Disabled capability names without
the previous competing global commands.

A live Automatic-research test used this non-sensitive rough task:

> Research the latest official browser support for advanced CSS, WebGL, and
> shader techniques as of July 2026, then propose an accessible
> high-performance single-page experience.

The planner returned a research objective, three evidence questions, and this
focused query:

```text
site:developer.mozilla.org OR site:web.dev OR site:developer.chrome.com OR site:webkit.org OR site:developer.apple.com OR site:learn.microsoft.com OR site:w3.org advanced CSS WebGL WebGL 2 WebGPU WGSL browser support compatibility accessibility performance July 2026
```

Raycast showed the result in **Review Current-Web Request** with an actual
planning cost of `$0.0046`, the `$0.37` search ceiling, both privacy
disclosures, and the explicit notice that no web search had started. The test
exited from this review. No web search, prompt enhancement, or prompt save was
performed.

## Mac Mini verification

The synchronized Mac Mini mirror passed:

- 56/56 shared-core tests
- TypeScript validation
- ESLint
- Raycast production build with exactly
  `src/browse-prompts.tsx` and `src/enhance-prompt.tsx` as entry points
- CLI and MCP production builds
- MCP runtime, bundle, mutation, feedback, and optimization probes
- Prettier
- strict OpenSpec validation
- redacted Gitleaks scan

The focused planner regression check proves that:

- local paths, email addresses, fenced content, and detected secrets are
  removed or rejected;
- the planning request has no search tool;
- strict structured output is required;
- every selected provider receives exactly one matching query;
- a non-trivial verbatim repeat of the rough task is rejected before search;
- web and Exa request builders reject plans without an attached focused
  intent.
