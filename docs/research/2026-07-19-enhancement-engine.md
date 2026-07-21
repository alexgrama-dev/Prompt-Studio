# Prompt Studio enhancement engine research

Research date: 2026-07-19

## Decision

Prompt Studio will treat enhancement as compilation: turn rough thoughts into a
faithful, executable prompt while preserving the user's intent. “Comprehensive”
means the prompt contains the context and checks that change the result. It does
not mean adding a large template to every request.

The first measured default is `gpt-5.6-terra` with medium reasoning. A Deep
option uses `gpt-5.6-sol` with high reasoning and a second review pass. The
high-volume metadata profile uses `gpt-5.6-luna` with low reasoning. These are
candidates until Prompt Studio's own evaluation cases have been run; provider
marketing alone is not activation evidence.

Two explicit challengers use the same compiler and validation contract:
`claude-sonnet-5` with medium effort and `gemini-3.5-flash` with medium
thinking. They remain Disabled until their numbered activations are eligible,
and neither can become the default without the same saved-case comparison.

## What a useful enhanced prompt contains

The compiler preserves each explicit requirement and adds only the smallest
amount of structure needed for the task:

1. The user-visible outcome.
2. Relevant supplied or verified context.
3. Requirements and scope boundaries.
4. Success criteria and stopping conditions.
5. Validation that can prove the result.
6. The requested deliverable and output shape.
7. Authorization boundaries for external, destructive, costly, or
   scope-expanding actions.
8. Assumptions and genuinely missing information, kept separate from facts.

Simple requests remain short. Complex implementation, review, and research
requests may use labeled sections. The compiler must not invent repositories,
files, commands, versions, deadlines, permissions, metrics, or product
requirements.

## Why this structure

OpenAI's current GPT-5.6 guidance recommends outcome-first prompts containing
important constraints, evidence, completion criteria, and an output contract.
It also recommends removing repeated process instructions and defining
authorization boundaries once. The guide reports directional improvements from
leaner prompts in OpenAI's internal coding-agent evaluations, but explicitly
says each application must validate the effect on its own representative work.

The same guidance says to preserve supplied values, use decision rules instead
of unnecessary absolute commands, expose only relevant tools, state how to
handle missing evidence, and include a validation loop. Those principles map
directly to Prompt Studio's fidelity, unsupported-fact, actionability,
authorization, and validation rubric.

## Model profiles

| Profile       | Exact model     | Reasoning | Calls                  | Intended use                                                                       |
| ------------- | --------------- | --------- | ---------------------- | ---------------------------------------------------------------------------------- |
| Standard      | `gpt-5.6-terra` | medium    | one compiler pass      | Everyday enhancement with a quality/cost balance                                   |
| Deep          | `gpt-5.6-sol`   | high      | compiler plus reviewer | Difficult, high-value prompts where measured quality justifies added cost and time |
| Bulk metadata | `gpt-5.6-luna`  | low       | one metadata pass      | Optional retagging of many existing prompts                                        |

Current standard API prices per one million tokens are:

| Model           | Input | Cached input | Cache write | Output |
| --------------- | ----: | -----------: | ----------: | -----: |
| `gpt-5.6-sol`   | $5.00 |        $0.50 |       $6.25 | $30.00 |
| `gpt-5.6-terra` | $2.50 |        $0.25 |      $3.125 | $15.00 |
| `gpt-5.6-luna`  | $1.00 |        $0.10 |       $1.25 |  $6.00 |

The cross-provider challengers are:

| Profile          | Exact model        | Reasoning | Calls | Intended use                             |
| ---------------- | ------------------ | --------- | ----- | ---------------------------------------- |
| Anthropic Sonnet | `claude-sonnet-5`  | medium    | one   | Quality challenger for coding-agent work |
| Google Flash     | `gemini-3.5-flash` | medium    | one   | Cost and latency challenger              |

Anthropic describes Sonnet 5 as its current balance of intelligence and speed
for coding and agentic work. Its introductory price through August 31, 2026 is
$2 per million input tokens and $10 per million output tokens; the announced
standard price from September 1 is $3/$15. Prompt Studio selects the price from
the run date so a later run does not silently use the expired introductory
rate.

Google describes Gemini 3.5 Flash as a stable model for coding, multi-step, and
long-horizon work. Paid-tier standard pricing is $1.50 per million input tokens
and $9 per million output tokens, including thinking tokens. The free tier may
have no token charge but has a materially different data-use policy, so the UI
does not present the paid estimate as a universal bill.

Prompt Studio records actual input, output, and reasoning-token usage after each
evaluation. It estimates cost from the returned usage, not from prompt length
alone. Deep is not the default unless blind comparison on the saved cases shows
a material quality improvement.

## API contract

The OpenAI implementation uses the Responses API through native HTTPS:

- `POST https://api.openai.com/v1/responses`
- `store: false`
- the exact selected model identifier and reasoning effort
- `text.format.type: "json_schema"` with `strict: true`
- a bounded output-token limit and request timeout
- no model tools during Activation 3
- no automatic fallback to another provider

