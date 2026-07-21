## 1. Establish the repository, shared core, and activation controls

- [x] 1.1 Create the project repository and place this OpenSpec change in its root
- [x] 1.2 Create one TypeScript workspace containing the shared core, Raycast extension, CLI, local MCP server, and evaluation packages
- [x] 1.3 Define the feature registry with Disabled, Preview, and Active states plus prerequisites, last verification result, and activation history
- [x] 1.4 Make Disabled the safe default for every optional model, research, indexing, CLI, MCP, feedback, and optimization capability
- [x] 1.5 Prevent disabled capabilities from running background work, making network requests, requesting credentials, or mutating data
- [x] 1.6 Implement prerequisite checks, reversible deactivation, and a status surface explaining why a capability is unavailable
- [x] 1.7 Store secrets in the operating-system credential store and keep only non-secret feature settings in the local configuration
- [x] 1.8 Add automated checks proving that activation changes only the selected capability

## 2. Establish the quality baseline

- [x] 2.1 Record at least twenty representative rough-prompt cases covering debugging, implementation, review, research, UI work, destructive requests, project-agnostic work, and project-aware work
- [x] 2.2 Define the human review rubric for fidelity, completeness, unsupported facts, actionability, validation quality, authorization boundaries, and unnecessary length
- [x] 2.3 Record required facts and prohibited inventions for every evaluation case
- [x] 2.4 Split cases into development, validation, and protected regression sets before tuning compiler instructions
- [x] 2.5 Record the latency, token use, estimated cost, and privacy disclosure required for every evaluated profile

## 3. Implement portable prompt storage

- [x] 3.1 Define the version-one JSON metadata shape and human-readable Markdown record format
- [x] 3.2 Implement strict prompt-file parsing that isolates invalid records without hiding valid records
- [x] 3.3 Implement atomic create and update writes so interruption cannot truncate an existing prompt
- [x] 3.4 Implement prompt version history, restore, duplicate, archive, and confirmation-gated human delete actions
- [x] 3.5 Add round-trip, invalid-record, concurrent-write, history, and recovery tests
- [x] 3.6 Activate the portable prompt store only after its recovery tests pass

## 4. Build and activate the visual Raycast library

- [x] 4.1 Initialize the Raycast extension with Browse Prompts, Enhance Prompt, Save Existing Prompt, and Feature Status commands
- [x] 4.2 Render prompt records in a visual List with title, summary, visible tags, target, project, and updated information
- [x] 4.3 Add exact title, body, tag, project, task-type, and target search using Raycast keywords and filters
- [x] 4.4 Add a detail preview with the prompt body, project binding, assumptions, sources, history, and activation-dependent actions
- [x] 4.5 Add Copy Prompt, Edit, Duplicate, Archive, Restore Version, and confirmation-gated Delete actions
- [x] 4.6 Add useful empty-library, invalid-record, unreadable-directory, loading, and recoverable-error states
- [x] 4.7 Verify browsing and exact discovery with one hundred fixture prompts and record launch and search latency
- [x] 4.8 Activate the Raycast library and built-in exact search as the initial usable product
- [x] 4.9 Keep the MacBook Pro as the standalone runtime and rendered verification surface, with the Mac Mini used only as an SSH build-and-test mirror
- [x] 4.10 Reduce global Raycast results to Prompt Studio and Enhance Prompt; keep manual save and status inside Prompt Studio and hide disabled feedback and optimization surfaces
  - 2026-07-20: Raycast on the MacBook Pro rendered exactly two development entry points for Prompt Studio. The library action menu retained Save Existing Prompt and Prompt Studio Status, and the embedded status view rendered all complete capability names. Disabled feedback and optimization commands were absent from global Raycast search.

## 5. Build and activate the SQLite search index

- [x] 5.1 Define the derived SQLite schema for records, tags, aliases, search terms, projects, usage, feedback, versions, and source references
- [x] 5.2 Build the index from Markdown without making SQLite the authoritative copy
- [x] 5.3 Implement incremental updates, deletion handling, schema migration, full rebuild, and corruption recovery
- [x] 5.4 Implement exact, full-text, filtered, recent, favorite, and usage-ranked queries
- [x] 5.5 Add index health, last-updated, record-count, and repair information to Feature Status
- [x] 5.6 Prove that deleting and rebuilding the database preserves all user-authored information
- [x] 5.7 Move SQLite search from Preview to Active as Activation 1

