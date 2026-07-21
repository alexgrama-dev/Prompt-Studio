# Prompt Studio

Prompt Studio is a visual, searchable prompt library for Raycast, Codex, Claude
Code, and other coding tools.

The active product stores prompts as readable Markdown files and provides a
Raycast library with exact SQLite search, meaning-based QMD discovery, preview,
creation, version history, and one-action copying. OpenAI enhancement,
read-only local and Mac Mini project context, and version-specific Context7
documentation research are Active. Raycast exposes only two daily commands:
**Prompt Studio** for the complete library and **Enhance Prompt** for new
generation. Status and no-AI saving remain available as actions inside Prompt
Studio; disabled feedback and optimization tools no longer clutter global
Raycast search. The default enhancement experience asks only for the task,
target coding app, and optional project; Customize holds research and special
instructions, while provider choice stays in Advanced. The review screen shows exactly the copy-ready prompt and
makes Copy the primary action; editing and enhancement details stay available
only when needed. **Save Existing Prompt** is the no-AI action: paste a prompt,
name it, and save it locally without changing its text or sending it to a
model. Optional summary and search details stay hidden until requested.
Activation 6's review-first current-web flow is Active. Activation 7's broader
Exa research flow is also Active after a complete focused-query, live
eight-source search, separate enhancement, approved save, provenance, and copy
verification. Activation 8's official read-only GitHub MCP implementation
remains installed and tested, but it is Disabled and intentionally skipped by
user choice. It performs no GitHub work and does not block Activation 9.
Activation 9's Anthropic Sonnet 5 provider is in Preview with the same frozen
24-case evaluation and blind-review path used for OpenAI. Activation 10's Google
Gemini 3.5 Flash provider is implemented as a separate manual choice and remains
Disabled until its own evaluation and activation checks pass.
Activation 11's local command-line interface is implemented over the same
prompt store, search index, and enhancement adapters. Its safe `status` command
already runs on the MacBook; all prompt-reading and mutation commands remain
Disabled until Activations 3–10 pass in order.
Activation 12's local read-only MCP server is also implemented as a standalone
MacBook executable. It completes a real protocol handshake and exposes safe
status, list, search, and get tools, but prompt access remains Disabled until
the numbered activation chain reaches it.
Activation 13's create, update, archive, and enhance MCP tools are implemented
inside the same bundle but are not registered while MCP Mutations is Disabled.
When it eventually reaches Preview, every call needs a five-minute, one-use
token issued locally on the MacBook for the exact reviewed request. Delete is
never exposed to an agent.
Activation 14's optional prompt-use feedback is implemented for the library and
CLI. Each record preserves the exact prompt version it describes, can be
inspected, edited, exported, or deleted, and never guesses whether the
downstream coding task succeeded. It remains Disabled and hidden until the
numbered activation chain reaches it. Activation 15's outcome-backed
optimization is implemented as a visual and CLI workflow. It can generate
several compiler addenda from
explicitly selected feedback, but no candidate can replace the fixed safety
contract or become current without separate development, validation, protected
case, and exact-digest approval. It remains Disabled.

