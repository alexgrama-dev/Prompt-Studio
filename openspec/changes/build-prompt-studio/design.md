## Context

Prompt installation is easy, but rediscovery is poor when prompts are exposed
only as slash commands. Prompt Studio needs a visual catalog and a trustworthy
enhancement flow that works both with and without a selected project.

The product targets one user on macOS first. Raycast is the primary visual
surface, while a local CLI and MCP server provide access from Codex, Claude
Code, and other compatible coding applications. Markdown remains the portable
source of truth.

All requested capabilities belong in the initial architecture and repository.
They do not all become active together. Each optional capability moves through
Disabled, Preview, and Active states only after its dependencies, tests, privacy
checks, and user-facing verification pass.

An optional capability that the user explicitly excludes remains Disabled,
performs no work, and is not a prerequisite for later activations. The status
surface records the omission so it is distinguishable from a failed
prerequisite.

The installed Raycast SDK already provides searchable lists, detail panes,
forms, dropdowns, password preferences, clipboard actions, and encrypted local
storage. OpenSpec 1.4.1 is installed locally and this change uses its
`spec-driven` workflow.

## Goals / Non-Goals

**Goals:**

- Make prompts visually browsable and discoverable without memorizing command
  names.
- Support exact, filtered, generated-term, and meaning-based search.
- Turn rough thoughts into a faithful, complete, lean prompt.
- Support project-agnostic and optionally project-personalized enhancement.
- Retrieve technical context from the selected repository, Context7, model web
  search, Exa, and official GitHub MCP according to source need and priority.
- Support measured OpenAI, Anthropic, and Google model profiles.
- Save prompts in a portable format that can be versioned with Git.
- Expose the same prompt library through Raycast, a local CLI, and a local MCP
  server.
- Record feedback and support candidate-based, evaluation-backed prompt
  optimization.
- Build every capability behind a local activation boundary and activate one at
  a time.
- Keep the product operable without a hosted Prompt Studio backend.

**Non-Goals:**

- Team accounts, remote permissions, billing, or shared cloud synchronization.
- A hosted Prompt Studio API in the initial product.
- Automatically executing a saved prompt in a coding agent.
- Writing to a selected Git repository during context collection.
- Connecting arbitrary unreviewed MCP servers.
- Silently falling back between model providers or research services.
- Importing every installed slash command without an explicit import review.

## Decisions

### 1. Use one repository with shared core behavior

The repository will contain:

- a shared TypeScript core for records, search, enhancement, context selection,
  research routing, validation, and activation checks
- a Raycast extension as the primary visual interface
- a local CLI using the same core
- a local MCP server using the same core
- evaluation cases and runner

There will be one prompt parser, one atomic-write path, one search contract, and
one enhancement-result validator. Raycast, CLI, and MCP are thin surfaces over
those functions.

**Alternatives considered:**

- Separate projects would allow independent releases but would create three
  subtly different prompt stores and validation paths.
- A hosted backend would centralize behavior but adds authentication, operation,
  cost, and privacy work before remote access is required.

### 2. Use Raycast as the primary visual surface

The extension will use a native `List`, item `keywords`, detail panes, list
filters, forms, dropdowns, secure password preferences, clipboard actions, and
local storage.

Global Raycast search exposes only **Prompt Studio** and **Enhance Prompt**.
Manual no-AI saving and Feature Status remain native actions inside Prompt
Studio. Feedback and optimization code remains installed but stays hidden while
its activation is Disabled. This preserves one obvious entry point without
removing later capabilities from the architecture.

The MacBook Pro is the canonical installation and daily runtime. It owns the
Raycast UI, prompt library, indexes, feature state, and credentials. The Mac
Mini is an SSH build-and-test mirror only: a missing, sleeping, or unreachable
Mini must not prevent the MacBook product from browsing, enhancing, saving, or
serving prompts. Rendered UI acceptance is performed on the MacBook.

**Alternatives considered:**

- A standalone web or desktop app adds hosting, window management, and packaging
  without improving the first user's core workflow.
- An Obsidian-only interface is visually useful but does not provide the same
  immediate keyboard overlay across coding applications.

### 3. Use Markdown as source and SQLite plus QMD as indexes