## 6. Build and activate QMD semantic discovery

- [x] 6.1 Configure a QMD collection over the prompt Markdown directory
- [x] 6.2 Implement indexing, health checks, refresh, repair guidance, and bounded semantic queries
- [x] 6.3 Normalize and deterministically combine exact SQLite results with semantic QMD results
- [x] 6.4 Show why a result matched, including exact field matches and semantic similarity
- [x] 6.5 Fall back to exact search with a visible explanation when QMD is unavailable
- [x] 6.6 Verify representative natural-language searches against the saved discovery cases
- [x] 6.7 Move QMD semantic discovery from Preview to Active as Activation 2

## 7. Implement and activate the OpenAI enhancement compiler

- [x] 7.1 Define the strict enhancement-result schema for enhanced prompt, title, summary, assumptions, missing information, validation, tags, aliases, search terms, project files, and sources
- [x] 7.2 Write versioned compiler instructions for Generic, Codex, and Claude Code targets
- [x] 7.3 Implement the OpenAI provider through native HTTPS with explicit versioned profiles, structured output validation, retries, cancellation, and `store: false`
- [x] 7.4 Configure `gpt-5.6-terra` with medium reasoning as the measured standard profile
- [x] 7.5 Configure `gpt-5.6-sol` with high reasoning and an additional review pass as the Deep profile
- [x] 7.6 Configure `gpt-5.6-luna` as the optional bulk metadata and retagging profile
- [x] 7.7 Build the form for rough thoughts, target, optional project, model profile, research level, and explicit one-run override
- [x] 7.8 Build an editable preview showing the prompt, assumptions, missing information, validation plan, tags, project files, and sources
- [x] 7.9 Save only the user-approved preview as a prompt record and index it after the authoritative write succeeds
- [x] 7.10 Run the baseline cases, fix schema or compiler failures, and record the accepted OpenAI results
  - 2026-07-20: the authorized Standard run completed 24/24 cases with zero provider, schema, or case failures for an estimated $0.358664 against a $2.30 maximum. Alex delegated qualitative scoring to Codex. The saved result passed at 98.67/100 with zero hard failures and zero protected-case failures; Raycast rendered all scores and notes at 24/24 reviewed. The review view hid provider/model fields, but the reviewer already knew the configured Standard profile, so this is not claimed as an identity-blind human preference.
- [x] 7.11 Move OpenAI enhancement from Preview to Active as Activation 3
  - 2026-07-20: a real project-agnostic Standard request completed in 9.4 seconds for an estimated $0.0147. The generated prompt was rendered, edited to preserve stricter user evidence/authorization thresholds, explicitly approved, saved as private portable Markdown, browsed, copied, and found through a meaning-only QMD query on the MacBook Pro. A QMD refresh race exposed by the save was fixed in the shared rebuild path, covered by a concurrent-call regression check, and reverified before activation.
- [x] 7.12 Reduce the default Enhance form to rough thoughts, target, and optional project while preserving every advanced control behind progressive disclosure
- [x] 7.13 Append one deterministic, versioned, target-aware execution-guardrail section after provider output and before preview, copy, or save
- [x] 7.14 Verify guardrail ordering, repeatability, target adaptation, bounded length, stricter-rule preservation, and the complete frozen case set without another provider request
- [x] 7.15 Render and exercise Smart Defaults and Customize on the MacBook Pro, then return Activation 3 to Active with the new evidence
  - 2026-07-20: the MacBook Pro rendered the four-control Smart Defaults path, the complete Customize path, and the full cost/privacy detail. The Mac Mini passed 51/51 tests plus typecheck, lint, every Raycast/CLI/MCP build and runtime probe, strict OpenSpec, and a redacted secret scan. A deterministic test applied the guardrail normalizer across all 24 frozen cases and all three targets without another paid or external request.
