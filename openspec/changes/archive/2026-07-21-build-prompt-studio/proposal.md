## Why

Installed prompts are difficult to rediscover because slash-command interfaces
hide the catalog and require users to remember names. Alex needs a visual prompt
library that can turn rough thoughts into a high-quality prompt, optionally
grounded in a selected Git project, and then make that prompt easy to find and
reuse across coding applications.

## What Changes

- Add a Raycast prompt library with visual browsing, filtering, preview, copy,
  creation, editing, and deletion.
- Store prompts as portable Markdown files with machine-readable metadata.
- Maintain a rebuildable SQLite index for fast exact and filtered search.
- Add QMD semantic search so prompts can be found by meaning when the user's
  wording does not match generated tags.
- Add an Enhance form that accepts rough thoughts, a target coding agent, an
  optional Git project, and a research setting.
- Make the default Enhance surface show only rough thoughts, target, and
  optional project. Customize reveals only research and special instructions;
  provider choice moves to Advanced, while library and version are detected
  from the task and selected project.
- Generate a faithful, target-aware prompt plus visible tags, hidden search
  terms, assumptions, missing information, and source records.
- Append a compact, versioned execution-guardrail section after every provider
  result so planning, non-destructive work, authorization, secret protection,
  validation, and truthful reporting do not depend on model compliance.
- Build a small read-only context bundle from a selected local or SSH-connected
  Mac Mini Git repository without uploading the whole repository.
- Group projects into Recent, MacBook, and Mac Mini sections while keeping the
  MacBook workflow usable when SSH is offline.
- Retrieve version-specific technical documentation from Context7 and current
  external facts through model web search only when the task requires them.
- Distill rough task wording into focused research questions and
  provider-specific queries before any web or Exa search, then require review
  of the focused query.
- Add Exa for broader semantic web and code research and the official GitHub MCP
  for upstream repositories, issues, pull requests, and releases.
- Support OpenAI, Anthropic, and Google enhancement models behind one measured
  provider boundary, with an explicit user choice and a tested default.
- Show the user what project files and external sources influenced the result
  before saving.
- Add a repeatable enhancement-quality evaluation so model and prompt changes
  are measured rather than judged from one attractive example.
- Add outcome-backed prompt optimization using saved feedback, candidate
  prompts, evaluation cases, and scores.
- Expose the prompt library through a local read-only-by-default MCP server and
  CLI so coding agents can search, retrieve, and intentionally save prompts.
- Add local feature controls so every capability ships in the initial
  architecture but is activated and rolled back independently.

## Capabilities

### New Capabilities

- `prompt-library`: Portable prompt storage, visual discovery, preview, editing,
  and copy-based use across applications.
- `prompt-enhancement`: Conversion of rough thoughts into faithful, structured,
  target-aware prompts with searchable metadata.
- `project-context`: Optional, read-only personalization from a selected local
  Git repository with privacy controls and source tracking.
- `technical-context`: Targeted retrieval of current library documentation and
  external technical information with clear provenance and safe failure
  behavior.
- `search-indexing`: Exact, filtered, and meaning-based prompt discovery using a
  rebuildable SQLite index and QMD.
- `model-routing`: Measured selection and configuration of OpenAI, Anthropic,
  and Google models.
- `cross-agent-access`: Local CLI and MCP access to the same visual prompt
  library from Codex, Claude Code, and other compatible applications.
- `controlled-activation`: Local activation, dependency checks, verification,
  and rollback for each product capability.

### Modified Capabilities

None.

## Impact

- Adds a local Raycast extension written in TypeScript.
- Adds a user-selected Markdown prompt directory that can be versioned with Git.
- Adds outbound requests to OpenAI, Anthropic, Google, Context7, Exa, and GitHub
  when their corresponding capabilities are active.
- Reads selected local Git repositories without modifying them.
- Adds a local SQLite index derived from Markdown prompt records.
- Adds a local MCP server and CLI that share the prompt store.
- Requires credentials only for integrations the user activates.
- Does not require a hosted Prompt Studio backend; Markdown remains the
  recoverable source of truth.