Each prompt is one `.md` file. The file starts with `---`, contains one JSON
object as metadata, closes with `---`, and then contains the prompt body. JSON
is valid YAML 1.2 and can be parsed with `JSON.parse` without a YAML dependency.

Required metadata includes:

- schema version and stable identifier
- title, summary, target, and timestamps
- visible tags, hidden search terms, and taxonomy
- assumptions and missing information
- source records
- optional project binding
- prompt-version lineage
- optional sensitivity policy

SQLite provides a rebuildable full-text and filter index. QMD provides
meaning-based search over the same Markdown directory. Neither index owns
prompt content. If either breaks, Markdown remains readable and the index can be
rebuilt.

Raycast local storage holds interface-only state such as recent usage, favorites,
remembered filters, feature activation, and last verification results.

### 4. Fuse exact and semantic discovery

Exact title, visible-tag, project, and full-text matches rank first. QMD results
are merged and deduplicated, giving semantic-only matches a lower initial
weight. The UI explains whether a result matched exact text, metadata, or
meaning.

Generated metadata contains five to eight visible tags and twenty to fifty
hidden search phrases organized by task, technology, artifact, problem, and
workflow.

### 5. Support three model providers behind measured profiles

The initial providers are:

- OpenAI: Terra for normal enhancement, Sol for Deep enhancement, and Luna for
  bulk metadata work
- Anthropic: Claude Sonnet 5 with medium effort as a quality challenger
- Google: Gemini 3.5 Flash with medium thinking as a cost challenger

Each profile explicitly records provider, model identifier, reasoning or effort
setting, target-agent compiler instructions, supported tools, and output schema.
Credentials are stored as Raycast password preferences or equivalent secure
local credentials.

The default profile is chosen from the saved evaluation, not provider marketing.
A failed provider never causes silent transmission to another provider.

The implementation uses small provider modules and native HTTPS. It does not add
an LLM orchestration framework.

Anthropic uses one stateless `POST /v1/messages` request with
`output_config.format` JSON schema output. Google uses one stateless
`generateContent` request with JSON `responseFormat`. Neither enhancement
adapter enables tools or search. Each provider uses a masked one-run key that is
kept out of model input, prompt records, settings, logs, and research sources.

The full local result validator remains provider-neutral. Provider-bound schemas
remove only unsupported string-length keywords, then local validation reapplies
all value, metadata, project-file, and source-provenance limits before preview
or save.

Sonnet 5 pricing changes from the documented introductory rate to the announced
standard rate on September 1, 2026, so its versioned profile selects the rate by
run date. Gemini pricing and privacy disclosure distinguish free from paid
service because an API key does not reveal its billing tier.

### 6. Distinguish enhancement from optimization

Enhancement is a single request that compiles rough thoughts and verified
context into a stronger prompt. It does not claim universal performance gains.

Optimization requires:

- representative examples
- explicit scoring criteria
- saved prompt and compiler versions
- multiple generated candidates
- separate development and validation cases
- protected cases that cannot regress silently
- human review before accepting a replacement

The product records useful or not useful feedback, optional critiques, final
user edits, target application, and optional outcomes. Outcome collection is
optional and never inferred.

Each feedback record is a private JSON document under the prompt library's
`.feedback` directory. It embeds an immutable snapshot of the exact prompt body,
discovery metadata, enhancement provenance, project name/branch/commit, and
source set being judged. The snapshot stores no repository path and is protected
by a SHA-256 content digest. Editing feedback increments the feedback revision
but cannot replace the prompt snapshot; deleting or changing the source prompt
does not erase prior evidence.

SQLite remains disposable and does not own feedback. Individual JSON records
keep backup, Git-ignore, export, repair, and deletion behavior inspectable
without introducing a second database migration path. The Raycast and CLI
surfaces check Activation 14 before reading the directory. Free-text feedback
is length-bounded and rejected when it resembles a credential or private key.

Optimization may consume only feedback that a human explicitly recorded. A
rating, critique, or missing outcome is not converted into a claimed task result.
The optimization layer introduced in Activation 15 creates separate proposals;
it cannot mutate the active compiler or prompt merely because feedback exists.