- [x] 7.16 Make Smart Defaults implicit, move customization and arbitrary-folder selection into Raycast actions, and keep the default form to three decisions
- [x] 7.17 Let a reviewed enhancement be saved or copied directly, with editing available only when needed
- [x] 7.18 Reduce prompt-library rows to titles and hide manual discovery metadata until requested
  - 2026-07-20: the MacBook Pro rendered the simplified Enhance, Customize, manual discovery, cleaner library, direct-save review, and compact-editor states without overlap, blank views, or unusable controls. A real project-free Standard enhancement completed in 12.7 seconds for an estimated $0.0179; the review actions rendered and nothing was saved or copied. A plain-language library search for `agent benchmark evidence disagreements` selected the intended prompt through full-text and meaning-based search. The synchronized Mac Mini mirror passed 52/52 tests, typecheck, lint, all Raycast, CLI, and MCP builds and runtime probes, Prettier, strict OpenSpec validation, and a redacted 2.96 MB secret scan.
- [x] 7.19 Make exact no-enhancement saving first-class: rename Create Prompt to Save Existing Prompt, keep the common form to prompt, title, and target, preserve the prompt body exactly, and hide optional discovery details
  - 2026-07-20: the MacBook Pro rendered the renamed command, three-decision default form, no-AI explanation, optional-details reveal, and populated-library Cmd+N action without overlap or unusable controls. The exact-content regression check preserved leading spaces, blank lines, trailing spaces, and the final newline through local Markdown save and reload while recording no enhancement provider. Both the MacBook Pro and synchronized Mac Mini mirror passed 55/55 tests, typecheck, lint, every Raycast/CLI/MCP build and runtime probe, Prettier, and strict OpenSpec validation; a redacted 2.98 MB scan found no secrets.
- [x] 7.20 Keep capability names readable in status rows, lead prompt previews with a wrapping plain-language purpose, move secondary library details below the full prompt, and advertise no-AI manual saving inside Browse Prompts
  - 2026-07-20: the MacBook Pro rendered complete capability names without competing subtitles or activation badges, a full-height prompt preview led by What This Prompt Does and followed by Full Prompt, and the visible Browse hint `⌘N saves without AI`. Pressing Cmd+N from the populated library opened Save Existing Prompt without modifying the real prompt collection. The synchronized Mac Mini mirror passed 55/55 tests, typecheck, lint, the Raycast production build, Prettier, and strict OpenSpec validation.
- [x] 7.21 Make the enhancement review match the copy-ready prompt exactly, make Copy Prompt the primary action, and move assumptions, project files, sources, and search metadata behind Review Enhancement Details
  - 2026-07-20: the main enhancement review and its primary native Copy Prompt action now use the same `enhancedPrompt` value; supporting assumptions, project files, sources, and search metadata appear only in the separate Review Enhancement Details view. The MacBook Pro development build hot-reloaded the current component, and the synchronized Mac Mini mirror passed 55/55 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime probes, Prettier, and strict OpenSpec validation. The earlier unsaved preview was no longer open, so no additional paid provider request was made merely to recreate it; rendered rechecking remains part of the complete-product state matrix in 17.2.
- [x] 7.22 Auto-detect technical library and version, reduce Customize to research and special instructions, move provider selection to Advanced, group projects by recent and machine, and shorten research reviews
  - 2026-07-21: the MacBook Pro rendered the three-control default form, two-control Customize view, Advanced Provider action, Recent/MacBook/Mac Mini project sections, automatic `@raycast/api` 1.104.22 detection from the selected prompt-studio project, and compact Context7 and live-web review surfaces. The synchronized Mac Mini mirror passed 56/56 tests, typecheck, lint, every Raycast/CLI/MCP build and runtime probe, Prettier, strict OpenSpec validation, and a redacted 3.08 MB secret scan.
- [ ] 7.23 Keep the saved-prompt preview copy-ready by removing library tags and other supporting metadata from beneath the prompt body

## 8. Implement and activate optional local-project context

