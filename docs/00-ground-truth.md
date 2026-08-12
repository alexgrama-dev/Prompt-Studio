# Prompt Compiler Ground Truth

Verified on 2026-08-12. This document separates current vendor guidance from
repository behavior and from assumptions in the overhaul brief. A source is
descriptive evidence, not authority to change Prompt Studio without evaluation.

## Current system

The enhancement path is:

`Raycast, CLI, or MCP -> feature state -> optional reviewed context or research -> shared provider dispatch -> schema validation -> .enhancements history -> preview -> explicit Markdown save`

Markdown prompt files remain the recoverable source. SQLite and QMD remain
rebuildable search indexes. The extension exposes six Raycast commands, a local
CLI, and an MCP server. Feature states enforce the numbered activation order;
Anthropic, Google, and GitHub research remain Disabled by default.

The six command identifiers and modes are `browse-prompts` (view),
`enhance-prompt` (view), `idea-studio` (view), `quick-capture` (no-view),
`menubar-prompts` (menu-bar), and `paste-top-prompt` (no-view). Manifest
preferences cover the library and QMD paths, local and SSH project roots,
provider and research credentials, the default enhancement profile, self-review,
variant count, and four research-supplier switches. `src/enhance-prompt.tsx`
declares the matching preference type used by the enhancement command.

| Component           | Current responsibility                                                                                                            | Evidence                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raycast manifest    | Six commands, extension preferences, provider keys, capture, browse, enhancement, and paste surfaces                              | `package.json:21-272`                                                                                                                                          |
| Raycast enhancement | Collect input, review optional sources, confirm cost, dispatch, record local run data, save Enhancement History, and open preview | `src/enhance-prompt.tsx:597-1520`                                                                                                                              |
| Shared compiler     | One monolithic policy, worked examples, target adaptations, request and result validation, and appended execution guardrails      | `src/core/enhancement.ts:19-1569`                                                                                                                              |
| Provider dispatch   | Route the same validated request to OpenAI, Anthropic, or Google without provider fallback                                        | `src/core/enhancement-dispatch.ts:27-67`                                                                                                                       |
| Provider boundaries | OpenAI Responses, Anthropic Messages, and Google generateContent; structured JSON, timeouts, bounded retries, and usage records   | `src/core/enhancement.ts:827-1128`, `src/core/anthropic-enhancement.ts:52-223`, `src/core/google-enhancement.ts:51-220`, `src/core/provider-transport.ts:3-99` |
| Project context     | Discover local or SSH Git repositories, bound reads, select relevant files, and collect real validation commands without writes   | `src/core/project-context.ts:228-1333`                                                                                                                         |
| Prompt store        | Parse and atomically write Markdown; keep `.enhancements` and `.seeds` outside the main search index                              | `src/core/prompt-store.ts:196-380`, `src/core/prompt-store.ts:840-1184`                                                                                        |
| Search              | Exact and full-text SQLite search over rebuildable records; QMD remains an optional discovery layer                               | `src/core/search-index.ts:11-1009`                                                                                                                             |
| Feature control     | Disabled, Preview, and Active states plus numbered activation and verification receipts                                           | `src/core/features.ts:6-185`                                                                                                                                   |
| Evaluation          | Frozen cases, provider runs, human or model reviews, repeated generations, and review summaries                                   | `src/core/evaluation.ts`, `src/core/evaluation-judge.ts`, `evals/`                                                                                             |
| Optimization        | Versioned candidates, frozen-case score imports, protected-case checks, approval, and rollback                                    | `src/core/optimization.ts`, `src/core/compiler-state.ts`                                                                                                       |
| CLI and MCP         | Use shared provider dispatch; require explicit generation and separate digest-bound save                                          | `src/core/cli.ts:1431-1562`, `src/core/mcp-write.ts:350-425`, `mcp/server.mts:59-150`                                                                          |