The MacBook Pro is the runtime and rendered source of truth. The Mac Mini mirror
is used only for a clean second build and test pass over SSH.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm dev
```

Run the complete local check set:

```bash
pnpm check
openspec validate build-prompt-studio --strict
```

The default prompt directory is:

```text
~/Library/Application Support/Prompt Studio/Prompts
```

It can be changed in the extension preferences.

## OpenAI enhancement preview

Open **Enhance Prompt** in Raycast and enter rough thoughts, a target, and an
optional project. **Smart Defaults** uses the evaluated Standard profile with
external research off. **Customize** contains only Research and Special
Instructions. **Advanced Provider** holds model-provider choice. Prompt Studio
detects technical libraries and exact versions from the task and selected
project instead of asking for them. An OpenAI key is optional at extension
startup and is requested only when enhancement is invoked. Raycast stores the
password preference in encrypted storage scoped to the Enhance Prompt command.

Standard uses GPT-5.6 Terra with medium reasoning. Deep uses GPT-5.6 Sol with
high reasoning and a second review pass. Both use strict structured output and
`store: false`. The generated result remains editable and is not written to the
library until **Save Approved Prompt** is chosen.

Every valid provider result ends with one locally generated **Execution
Guardrails** section. It requires repository instructions and current state to
be inspected, a brief plan for multi-step work, preservation of existing work,
explicit authorization for destructive or external actions, secret protection,
proportionate checks, and truthful reporting. Prompt Studio replaces its own
marked section instead of duplicating it when an edited result is validated
again.

The saved-repository root defaults to `~/Developer`. The enhancer can also open
a native folder picker for one exact Git repository outside those roots; it
does not scan or authorize the parent folder. Selecting either kind of
repository builds a bounded read-only context bundle and shows every included
path before any model request. Large relevant source files contribute small
line-numbered excerpts around the user's terms instead of being discarded
wholesale. The review action can exclude all source-code excerpts while
retaining repository instructions, documentation, manifests, and Git facts.

The Mac Mini source defaults to `mini:~/Developer`, using the existing
passwordless `ssh mini` connection. The Project dropdown groups repositories
into Recent, MacBook, and Mac Mini sections. Prompt Studio batches bounded
read-only file retrieval over SSH, applies the same path, size, binary,
generated-file, and secret checks as local projects, and still requires the
normal project-context review before anything can be sent to a model. If SSH is
offline, MacBook and project-free enhancement keep working. Clear **Mac Mini
Project Root** in Raycast preferences to disable remote discovery.

Context7 Research is Active. Automatic or Deep research can retrieve
version-specific library documentation when a task names a library or API. The
flow is:

```text
rough thoughts -> sanitized query review -> Context7 retrieval -> source-content review -> OpenAI
```

Context7 receives nothing until the query review is approved. OpenAI receives
none of the returned material until the source review is approved. Context7's
direct API requires a key. Prompt Studio can read it from Raycast's encrypted
command preference or `CONTEXT7_API_KEY`, and otherwise offers a masked one-run
form. The key is used only in the authorization header and is never written to
the prompt or returned-source records.

Current Web Research is Active. A task that actually depends on a changeable
external fact can use OpenAI's current web search. Project files are never
included in planning or search:

```text
rough thoughts -> focused research plan -> focused query review -> paid web search -> citation review -> separate enhancement
```

The first low-cost GPT-5.6 Terra request receives a privacy-filtered task without
project files. It extracts the research objective, questions, and a
source-oriented query instead of forwarding the whole task to search. The
short search review shows the questions, focused query, planning cost, and
maximum search cost. Full privacy and request limits remain available through a
secondary action. The returned view shows the provider-reported queries, every
cited source, every consulted URL OpenAI reports, exact bounded excerpts, and
actual estimated search cost. Returned links are not opened automatically.
Prompt Studio sends the reviewed project bundle only in the later, separate
enhancement request.

Deep research can add Exa when the task explicitly needs a wider paper,
comparison, code-example, or community search. Exa receives only a sanitized
reviewed query and a masked one-run key:

```text
Deep research need -> focused research plan -> focused Exa query review -> one-run key -> paid search -> extractive-highlight review -> enhancement
```

The planner strips deliverable language and keeps only the broad paper,
case-study, code-example, or comparison need. The Exa request uses that focused
query with Deep search, eight results, moderation, 24-hour content freshness,
and extractive highlights rather than generated page summaries. The review
records source title, URL, author, publication date, similarity score,
retrieval time, exact bounded highlights, omissions, warnings, and
provider-reported cost. Prompt Studio does not save the Exa key or send project
files to Exa.

If GitHub research is re-enabled in the future, an exact upstream GitHub
repository, issue, pull request, release, commit, file, code-search need, or
Actions status request can use GitHub's official remote MCP server:

```text
exact GitHub need -> deterministic read-tool plan -> one-run repository-limited token -> server/tool-list verification -> bounded source review -> OpenAI
```

The form shows the exact repository, tools, and arguments before connection.
Prompt Studio sends only those arguments and the temporary token to GitHub; it
does not send the rough prompt or local project bundle. It requests GitHub's
read-only and public-content lockdown modes, asks for only the planned tools,
then rejects the session if the server exposes any unexpected tool. At most
three tool calls and 30 KB of returned text can enter the separate enhancement
request, after another human review. The token is cleared after the attempt and
never persisted. The token-creation action opens GitHub's official form with a
one-day lifetime and only the read permissions required by the reviewed tool
plan.

## Additional model providers

The enhancement form includes two separately controlled challengers:

- **Anthropic · Claude Sonnet 5 · Medium** (Activation 9)
- **Google · Gemini 3.5 Flash · Medium** (Activation 10)

Each choice uses its provider's native HTTPS API, the same compiler contract,
the same local result validation, and a masked one-run key. The key is sent only
in that provider's authentication header and is cleared after the attempt.
Prompt Studio never retries a failed request through another provider.

Anthropic uses one stateless Messages request with `output_config.format` JSON
schema output and medium effort. Google uses one stateless `generateContent`
request with medium thinking and JSON `responseFormat`. Neither provider gets
tools or search in the enhancement request. Their transmitted schemas omit
provider-unsupported string-length keywords; Prompt Studio still enforces the
full length and metadata limits locally before preview or save.

The form explains the provider-specific privacy boundary and cost basis before
the key can be entered. Anthropic's Sonnet 5 estimate automatically changes
from its introductory $2/$10 per million input/output-token price to the
announced $3/$15 standard price on September 1, 2026. Google's estimate uses
Gemini 3.5 Flash paid-tier standard pricing of $1.50/$9; the form also warns
that Google describes free-tier and paid-tier data use differently.

Both providers remain **Disabled**. Selecting either one stops before project
reading, research, key entry, or network access until its numbered activation
is eligible and verified. No live provider comparison or default change has
been made because that requires user-supplied keys and explicit paid-evaluation
approval.

## Prompt-use feedback

Activation 14 adds an optional evidence trail for prompts that were actually
used:

```text
saved prompt -> exact version snapshot -> optional rating and critique
                                      -> optional final prompt and outcome