- [x] 8.1 Discover Git repositories only under configured project roots and include a project-agnostic None option
- [x] 8.2 Collect applicable agent instructions, documentation, manifests, lockfiles, top-level structure, relevant search matches, validation commands, branch, and commit identifier
- [x] 8.3 Summarize relevant uncommitted changes without modifying Git state
- [x] 8.4 Exclude credential files, generated dependencies, binaries, and detected secret-like values
- [x] 8.5 Prioritize and size-limit the context bundle with deterministic tests
- [x] 8.6 Show included paths before transmission and allow code excerpts to be excluded
- [x] 8.7 Store project binding metadata and show a stale-context warning when the repository commit changes
- [x] 8.8 Prove that context collection leaves the selected repository byte-for-byte and state-for-state unchanged
- [x] 8.9 Move local-project context from Preview to Active as Activation 4
  - 2026-07-20: the MacBook Pro rendered a real Prompt Studio project review with `src/enhance-prompt.tsx` and `src/core/enhancement.ts` selected as bounded query-matched excerpts. The code-exclusion action reduced the reviewed bundle from about 39.7 KB to 7.9 KB. No model request was started, and Git status plus the aggregate repository-content hash were identical before and after collection. The Mac Mini passed 51/51 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime probes, strict OpenSpec, and a redacted secret scan.
- [x] 8.10 Let the user explicitly choose any local Git repository folder for one enhancement without broadening configured discovery roots
- [x] 8.11 Connect the MacBook app to the Mac Mini `~/Developer` root through the existing SSH alias, label remote repositories, and apply the same bounded read-only context review
  - 2026-07-20: the MacBook Pro rendered 40 repositories discovered through `ssh mini`, visibly labeled them `· Mac Mini`, selected Conversational Analytics, and produced the normal pre-model context review with its real `main` branch, commit, bounded files, detected validation command, and explicit “Nothing has been sent to OpenAI” notice. Batched read-only retrieval reduced the live discovery-plus-context check from about 29 seconds to 5.5 seconds. The Mac Mini passed 55/55 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime probes, Prettier, strict OpenSpec validation, and a redacted 3.01 MB secret scan.

## 9. Implement the research router and activate Context7

- [x] 9.1 Implement a source router that chooses no research, local project, Context7, GitHub, current web search, or Exa from the prompt's actual information need
- [x] 9.2 Encode source priority, freshness, version, authority, disagreement, and failure rules
- [x] 9.3 Resolve library identifiers and request version-specific Context7 documentation only when library or API facts are needed
- [x] 9.4 Record every retrieved source and which prompt claim or instruction it supports
- [x] 9.5 Treat retrieved text as untrusted reference data rather than instructions
- [x] 9.6 Add recoverable authentication, rate-limit, timeout, offline, and partial-result behavior
- [x] 9.7 Verify Context7 retrieval against version-specific library cases
- [x] 9.8 Move Context7 research from Preview to Active as Activation 5
  - 2026-07-20: the MacBook Pro reviewed an exact non-sensitive React 19.2.7 query, used an encrypted Context7 key, resolved `/react/react/v19.2.7`, reviewed five bounded source records, completed one Standard enhancement for an estimated $0.0305, saved the approved prompt with source provenance, copied it, and separately cancelled a live retrieval before any model request. Live service drift exposed and fixed both direct-API authentication handling and version-first selection when several exact-title indexes exist. The Mac Mini passed 51/51 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime probes, strict OpenSpec, and a redacted secret scan.

## 10. Implement and activate current web research

- [x] 10.1 Enable provider web search only when the prompt needs current external facts
- [x] 10.2 Prefer official and primary sources, bound the number of searches and returned source records, and record citations
- [x] 10.3 Show the user the query, privacy boundary, and estimated cost before transmission, then show the returned sources before enhancement
- [x] 10.4 Sanitize retrieved content and prevent it from changing authorization or tool-use boundaries
- [x] 10.5 Verify current-fact, no-research, conflicting-source, timeout, and cancellation cases
- [x] 10.6 Move current web research from Preview to Active as Activation 6
  - 2026-07-20: the MacBook Pro reviewed an exact project-agnostic WebGPU query and its $0.37 ceiling, completed one live search for an estimated $0.0907, reviewed two cited sources and 37 consulted URLs, cancelled a separate enhancement without saving, then completed one Standard enhancement for an estimated $0.0202. The approved prompt was saved exactly once with source provenance, 30 hidden search terms, and default execution guardrails, then found and copied in Browse Prompts. The Mac Mini passed 51/51 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime probes, strict OpenSpec, and a redacted 2.94 MB secret scan.