Current compiler version is `prompt-studio-compiler/1.2.1`. Compiler stages are
not separate modules. `src/core/compiler/` does not exist. OpenAI still owns a
private retry implementation, while Anthropic and Google share
`fetchProviderWithRetry`. This is a consolidation opportunity, not proof that a
nine-stage pipeline will improve output.

Prompt builders are code, not external templates. The main generator text is
`BASE_COMPILER_INSTRUCTIONS` plus `COMPILER_WORKED_EXAMPLES` and target additions
in `src/core/enhancement.ts`. Separate in-code builders serve evaluation judging,
optimization generation, saved-prompt revision, idea titles, and web research.
No vendor-hosted reusable prompt object participates in the enhancement path.

## Raycast API surface

The manifest and lockfile pin `@raycast/api` `1.104.23`; its installed declaration
surface is `node_modules/@raycast/api/types/index.d.ts`. `@raycast/utils` is not
installed. Current official docs and installed declarations establish these facts:

- `AI.ask(prompt, options)` returns an awaitable string emitter. Its `data` event
  streams chunks. It supports an abort signal.
- Check `environment.canAccess(AI)` before using Raycast AI. A call can otherwise
  prompt for Raycast Pro access and then reject.
- Numeric creativity is clamped to `0` through `2`.
- A requested Raycast model can be replaced by a similar available model. A
  Raycast model choice therefore cannot provide a pinned-model evaluation claim.
- `useAI` streams its returned `data` by default, but it is in `@raycast/utils`,
  which this project does not install.
- Extension preferences are declared in the manifest and read through
  `getPreferenceValues`.
- `Clipboard.read()` returns available text, HTML, or a file. `readText()` reads
  text only and returns an empty string when no text exists. `copy()` accepts
  text, numbers, or structured clipboard content; concealed copies are supported.
- `getSelectedText` rejects when no text is selected. `getFrontmostApplication`
  rejects when no application is found. Capture code must treat both as fallible.
- `LocalStorage` uses Raycast's local encrypted database and is shared only among
  commands in this extension. It is not intended for large records.
- `Cache` stores strings on disk, evicts least-recently-used entries, defaults to
  10 MB, and is shared among extension commands unless namespaced.
- Raycast AI tools are hidden extension entry points. Their optional confirmation
  runs before side effects. Prompt Studio currently declares no AI tool entry.