```

Open **Prompt Studio** in Raycast and choose **Record Prompt Feedback** once the
feature reaches Preview. **Review Prompt Feedback** opens its visual catalog
for filtering, reviewing, editing, exporting, and deleting those records. While
the feature is Disabled, no feedback files are read and both actions remain
hidden.

Feedback is stored as private JSON files beside the portable prompt library:

```text
~/Library/Application Support/Prompt Studio/Prompts/.feedback/
```

Each record contains a cryptographic digest (a content fingerprint) plus an
immutable copy of the prompt body and discovery metadata that were current when
the feedback was created. Later prompt edits or deletion do not rewrite that
evidence. Editing feedback increments its own revision while preserving the
prompt snapshot. Deleting feedback removes only that record.

Project paths are not stored. Project name, branch, and commit may be retained
when they belong to the prompt snapshot; the use event may separately record an
optional commit. Free-text fields reject likely credentials and private keys.
Outcome fields are optional, and Prompt Studio never converts a rating or note
into a claimed task outcome.

The matching CLI workflow, once Activation 14 reaches Preview, is:

```bash
prompt-studio feedback list --json
prompt-studio feedback list <prompt-id> --json
prompt-studio feedback get <feedback-id> --json
prompt-studio feedback add <prompt-id> --input feedback.json --yes
prompt-studio feedback update <feedback-id> --input patch.json --yes
prompt-studio feedback export <prompt-id> --format markdown
prompt-studio feedback delete <feedback-id> --yes
```

Add, update, and delete require `--yes`. The feature check happens before any
feedback directory is read, created, or changed.

## Outcome-backed optimization

Activation 15 turns explicitly selected feedback into a testable proposal, not
an automatic rewrite:

```text
approved feedback -> 2-4 candidate addenda -> development-case winner
                  -> separate validation -> protected-case block
                  -> exact-digest approval -> reversible compiler state
```

Open **Prompt Optimization** in Raycast once the feature reaches Preview. The
visual flow can:

- select the exact feedback and frozen evaluation cases;
- show every field that would be sent to OpenAI;
- show the request digest, privacy boundary, and conservative cost cap;
- generate two to four alternatives with GPT-5.6 Sol in one `store:false`
  request;
- import completed human-review scores for the baseline and every candidate;
- show the instruction diff, evidence, quality change, cost change, and
  rollback version;
- accept only the evaluated winner's exact compiler digest;
- roll back without deleting later proposals, policies, scores, or feedback.

Candidate generation excludes prompt bodies, final edited prompts, private
notes, project paths, credentials, and existing evaluation outputs. It sends
only the selected rating, critique, correction, optional observed outcome,
prompt title and version digest, plus the frozen evaluation-case requirements.
A missing outcome stays missing.

The existing compiler contract remains fixed. A candidate is an additive policy
layer, so it cannot remove fidelity, unsupported-fact, source, authorization, or
structured-output safeguards. Development cases choose a candidate; validation
cases check that choice on separate examples; any protected-case hard failure or
score regression blocks approval. Conflicting feedback must be named by the
winning candidate rather than silently averaged away.

The CLI exposes the same local workflow:

```bash
prompt-studio optimization status --json
prompt-studio optimization list --json
prompt-studio optimization get <proposal-id> --json
prompt-studio optimization generate --input plan.json --yes --max-cost 1.00
prompt-studio optimization create --input candidates.json --yes
prompt-studio optimization evaluate <proposal-id> --input scores.json --yes
prompt-studio optimization approve <proposal-id> <candidate-id> \
  --digest <exact-policy-digest> --yes