- [x] 10.7 Add a strict low-cost research-intent planner that extracts evidence questions and provider-specific queries before web or Exa search, rejects raw-task echo and wrong-route output, and shows the result before search
  - 2026-07-20: a live MacBook Pro Automatic-research run distilled the CSS/WebGL/shader task into one evidence objective, three research questions, and a focused official-source query for an actual planning cost of $0.0046. Raycast showed the plan before search; the review was then closed, so no web search, enhancement, or save occurred. The Mac Mini passed 56/56 tests, typecheck, lint, every Raycast/CLI/MCP build and runtime probe, Prettier, strict OpenSpec, and a redacted secret scan.

## 11. Implement and activate Exa research

- [x] 11.1 Implement direct Exa search and content retrieval for broader semantic web, code, paper, and page research
- [x] 11.2 Add query planning, result limits, content-size limits, deduplication, source ranking, and cost controls
- [x] 11.3 Record Exa sources and merge them deterministically with Context7, GitHub, and provider web results
- [x] 11.4 Add explicit privacy disclosure plus recoverable missing-key, quota, timeout, unsafe-content, and partial-result behavior
- [x] 11.5 Verify that Exa is used only when higher-priority sources cannot answer the information need
- [x] 11.6 Move Exa research from Preview to Active as Activation 7
  - 2026-07-20: the MacBook Pro completed the exact reviewed Deep query, a live eight-source Exa search for a provider-reported $0.012 with no warnings or omissions, a separate GPT-5.6 Terra enhancement for an estimated $0.0451, one approved save, eight-source provenance display, and copy. The saved prompt included seven visible tags, 44 hidden search terms, default execution guardrails, and no project files. The Mac Mini passed 51/51 tests, typecheck, lint, all Raycast/CLI/MCP builds and runtime checks, Prettier, strict OpenSpec, and a redacted 2.95 MB secret scan.

## 12. Implement and activate read-only GitHub MCP research

- [x] 12.1 Integrate the official GitHub MCP server with an explicit read-only tool allowlist
- [x] 12.2 Retrieve upstream source, releases, issues, pull requests, and repository documentation only when relevant
- [x] 12.3 Keep GitHub authentication separate from prompt data and never expose credentials to model context
- [x] 12.4 Treat repository content and issue text as untrusted data, and bound returned content
- [x] 12.5 Record GitHub sources, tool calls, repository, ref, and retrieval time
- [x] 12.6 Verify missing authentication, permission denial, rate limits, server unavailability, and malicious-content cases
- [x] 12.7 Record Activation 8 as intentionally skipped by user choice, return GitHub MCP research to Disabled, and exclude it from later activation prerequisites
  - 2026-07-20: Alex confirmed that GitHub-specific research is not needed. The tested implementation remains in the initial architecture for future opt-in, but its local state is Disabled, it performs no GitHub work, and Activation 9 no longer depends on it.

## 13. Implement and activate Anthropic and Google model providers

- [x] 13.1 Implement the Anthropic provider through native HTTPS with structured-result validation and explicit model profiles
- [x] 13.2 Implement the Google provider through native HTTPS with structured-result validation and explicit model profiles
- [x] 13.3 Add provider-specific credentials, availability checks, usage disclosure, cancellation, and error handling
- [x] 13.4 Prevent silent fallback or prompt transmission to a different provider after failure
- [ ] 13.5 Run the same saved evaluation cases for OpenAI, Anthropic, and Google and compare quality, latency, and cost
  - 2026-07-20: the provider-neutral runner and Raycast action now send every selected provider through the same 24 frozen cases, budget ceiling, private report, cancellation path, and blind human review. Anthropic's dry-run planning passed; its live run awaits a one-run key.
- [ ] 13.6 Select the default from measured results while retaining explicit manual choice
- [ ] 13.7 Move Anthropic from Preview to Active as Activation 9
- [ ] 13.8 Move Google from Preview to Active as Activation 10

## 14. Implement and activate the local CLI

- [x] 14.1 Implement `status`, `list`, `search`, `get`, `copy`, `create`, `update`, `archive`, `validate`, `reindex`, and `enhance` commands over the shared core
- [x] 14.2 Provide stable human-readable and JSON outputs plus meaningful exit codes
- [x] 14.3 Require explicit confirmation or flags for mutations and never expose stored secrets
- [x] 14.4 Verify that Raycast and CLI return equivalent records, search ordering, compiler validation, and errors
- [x] 14.5 Document shell installation and examples for Codex, Claude Code, and other coding apps
- [ ] 14.6 Move the local CLI from Preview to Active as Activation 11