Sources: [AI API](https://developers.raycast.com/api-reference/ai.md),
[useAI](https://developers.raycast.com/utilities/react-hooks/useai.md),
[Preferences](https://developers.raycast.com/api-reference/preferences.md),
[Environment](https://developers.raycast.com/api-reference/environment.md),
[Utilities](https://developers.raycast.com/api-reference/utilities.md),
[Clipboard](https://developers.raycast.com/api-reference/clipboard.md),
[Storage](https://developers.raycast.com/api-reference/storage.md),
[Cache](https://developers.raycast.com/api-reference/cache.md), and
[Tool](https://developers.raycast.com/api-reference/tool.md).

## Vendor rule table

Application scope names the affected layer explicitly. `Generated prompt` means
the coding prompt delivered to the target. `Generator call` means Prompt Studio's
own model request or runtime. A rule affecting both appears once per layer.

| Rule ID | Vendor    | Model scope                                                     | Reasoning tier                       | Directive                                                                                                                                               | Application scope | Source                                                                                                                                                                                                      |
| ------- | --------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAI-01  | OpenAI    | GPT-5.6 family                                                  | All efforts                          | State outcome, context, hard constraints, evidence, success criteria, output shape, and stop rules. Leave path selection to the model.                  | Generated prompt  | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-02A | OpenAI    | GPT-5.6 family                                                  | All efforts                          | Remove repeated rules, obsolete process scaffolding, irrelevant examples, and irrelevant tools. Re-evaluate each removal.                               | Generated prompt  | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-02B | OpenAI    | GPT-5.6 family                                                  | All efforts                          | Remove repeated rules, obsolete process scaffolding, irrelevant examples, and irrelevant tools. Re-evaluate each removal.                               | Generator call    | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-03  | OpenAI    | GPT-5.6 family                                                  | All efforts                          | Define autonomy and approval boundaries once. Confirm external, destructive, costly, or materially expanded work.                                       | Generated prompt  | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-04  | OpenAI    | GPT-5.6 family                                                  | All efforts                          | Add relevant validation. Report unavailable checks instead of inventing results.                                                                        | Generated prompt  | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-05  | OpenAI    | GPT-5.6 family                                                  | `none` through `max`                 | Select effort from measured quality, latency, and cost. Do not assume the highest effort is best.                                                       | Generator call    | [GPT-5.6 model guide](https://developers.openai.com/api/docs/guides/latest-model)                                                                                                                           |
| OAI-06  | OpenAI    | GPT-5.6 family                                                  | All efforts                          | Keep reusable prefixes stable. Put changing request material after reusable content when caching matters.                                               | Generator call    | [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)                                                                                                                  |
| OAI-07  | OpenAI    | OpenAI API prompts                                              | All efforts                          | Keep prompt builders in application code with typed inputs, Git review, tests, and evaluations.                                                         | Generator call    | [Prompt-object migration](https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object)                                                                                               |
| OAI-08  | OpenAI    | GPT-5.6 coding                                                  | All efforts                          | Use precise role, tool routing, validation, and Markdown conventions when the harness needs them. Keep only useful examples.                            | Generated prompt  | [Prompt engineering: coding](https://developers.openai.com/api/docs/guides/prompt-engineering#coding), [Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide) |
| OAI-09  | OpenAI    | GPT-5.6 frontend                                                | All efforts                          | For new frontends, official guidance names Tailwind CSS, shadcn/ui or Radix Themes, named icon sets, and Motion. Preserve existing project conventions. | Generated prompt  | [Prompt engineering: coding](https://developers.openai.com/api/docs/guides/prompt-engineering#coding), [GPT-5.6 prompting](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)           |
| ANT-01  | Anthropic | All current Claude models                                       | All supported modes                  | Give clear instructions, desired output, constraints, and relevant motivation. Use ordered steps only when order or completeness matters.               | Generated prompt  | [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)                                                                 |
| ANT-02A | Anthropic | All current Claude models                                       | All supported modes                  | Use relevant, diverse examples when measured results justify them. Use XML tags to separate complex material.                                           | Generated prompt  | [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)                                                                 |
| ANT-02B | Anthropic | All current Claude models                                       | All supported modes                  | Use relevant, diverse examples when measured results justify them. Use XML tags to separate complex material.                                           | Generator call    | [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)                                                                 |
| ANT-03  | Anthropic | All current Claude models with inputs above about 20,000 tokens | All supported modes                  | Put long documents near the top and the query after them. Request supporting quotes when grounding matters.                                             | Generator call    | [Claude long-context guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/long-context-tips)                                                                                  |
| ANT-04  | Anthropic | Claude Fable 5, Opus 5, and Sonnet 5                            | `low` through `max`, model-dependent | Select effort from workload evaluations and model limits.                                                                                               | Generator call    | [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort)                                                                                                                               |
| ANT-05  | Anthropic | Claude Opus 5                                                   | All efforts                          | Remove generic re-verification. Keep task-specific acceptance checks.                                                                                   | Generated prompt  | [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)                                                                                 |
| ANT-06  | Anthropic | Claude Opus 5                                                   | All efforts                          | Constrain narrow scope, cap subagent use, and give complete specifications before long work.                                                            | Generated prompt  | [Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)                                                                                 |
| ANT-07  | Anthropic | Claude Fable 5                                                  | All efforts                          | For long runs, tie progress claims to tool evidence. Use periodic independent verification only when the run needs it.                                  | Generated prompt  | [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)                                                                               |
| ANT-08A | Anthropic | Claude Sonnet 5                                                 | `low` through `max`                  | State instruction scope because lower-effort behavior is literal.                                                                                       | Generated prompt  | [Prompting Claude Sonnet 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5)                                                                             |
| ANT-08B | Anthropic | Claude Sonnet 5                                                 | `low` through `max`                  | Raise effort before adding broad “think harder” text.                                                                                                   | Generator call    | [Prompting Claude Sonnet 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5)                                                                             |
| ANT-09  | Anthropic | Claude Sonnet 5 frontend                                        | All efforts                          | Give a concrete visual direction or ask the user to choose. No required library stack is named.                                                         | Generated prompt  | [Prompting Claude Sonnet 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5)                                                                             |
| ANT-10  | Anthropic | Claude API caching                                              | All supported modes                  | Put stable tools and system material before changing request data.                                                                                      | Generator call    | [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)                                                                                                                      |

Current model list: OpenAI's flagship alias routes to `gpt-5.6-sol`; lower-cost
members are `gpt-5.6-terra` and `gpt-5.6-luna`. Anthropic lists Claude Fable 5,
Opus 5, Sonnet 5, and Haiku 4.5 as current. This list is dated configuration,
not a permanent taxonomy. Sources: [OpenAI model guide](https://developers.openai.com/api/docs/guides/latest-model)
and [Claude models](https://platform.claude.com/docs/en/about-claude/models/overview).

## Conflict and non-conflict table

The brief predicted four vendor conflicts. Current primary sources support only
model-specific branches. They do not support four universal vendor oppositions.
Prompt Studio must encode only the supported branches.

| Topic                  | Current evidence                                                                                                                                                                                                                                                               | Required treatment                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long-context placement | Anthropic explicitly puts documents first and the query last for inputs above about 20,000 tokens. OpenAI says static reusable prefixes should precede dynamic request material for caching, but does not say every dynamic context must be last in the emitted coding prompt. | Anthropic long-input generator requests need a measured documents-first branch. OpenAI caching remains a request-construction rule. Do not manufacture an output-level vendor conflict.                                     |
| Instruction density    | GPT-5.6 favors outcome-first, lean prompts. Claude's general page favors clear detail, while Claude effort and per-model pages change behavior by model and effort.                                                                                                            | Key profiles by exact model family and effort behavior. Do not use one Anthropic-wide density value. Measure every profile against the generic fallback.                                                                    |
| Self-verification      | GPT-5.6 asks for relevant validation. Claude Opus 5 says to remove redundant generic verification, while task-specific checks remain useful. Fable 5 can benefit from evidence-grounded progress checks.                                                                       | Suppress redundant generic re-check text for Opus 5. Retain concrete acceptance checks. Treat this as a model branch, not OpenAI versus Anthropic.                                                                          |
| Frontend defaults      | OpenAI names a stack for new frontends and says existing projects should preserve their design system. Claude Sonnet 5 asks for a concrete visual direction or user choice; it names no required library stack.                                                                | Apply a stack only to verified new OpenAI-targeted frontend work. For existing repos, preserve local patterns. For Sonnet 5, choose visual direction without inventing a stack. No Opus 5 frontend conflict is established. |
| Caching                | Both APIs cache exact prefixes. Stable content before changing content improves reuse. Anthropic's long-document rule can reduce reuse when documents vary.                                                                                                                    | Measure cache cost and task quality. Do not choose from intuition.                                                                                                                                                          |

### Deliberately excluded claims

- No source establishes one fixed instruction density for all OpenAI models or
  all Anthropic models.
- No source establishes that every reasoning model should receive only high-level
  goals. Current GPT-5.6 and Claude guidance retain explicit hard constraints,
  evidence, tool rules, and success criteria.
- No source establishes that Anthropic requires a named frontend library stack.
- No current Opus 5 page establishes a fixed palette or frontend default.
- Raycast model selection cannot prove a pinned snapshot because Raycast can
  substitute a similar model.
- A second critique pass, nine always-on compiler stages, telemetry, or a cache
  does not ship merely because the brief names it. Each needs a failing case and
  measured improvement.

## Provisional profile key

The brief's `vendor x reasoning tier` label is too coarse for current evidence.
Model-specific guidance differs inside a vendor. The minimum truthful runtime key
is:

`vendor + model family + effort behavior + task context`

| Provisional family     | Effort behavior                                                                    | Output policy supported today                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| OpenAI GPT-5.6         | Configured `none` through `max`; project currently uses `low`, `medium`, or `high` | Lean outcome-first prompt; explicit constraints, evidence, permissions, success, validation, and stopping rules |
| Claude Fable 5         | Adaptive reasoning; `low` through `max` with model limits                          | Long-run evidence grounding and bounded autonomy; periodic verifier only when the task warrants it              |
| Claude Opus 5          | Adaptive reasoning; `low` through `max`                                            | Complete task specification; no redundant generic re-verification; explicit scope and delegation caps           |
| Claude Sonnet 5        | Adaptive reasoning; `low` through `max`                                            | Literal scope, effort-aware detail, explicit frontend direction when relevant                                   |
| Claude Haiku 4.5       | Extended thinking, not current adaptive-effort behavior                            | Generic conservative fallback until independently evaluated                                                     |
| Unknown or self-hosted | Unknown                                                                            | Generic conservative fallback; no vendor-specific claim                                                         |

Prompt Studio currently offers `codex`, `claude-code`, and `generic` output
targets. Their dated reasoning split is:

| Product target     | Reasoning side                                 | Exact family and effort                                                 |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Codex              | Reasoning agent                                | Resolve from the active Codex runtime; use fallback when unavailable    |
| Claude Code        | Reasoning agent                                | Resolve from the selected Claude runtime; use fallback when unavailable |
| Generic            | Unknown                                        | Always use the conservative fallback                                    |
| Cursor or Windsurf | Model-configurable, so not globally assignable | Not current Prompt Studio targets                                       |
| Raw API            | Request-specific                               | Require an explicit provider, model family, and effort                  |

Product-to-model mappings can change outside Prompt Studio. Runtime profiles
must therefore record `lastVerifiedAt`; a product name alone cannot justify a
model-specific branch.

The current published Codex prompting guide still names `gpt-5.3-codex`.
Prompt Studio read it for Codex harness behavior, but does not treat it as
GPT-5.6 model guidance. The current GPT-5.6 model and prompting pages control
GPT-5.6 behavior. No dedicated current Haiku 4.5 prompting page was identified;
Haiku therefore receives only cited general Claude guidance and the fallback.

## Phase 0 decisions

1. Keep `prompt-studio-compiler/1.0.0` as the accepted behavior baseline until
   hardened evaluation proves a replacement. The repository may contain later
   experimental compiler text without making it accepted.
2. Build evaluator trust before changing generated prompt behavior.
3. Make profiles model-specific inside each vendor. Keep reasoning or effort as
   a separate runtime dimension.
4. Record unsupported brief assumptions as excluded. Do not force expected
   conflicts into code.
5. Keep generator prompts in this repository with typed inputs, tests, and
   evaluation receipts.
6. Require an explicit positive cost ceiling before any live model evaluation or
   downstream coding-agent run.
7. Do not treat a Raycast build as runtime or visual proof.

## Open evidence

Phase 0 proves current facts only. It does not prove the compiler design. These
measurements remain required before implementation claims:

- 60 labeled cases and twelve anchored dimensions;
- randomized span-citing judging and held-out human agreement;
- real fixture-repository coding-agent outcomes;
- per-case and per-class CI regression behavior;
- cache placement versus quality and cost;
- independent profile versus generic-fallback results;
- MacBook Raycast runtime and visual captures.