Candidate generation uses one explicit GPT-5.6 Sol request after the user
selects the feedback and frozen evaluation cases, reviews the exact evidence
payload, sees a conservative cost cap, and confirms transmission. The payload
omits prompt bodies, final edited prompts, private notes, project paths,
credentials, and existing evaluation outputs. Returned candidates are additive
compiler instructions: the fixed base contract for fidelity, facts, sources,
authorization, and strict output cannot be removed.

Every proposal includes two to four candidates and remains separate from
compiler state. Completed human review supplies the same seven rubric scores
for the baseline and every candidate on every selected case. Development cases
select the provisional winner. Validation cases must meet the absolute passing
bar and may not regress beyond the explicit limit. A protected-case hard
failure or score regression always blocks approval. Cost increase has a
separate explicit limit, and a winner must identify every member of a
conflicting-feedback group.

Approval is bound to the exact candidate policy digest and rejected if the
active compiler no longer matches the proposal's baseline. One private,
atomically written compiler-state document owns the accepted policy, all prior
policies, and activation/rollback events. Preview may record an acceptance, but
enhancement loads the accepted policy only when Activation 15 is Active.
Rollback selects a prior digest without deleting later policies, proposals,
scores, feedback, or prompt versions.

### 6a. Keep the visible enhancement path small

The normal Raycast flow presents only rough thoughts, target, and optional
project. Smart Defaults uses the evaluated Standard profile and no external
research. Customize reveals only research depth and one-run special
instructions. Provider choice remains available through an Advanced action.
Technical library and version are detected from the rough task and the selected
project's dependency manifests; no library fields compete with the primary
action.

Provider identity, maximum estimated model cost, review-before-save behavior,
and the no-research default remain visible in a compact summary. The complete
pricing and privacy disclosure remains available as a secondary action. Research
and project flows still show their own exact transmission reviews before they
can send data.

The provider does not own the final safety contract. After structured output is
locally validated, Prompt Studio appends one versioned, target-aware execution
guardrail section to the end of the prompt. The same normalizer runs after user
editing before save, making the operation repeatable without duplicating the
section. The block is deliberately compact and conditional: multi-step work
gets a brief plan, while a trivial one-step task does not gain ceremony.

This post-processor covers repository instructions and current state, preserving
unrelated work, destructive or external authorization, secrets, untrusted
retrieved text, proportionate validation, truthful reporting, material
questions, and any stricter rule already present in the request. This keeps
provider behavior measurable while ensuring every supported provider has the
same minimum execution boundary.

### 7. Inspect local and Mac Mini projects directly and read-only

Project discovery scans only user-configured roots. A native folder picker may
authorize one exact Git repository outside those roots for the current
enhancement; that choice does not scan or authorize its parent folders. The
collector uses standard filesystem APIs plus installed `git` and `rg` commands.
An optional `host:path` SSH root reuses the user's existing SSH alias to
discover and inspect Mac Mini repositories. Remote entries are visibly labeled,
stay restricted to that configured root, and batch bounded file reads to avoid
one connection per file. No SMB share, repository copy, or new credential is
created.

The project picker groups currently available repositories into Recent,
MacBook, and Mac Mini sections. Recent choices are stored as a bounded local
path list and are shown only while current discovery still finds the repository.
An offline Mac Mini removes only its unavailable entries and leaves the MacBook
and project-agnostic paths usable.

The context order is:

1. applicable `AGENTS.md`, `CLAUDE.md`, and equivalent instructions
2. README and architecture documentation
3. package manifests and lockfiles
4. exact file, symbol, error, and feature matches from rough thoughts
5. top-level structure and available validation commands
6. branch, commit identifier, and relevant uncommitted-change summaries

The bundle has a hard size limit and never includes the entire repository.
Known secret files, generated dependencies, binaries, and secret-like values are
excluded before any network call.

### 8. Make project context visible before transmission

When a project is selected, the user sees the included file paths before
enhancement. Project code can be removed while keeping repository metadata.

Saved prompts record repository identity, branch, commit identifier, and source
paths. The detail view compares the saved and current commit and warns when
context may be stale.

### 9. Route technical context through explicit source modules

Automatic research follows this order:

1. selected local repository
2. applicable local instructions
3. Context7 for version-specific library and API documentation
4. official GitHub MCP in read-only mode for upstream code, issues, pull
   requests, releases, and actions status