## 15. Implement and activate the local MCP server

- [x] 15.1 Implement a local stdio MCP server over the shared core
- [x] 15.2 Expose bounded read-only `status`, `list`, `search`, and `get` tools first
- [x] 15.3 Apply result limits, path redaction, secret exclusion, request validation, audit logging, and cancellation
- [x] 15.4 Document verified local configuration for Codex and Claude Code
- [x] 15.5 Test protocol behavior, concurrent readers, malformed input, unavailable indexes, and disabled-feature responses
- [ ] 15.6 Move read-only MCP access from Preview to Active as Activation 12
- [x] 15.7 Add explicit create, update, archive, and enhance MCP tools behind a separate mutation capability
- [x] 15.8 Require confirmation tokens for mutations, omit delete, and test that failed calls do not partially write records
- [ ] 15.9 Move MCP mutations from Preview to Active as Activation 13

## 16. Implement and activate feedback, history, and outcome-backed optimization

- [x] 16.1 Record optional prompt-use events, target agent, project commit, user rating, correction, outcome, and privacy-safe notes
- [x] 16.2 Add Raycast and CLI flows to inspect, export, edit, and delete feedback records
- [x] 16.3 Link feedback and evaluation results to immutable prompt versions without overwriting prior evidence
- [ ] 16.4 Move feedback capture from Preview to Active as Activation 14
- [x] 16.5 Implement optimization jobs that create multiple candidates from approved feedback and evaluation evidence
- [x] 16.6 Score candidates on development cases, verify the winner on validation cases, and block regressions on protected cases
- [x] 16.7 Show the proposed instruction diff, evidence, quality change, cost change, and rollback version before approval
- [x] 16.8 Keep optimization proposals separate from the active compiler until a human approves them
- [x] 16.9 Verify rollback, insufficient-evidence, overfitting, conflicting-feedback, and failed-evaluation behavior
- [ ] 16.10 Move outcome-backed optimization from Preview to Active as Activation 15

## 17. Verify the complete product and preserve one-at-a-time rollout

- [x] 17.1 Run format, type, lint, unit, integration, and focused end-to-end checks on the intended development host
- [x] 17.2 Verify empty, loading, populated, search, filter, preview, create, edit, enhance, cancel, offline, error, and stale-project states in Raycast
  - 2026-07-20 MacBook recheck: the real empty-library state, complete activation-status list, Enhancement form, paid-evaluation action, blind 24-case review list, manual seven-score rubric, generated preview, edit-and-save form, populated library, copied prompt, exact search fallback, meaning-only QMD match, GitHub exact-plan review, masked GitHub connection, and pre-credential cancellation render correctly. Cancellation during live GitHub work, offline provider failure, filter variants, Save Existing Prompt's standalone save, and stale-project states remain open for their applicable activation checks.
  - 2026-07-21 completion: a disposable MacBook library verified empty, populated, search, no-results, Favorites, All, target/project/tag filter availability, exact no-AI create, and stale-project rendering. An invalid prompt directory rendered a recoverable error; an unreachable Mac Mini rendered the offline-local fallback; restored preferences returned to the five-file real library and online project discovery. The live preview/enhance/edit/cancel evidence plus the 56/56 cancellation and no-partial-save checks complete the state matrix. See `docs/verification/2026-07-21-raycast-surface-state-matrix.md`.
- [x] 17.3 Verify that failed or cancelled operations do not create, truncate, or partially index prompt files
- [x] 17.4 Verify that each disabled capability performs no background work, network access, credential request, or mutation
- [x] 17.5 Delete and rebuild SQLite and QMD indexes, then verify search and user-authored data remain correct
- [x] 17.6 Run a bounded secret scan before the first commit and before any release
- [x] 17.7 Record a verification report for each activation and forbid activating the next numbered capability until the current report passes
- [x] 17.8 Validate the OpenSpec change strictly and record setup, test, activation, rollback, and resume commands