prompt-studio optimization rollback <prior-policy-digest> --yes
prompt-studio optimization export <proposal-id> --format markdown
```

`generate` reads `OPENAI_API_KEY` only after the reviewed plan, `--yes`, and
positive `--max-cost` are present. API keys are never accepted as arguments.
Proposal files and compiler rollback history live in the MacBook's Prompt
Studio application-support directory. The Mini is not consulted at runtime.

## Local CLI

The local CLI gives Codex, Claude Code, terminals, and other coding tools one
scriptable route to the same Markdown prompts shown in Raycast:

```text
coding app -> prompt-studio CLI -> shared core -> Markdown library
                                      |
                                      +-> rebuildable SQLite / QMD indexes
```

Build the CLI on the Mac Mini and copy the self-contained compiled directory to
the MacBook:

```bash
ssh mini 'cd ~/Developer/work/prompt-studio && pnpm build:cli'
rsync -az mini:Developer/work/prompt-studio/dist-cli/ \
  ~/Developer/prompt-studio/dist-cli/
```

The copied program does not use SSH or depend on the Mini at runtime. To make it
available in every MacBook terminal:

```bash
mkdir -p ~/.local/bin
ln -sfn \
  ~/Developer/prompt-studio/dist-cli/cli/prompt-studio.mjs \
  ~/.local/bin/prompt-studio
```

Add `~/.local/bin` to `PATH` if it is not already there, then verify the local
installation:

```bash
prompt-studio status
prompt-studio status --json
```

Activation 11 is currently **Disabled**. `status` is intentionally available
and does not read prompt files, indexes, provider credentials, or the network
while Disabled. Every other command exits with code 3 and changes nothing until
the numbered activation chain reaches the CLI.

Once it reaches Preview, common calls are:

```bash
prompt-studio list --json
prompt-studio search "debug intermittent API" --json
prompt-studio search "what helps diagnose flaky caching?" --meaning
prompt-studio get <prompt-id> --body-only
prompt-studio copy <prompt-id>
prompt-studio validate --json
```

Codex and Claude Code can call those commands through their normal shell tools.
`get --body-only` returns copy-ready prompt text, while `--json` provides a
stable machine-readable envelope for other coding apps.

Writes are explicit:

```bash
prompt-studio create --input prompt.json --yes
prompt-studio update <prompt-id> --input patch.json --yes
prompt-studio archive <prompt-id> --yes
prompt-studio reindex --yes
```

`enhance` requires both `--yes` and the selected provider's environment
variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`). Add
`--save` only after you want the validated result written to Markdown. API keys
are rejected as command-line options, are never printed, and a provider failure
never falls back to another provider.

Stable exit codes are 0 for success, 2 for usage or missing confirmation, 3 for
a Disabled feature, 4 for a missing prompt, 5 for invalid prompt data, 6 for an
operating failure, and 130 for cancellation.

## Local read-only MCP

MCP (the standard tool protocol for coding agents) lets Codex and Claude Code
discover prompts without shell-command choreography:

```text
Codex / Claude Code -> local stdio process -> shared read-only core
                                                |
                                                +-> Markdown + SQLite
```

`stdio` means the coding app starts one local process and talks through its
input/output pipes. There is no listening port, hosted backend, remote Prompt
Studio account, or Mini connection.

Build the single-file server on the Mini and copy it to the MacBook:

```bash
ssh mini 'cd ~/Developer/work/prompt-studio && pnpm build:mcp'
rsync -az mini:Developer/work/prompt-studio/dist-mcp/ \
  ~/Developer/prompt-studio/dist-mcp/
```

Verify the copied bundle on the MacBook without installing any runtime package:

```bash
cd ~/Developer/prompt-studio
node --experimental-strip-types scripts/verify-mcp-bundle.mts
```

The current server offers:

- `prompt_studio_status`
- `prompt_studio_list`
- `prompt_studio_search`
- `prompt_studio_get`

These four advertise read-only, non-destructive, closed-world behavior. List
returns at most 50 summaries, search at most 25 matches, and get at most 20,000
prompt-body characters. Internal storage and project paths are omitted or
shortened, likely secrets are withheld, malformed inputs are rejected, and
search never rebuilds its index implicitly. Active reads write only a compact
privacy audit containing time, tool name, outcome, duration, count, and safe
error code—never a query, prompt body, prompt ID, or path.