5. model web search for current external facts, preferring official sources
6. Exa for broader semantic web, code, paper, and page research

Context7 and Exa use direct HTTPS modules. GitHub uses the official MCP server
with read-only mode and an allowlist of tools. Every source can be enabled or
disabled independently.

Retrieved text is labeled as untrusted reference material. It cannot override
compiler policy, user intent, permission boundaries, or secret exclusions.

GitHub research uses the fixed official remote endpoint and MCP
`2025-11-25` lifecycle. Before connecting, the user sees the exact repository,
up to three deterministic read tools, and every argument. A fine-grained
personal access token is entered in a masked one-run form, sent only in the
authentication header, cleared after the attempt, and never persisted or added
to model context.

The client requests `X-MCP-Readonly: true`, `X-MCP-Lockdown: true`, and an
`X-MCP-Tools` list containing only the planned tools. It then checks the
server's `tools/list` response and stops before any tool call if an unexpected
or required-missing tool appears. This client-side check remains mandatory even
though the current server's read-only mode takes precedence over requested
write tools.

Supported planning covers bounded repository files and documentation, code
search, commits, releases, issues, pull requests, and Actions status or failed
job-log tails. Returned text is prefixed as untrusted reference data, filtered
for controls and detected secrets, limited to 12 KB per source and 30 KB total,
and shown with its repository, ref or object arguments, source URL, tool name,
and retrieval time before the separate enhancement request.

Current-web research is a separate OpenAI Responses request using the current
`web_search` tool. Before it can run, a small stateless GPT-5.6 Terra planning
request receives only the privacy-filtered rough task and the allowed research
routes, never the selected-project bundle. Strict structured output separates
the evidence objective and questions from one concise query per allowed
provider. The application rejects missing routes, unsafe queries, and a
verbatim repeat of a non-trivial rough task.

The web request then receives only the focused, user-reviewed public query. It
never receives the selected-project bundle. It uses `store: false`, requires a
search tool call, permits at most two search calls, and returns no more than
2,000 output tokens. The user sees the extracted questions, exact focused query,
planning cost, privacy boundary, and conservative search-cost ceiling before
authorizing the paid request.

The search response must contain at least one safe HTTPS citation. Prompt Studio
shows the provider-reported search queries, cited sources, complete consulted
URL list when supplied, bounded supporting excerpts, and actual estimated cost
before the user can start the separate enhancement request. Returned links are
never opened automatically. This staged boundary keeps private project context
out of a tool-enabled web request and limits the effect of instructions embedded
in public pages.

Exa research is a later, lower-priority supplement for Deep tasks that
explicitly need a wider paper, comparison, code-example, or community search.
It uses one direct HTTPS `/search` request with `type: deep`, eight results,
moderation enabled, 24-hour freshness, a bounded live-crawl timeout, and
extractive highlights. Full-page text and generated page summaries are excluded
from the default path.

The shared planner creates a separate focused Exa query and questions before
the Exa review. The exact query is shown before transmission. The Exa key is
entered in a masked one-run form, sent only in the authentication header,
cleared from the form after the attempt, and not persisted by Prompt Studio.
The disclosure states that standard Exa Query Data may be used to improve or
train its models and does not assume enterprise Zero Data Retention.

Returned records must have a safe public HTTPS URL and at least one bounded,
secret-free extractive highlight. Higher-priority sources remain first; URL
duplicates and whole records exceeding the shared 30 KB limit are omitted
deterministically. The user reviews source metadata, exact highlights,
omissions, partial-result warnings, and provider-reported cost before the
separate enhancement request.

### 10. Provide CLI and MCP access to the same library

The CLI is a Node 22 executable compiled from the shared TypeScript core. It
supports `status`, `list`, `search`, `get`, `copy`, `create`, `update`,
`archive`, `validate`, `reindex`, and explicitly invoked `enhance`. Raycast and
the CLI call the same prompt parser, Markdown writer, SQLite and QMD search
functions, provider adapters, output validator, and enhancement-to-draft
conversion.

The Mac Mini compiles and verifies the CLI. The complete compiled directory is
copied to the MacBook, where it runs without SSH, a Mini process, or a hosted
Prompt Studio service. The MacBook owns the prompt path, feature configuration,
indexes, clipboard, provider environment variables, and all runtime effects.