Structured Outputs enforce the JSON shape, but the application still validates
field meaning, limits, duplicates, allowed targets, project-file provenance, and
source provenance. Refusals and incomplete responses are handled separately and
never become partial saved prompts.

Anthropic uses native HTTPS rather than an orchestration framework:

- `POST https://api.anthropic.com/v1/messages`
- `x-api-key` authentication and `anthropic-version: 2023-06-01`
- exact `claude-sonnet-5` model identifier
- `output_config.effort: "medium"`
- `output_config.format.type: "json_schema"`
- no tools, search, or prompt caching
- explicit handling for refusal, output limit, authorization, rate limit,
  service outage, timeout, and cancellation

Google also uses native HTTPS:

- `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`
- `x-goog-api-key` authentication
- `systemInstruction` plus one user `contents` record
- `generationConfig.thinkingConfig.thinkingLevel: "medium"`
- JSON `generationConfig.responseFormat`
- no tools, grounding, search, files, or stateful interaction
- explicit handling for prompt blocking, safety or other non-`STOP`
  completion, output limit, authorization, rate limit, service outage,
  timeout, and cancellation

Anthropic and Google support only subsets of JSON Schema. The provider-bound
schema removes unsupported `minLength` and `maxLength` keywords, but the full
local validator still enforces every string, list, metadata, project-file, and
source-provenance limit before the result can be previewed or saved.

The profile identifier is checked before any network call. A profile intended
for one provider is rejected by the other adapter, and a failed request never
causes automatic transmission to another provider.

## Privacy boundary

The preview shows what will be sent before the user invokes enhancement. With
Activation 3, that is the rough thoughts, target, selected profile, and optional
one-run instruction. Local project files and external research are not sent
because those capabilities remain disabled.

OpenAI states that API data is not used to train its models unless the customer
opts in. `store: false` prevents Responses application-state storage, but it
does not by itself remove the default abuse-monitoring logs, which may be kept
for up to 30 days. Zero Data Retention is a separate organization or project
control that requires eligibility and approval. Prompt Studio therefore never
describes `store: false` as “zero retention.”

The API key is held in Raycast's encrypted, extension-scoped storage through a
password preference. It is never written to Prompt Studio's feature
configuration, prompt files, logs, evaluation artifacts, or model input.

Anthropic and Google use masked one-run key forms. The selected key exists only
for the current attempt, is placed only in the provider's authentication
header, and is cleared after completion, cancellation, or failure. Disabled
providers stop before these forms are opened, so they do not request or inspect
a credential.

Anthropic documents structured-output prompts and responses as
zero-data-retention data while caching the JSON schema for up to 24 hours.
Prompt Studio does not put user or project content into the schema and still
discloses that separate trust-and-safety rules can apply.

Google documents different rules for its free and paid Gemini API services:
free-tier content may be used to improve products, while paid-service prompts
and responses are not used for product improvement. Paid services can still
have limited abuse-monitoring logs, and zero data retention requires separate
project approval and conditions. Prompt Studio cannot infer the billing tier
from an API key, so it displays both cases and does not claim zero retention.

## Evaluation method

The frozen baseline contains development, validation, and protected regression
cases. Every case lists facts that must survive enhancement and facts the model
must not invent. Automated checks validate the schema and explicit constraints;
human review scores fidelity, completeness, unsupported facts, actionability,
validation, authorization boundaries, and appropriate length.

Model comparisons use the same case inputs and a blind, randomized human review.
The protected cases cover destructive actions, missing authority, prompt
injection in reference material, secret handling, and unsupported project
claims. A higher aggregate score cannot compensate for a protected-case
failure.

## External technical context

Activation 3 deliberately has no external retrieval tool. Later capabilities
add sources in this order:

1. Selected local project, read-only and path-limited.
2. Context7 for version-specific library and API documentation.
3. Official GitHub MCP with a read-only allowlist for upstream source, releases,
   issues, pull requests, and Actions status.
4. Official or primary current web sources.
5. Exa for broader semantic web, paper, and code discovery.

Retrieved content is untrusted reference data. It may support a fact but cannot
change the user's permissions or the compiler's safety rules. Every included
source must be visible before saving.

## Primary sources

- [Prompting guidance for GPT-5.6 Sol](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md)
- [Using GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model.md)
- [Responses API create method](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data)
- [Safety best practices](https://developers.openai.com/api/docs/guides/safety-best-practices)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Raycast security and data storage](https://developers.raycast.com/information/security)
- [Official GitHub MCP server](https://github.com/github/github-mcp-server)
- [GitHub MCP server configuration](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md)
- [MCP 2025-11-25 lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- [What's new in Claude Sonnet 5](https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5)
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)
- [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Anthropic effort controls](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Anthropic API data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Gemini 3.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
- [Gemini Generate Content API](https://ai.google.dev/api/generate-content)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Gemini thinking controls](https://ai.google.dev/gemini-api/docs/generate-content/thinking)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API zero data retention](https://ai.google.dev/gemini-api/docs/zdr)