### Confirmation-gated mutations

Activation 13 adds these separately controlled tools:

- `prompt_studio_create`
- `prompt_studio_update`
- `prompt_studio_archive`
- `prompt_studio_enhance`

They are absent from tool discovery while MCP Mutations is Disabled. After the
feature reaches Preview, the flow is:

```text
agent proposes exact request -> server returns request digest
                            -> Alex reviews request in the coding app
                            -> MacBook CLI issues one-use token
                            -> identical request consumes token -> mutation
```

Run the command printed by the first refused tool call:

```bash
prompt-studio authorize-mcp <create|update|archive|enhance> \
  <request-digest> --yes
```

The token expires after five minutes by default, is bound to the action and a
canonical hash of every mutation field, and is consumed on the first attempt.
Changing even one field invalidates it; two simultaneous calls cannot both use
it. The raw token is never stored—only a one-way hash appears in the private
MacBook confirmation directory. Prompt or token content is never placed in the
MCP audit.

This server-side check intentionally sits behind the coding app's own approval
dialog. The MCP specification calls tool annotations descriptive hints and
advises clients to display tool inputs and ask for confirmation; it does not
make those hints an enforcement boundary:
[MCP tools and user interaction](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).
Codex's `writes` approval mode prompts for non-read-only tools, while the
request-bound Prompt Studio token still prevents a changed or replayed call:
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

Enhancement reads the chosen provider key from the MacBook process environment
only after a valid token is consumed. It never accepts a key as a tool
argument, never silently switches providers, validates the model response
before returning it, and writes Markdown only when `save: true` was part of the
confirmed request.

The standalone bundle proof covers both states:

```bash
node --experimental-strip-types scripts/verify-mcp-bundle.mts
node --experimental-strip-types scripts/verify-mcp-mutations.mts
```

The first proves the real Disabled bundle exposes only four read tools and
touches no data. The second uses temporary Preview configuration, obtains a
token through the compiled CLI, performs one exact create, rejects replay, and
checks the privacy-safe audit. Both run directly on the MacBook without SSH.

### Codex on the MacBook

Codex Desktop, the Codex CLI, and the IDE extension share
`~/.codex/config.toml` on the same host. After Activation 12 enters Preview, add
this MacBook-local entry:

```toml
[mcp_servers.prompt_studio]
command = "/Users/alexgrama/Developer/prompt-studio/dist-mcp/prompt-studio.mjs"
cwd = "/Users/alexgrama/Developer/prompt-studio"
enabled = true
required = false
startup_timeout_sec = 10
tool_timeout_sec = 30
default_tools_approval_mode = "writes"
enabled_tools = [
  "prompt_studio_status",
  "prompt_studio_list",
  "prompt_studio_search",
  "prompt_studio_get",
]
```

The explicit allow list keeps future mutation tools hidden until Activation 13
is separately approved. After Activation 13 enters Preview, review the four new
tool definitions and explicitly add their names to this list; keep
`default_tools_approval_mode = "writes"` so Codex also shows its approval
prompt. OpenAI's current Codex documentation confirms the
shared configuration and the `command`, `cwd`, timeout, approval, and tool
allow-list fields:
[Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

### Claude Code on the MacBook

After Activation 12 enters Preview, register the same executable at user scope
so it is available across MacBook projects:

```bash
claude mcp add --transport stdio --scope user prompt-studio -- \
  /Users/alexgrama/Developer/prompt-studio/dist-mcp/prompt-studio.mjs
claude mcp get prompt-studio
```

Anthropic's current documentation defines this option order, the `--`
separator, and user scope:
[Claude Code MCP configuration](https://code.claude.com/docs/en/mcp).

Do not put either configuration on the Mac Mini. Once the compiled file is on
the MacBook, browsing prompts through MCP remains available when the Mini is
sleeping or unreachable.

Activations 12 and 13 are currently **Disabled**. If configured early, the
server can only report status; list, search, and get stop before reading prompt
files, indexes, credentials, or an audit log, and mutation tools are not
registered at all.

Inspect the frozen evaluation without making a model request:

```bash
pnpm eval:dry -- --profile openai-standard-v1
```

The implementation contract is
[`openspec/changes/build-prompt-studio`](openspec/changes/build-prompt-studio).
The complete MacBook-first implementation and activation handoff is recorded in
[`docs/verification/2026-07-19-complete-product-baseline.md`](docs/verification/2026-07-19-complete-product-baseline.md).