`status` is the one command allowed while the CLI capability is Disabled. In
that state it reads only local activation configuration and resolves display
paths; it does not open or create the prompt directory, inspect an index, read
a provider key, start background work, or make a network request. Every other
command checks Activation 11 before reading the library.

Human output is concise and JSON output uses one stable success or error
envelope. Exit codes distinguish success, usage or missing confirmation,
Disabled features, missing prompts, invalid prompt data, operating failures,
and cancellation. Create, update, archive, and reindex require `--yes`.
Enhancement requires `--yes` before any provider call and `--save` before the
validated result is written. Provider keys come only from the current process
environment, are never accepted as command arguments or rendered in output,
and a failed provider call never falls back.

The MCP server starts read-only and exposes
`prompt_studio_status`, `prompt_studio_list`, `prompt_studio_search`, and
`prompt_studio_get`. It uses the stable official TypeScript SDK over local
standard input and output. The Mini builds one bundled executable containing
the SDK and validation dependency; the MacBook runs that file without a local
package install, SSH, network listener, or Mini process.

Every tool publishes read-only, non-destructive, repeatable, closed-world
annotations. The initialization instructions tell clients that saved prompts
are user-authored content for intentional reuse, not higher-priority system
instructions. Codex and Claude Code configurations use the MacBook executable.
The Codex configuration also allow-lists only the four read tools, so later
mutation tools do not appear merely because their code exists.

Status may run while Activation 12 is Disabled. In that state it reads only
feature configuration and explicitly reports that no prompt files, indexes,
credentials, audit logs, or network services were accessed. List, search, and
get check the feature state before touching the library. The read path never
creates the prompt directory or rebuilds an index; missing or stale local data
returns a safe, actionable error.

List returns at most 50 safe summaries, search at most 25 results, and get at
most 20,000 prompt-body characters. Internal file and project paths are omitted
or home-shortened. Secret-shaped tool input is rejected; secret-shaped saved
metadata is omitted from list/search, and a prompt whose returned content
appears secret is not returned. Errors do not expose raw paths or internal
exception text.

Active calls append one privacy-safe local audit event containing only time,
tool name, outcome, duration, result count, and safe error code. The audit
never stores arguments, queries, prompt IDs, bodies, or paths and rotates at
1 MB. If the audit cannot be recorded, no prompt content is returned.
Cancellation is checked before and after asynchronous reads and before output.

Save, update, archive, and enhancement tools are separately activated in
Activation 13. Delete remains outside autonomous model calls and requires a
human action in Raycast or the CLI.

Activation 13 registers `prompt_studio_create`, `prompt_studio_update`,
`prompt_studio_archive`, and `prompt_studio_enhance` only when MCP Mutations is
Preview or Active at server startup. Deactivation immediately makes any
already-registered write tool reject before prompt, credential, or provider
access; activation requires a server restart before tools appear. Delete is not
registered in any state.

Every mutation uses a two-call confirmation flow. The first fully validates and
normalizes the proposed arguments, removes the confirmation field, computes a
canonical SHA-256 digest over the action and all normalized fields, writes only
a privacy-safe attempted-call audit event, and returns the digest plus a local
CLI command. It does not read or create the prompt library and enhancement does
not read a provider key or make a request.

The user runs `prompt-studio authorize-mcp <action> <digest> --yes` on the
MacBook. This creates a random 32-character token valid for five minutes by
default, with an allowed range of 30–900 seconds. The token record stores the
action, request digest, and timestamps under a filename made from a one-way
token hash; the raw token is not persisted. The MCP server cannot issue
confirmation tokens.

The repeated tool call must contain the identical normalized request and the
token. The server atomically claims and removes the token before comparing the
action, digest, and expiry, so a mismatch, expired token, replay, or concurrent
second call cannot mutate. After a successful match, a required `authorized`
audit event must be durable before the mutation begins. The audit contains no
arguments, prompt text, prompt identifier, local path, provider key, digest, or
token.

Create, update, and archive reject likely secret content and use the shared
atomic Markdown store; update and archive preserve the prior prompt version.
Enhance checks the separately selected provider feature, reads that provider's
key from the MacBook process environment only after token consumption, makes
one explicit provider call with no fallback, validates and secret-checks the
structured result, and saves only when `save: true` was part of the confirmed
digest. Cancellation, malformed input, missing audit access, missing provider
credentials, provider failure, and invalid model output do not create or
partially update a prompt.

Client approval dialogs remain a second safety layer, not the server's proof of
consent. MCP annotations are descriptive hints, and client support for nested
elicitation is not assumed across Codex and Claude Code. The portable CLI token
therefore remains the cross-client enforcement boundary.

### 11. Build local feature activation into the foundation

Every optional capability has:

- `Disabled`, `Preview`, or `Active` state
- configuration and dependency prerequisites
- privacy disclosure
- focused automated checks
- a user-facing verification checklist
- last verification result and last error
- reversible deactivation behavior

Only the portable prompt store, Raycast library, exact search, and clipboard
copy start Active. Other features are implemented and activated in the order in
`tasks.md`. During the initial rollout, only one new capability may move from
Preview to Active between complete verification runs.

When the user explicitly omits an optional capability, its implementation stays
available for future opt-in, its state stays Disabled, and later activation
prerequisites ignore it.

Activation is local configuration, not a remote feature-flag service. Disabled
features perform no work and make no network calls.

### 12. Save only after preview

Model output must pass required-field and type checks before rendering. The user
can inspect and edit the prompt, assumptions, missing information, search
metadata, project files, provider, model, and external sources. Saving is an
explicit action. Cancellation or failure writes nothing.

### 13. Test external behavior at stable boundaries

Tests cover:

- prompt parsing, validation, versioning, and atomic round-trip saving
- SQLite indexing, rebuild, and search ranking
- SQLite and QMD result fusion
- enhancement-result validation and provider failure behavior
- context priority, size limiting, and secret exclusion
- project staleness
- source-routing and untrusted-content handling
- CLI and MCP parity
- activation prerequisites, one-at-a-time rollout, and rollback

Model-output quality uses evaluation cases and scores rather than exact wording
snapshots. Raycast verification covers empty, loading, populated, preview, form,
error, index repair, provider status, source disclosure, activation, and
narrow-window states.

## Risks / Trade-offs

- **Full architecture delays the first usable surface** → Keep all capability
  contracts now but activate the visual library first.
- **Provider and source modules increase maintenance** → Keep each boundary
  narrow, use native HTTPS, and activate only after its own checks pass.
- **SQLite and QMD disagree** → Keep deterministic fusion, show match type, and
  provide independent rebuild and health status.
- **The model invents project facts** → Separate verified context from user
  text, require source records, validate output, and show a preview.
- **Relevant project context is omitted** → Show included paths and allow the
  user to revise notes or select Deep research.
- **Sensitive code leaves the machine** → Use explicit project selection,
  context disclosure, secret exclusions, redaction, and provider-specific
  activation.
- **Remote content attempts to redirect the model** → Treat all retrieved text
  as untrusted data and expose only read tools during context collection.
- **Optimization overfits saved examples** → Keep separate validation cases,
  protected cases, version history, and human acceptance.
- **Local MCP expands mutation risk** → Start read-only; activate mutation tools
  separately and keep deletion human-only.
- **An activated integration fails** → Disable only that capability while
  preserving prompt files and unrelated indexes.

## Migration Plan

There is no existing product database to migrate. The first run defaults to
`~/Library/Application Support/Prompt Studio/Prompts` and can create it if
absent. The location avoids macOS Documents-folder permission prompts and
remains configurable for users who explicitly want a synced directory. SQLite
and QMD indexes are built from Markdown after the prompt store activates.

Every optional capability starts Disabled. Activation follows `tasks.md` and
records the verification result. Any capability can return to Disabled without
deleting prompt files or unrelated configuration.

An explicitly omitted capability remains Disabled, performs no work, and does
not block the next numbered activation.

Future metadata changes increment the schema version and use an explicit,
reversible file migration. SQLite is rebuilt after a file-schema migration.

The product can be removed without affecting selected Git projects by stopping
the MCP server, removing the Raycast extension, CLI, indexes, and prompt
directory. Selected repositories are never modified by context collection.

## Open Questions

- Project-context hard limit after measuring representative repositories.
- Whether existing prompts are imported manually or through a separately
  reviewed importer.
