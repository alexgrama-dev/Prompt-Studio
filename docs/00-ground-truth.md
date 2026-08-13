# Ground truth: generation compiler

Read date: 2026-08-13.
Repo HEAD at branch start: `fa03008477ad4221eac69ee1b0a5860071b9a234`.
Compiler in tree: `prompt-studio-compiler/1.2.1`.
Guidance is taken from the current-model pages named below, not from
predecessor cookbooks. The GPT-5 prompting guide is a predecessor and
is cited only as a rejected source.

This document is Phase 0. It does not change generation logic.

---

## 1. Design council brief

Goal: compile terse developer intent into a target-tuned coding-agent
prompt that beats raw user input on a measured eval.

Scope now: inventory, vendor rules, conflicts, tier map. No UI change.

Evidence: live repo, `@raycast/api` 1.104.23 docs, Anthropic and OpenAI
current-model pages fetched 2026-08-13.

Constraints: Markdown prompts remain source of truth. Optional
capabilities start Disabled. Local Git context is read-only. Model
output is previewed before save. Mac Mini does not run `pnpm build` or
`pnpm dev`. Paid evals wait until the offline harness is trustworthy.

Live layer: conceptual model of CompiledPrompt, TargetProfile
(vendor × reasoning tier), Gap, and EvaluationCase. Surface (Enhance
Prompt) already exists and is not the bottleneck.

Members used: `layers-intro`. Direction, guardrails, Impeccable, and
Rams are deferred until a pipeline change needs a Raycast UI change.
Rams is not configured.

Rejected: one prompt shape for all targets; retuning compiler text
before eval-hardening; encoding GPT-5 cookbook frontend defaults.

---

## 2. Component inventory

### 2.1 Raycast commands (`package.json`)

| Command | Mode | Role |
| --- | --- | --- |
| `browse-prompts` | view | Library find, preview, paste, manage |
| `enhance-prompt` | view | Compile rough thoughts; optional `thoughts` argument |
| `idea-studio` | view | Capture Inbox |
| `quick-capture` | no-view | Selected text, else clipboard, into Capture Inbox |
| `menubar-prompts` | menu-bar | Frequent prompt copy |
| `paste-top-prompt` | no-view | Paste project-bound or most-used prompt |

Enhance Prompt also accepts `fallbackText` and `launchContext`
(`thoughts`, `target`, `seedId`, `revisionOfPromptId`). It does not
read selection or clipboard itself. Quick Capture does.

### 2.2 Generation path

| Module | Role |
| --- | --- |
| `src/core/enhancement.ts` | Compiler instructions, schema, OpenAI call, guardrails |
| `src/core/anthropic-enhancement.ts` | Anthropic Messages path |
| `src/core/google-enhancement.ts` | Gemini path |
| `src/core/enhancement-dispatch.ts` | Provider routing |
| `src/core/provider-profiles.ts` | Selectable profiles and availability |
| `src/core/provider-transport.ts` | HTTP with timeout and retry |
| `src/core/revision.ts` | Second-pass revision |
| `src/core/variant-selection.ts` | Multi-candidate judge |
| `src/core/project-context.ts` | Optional read-only Git context |
| `src/core/research-router.ts` | Context7 / Exa / web / GitHub research |
| `src/core/compiler-state.ts` | Active compiler policy on disk |
| `src/core/optimization.ts` | Offline optimization proposals |
| `src/enhance-prompt.tsx` | Form, preview, paste, history, activation eval |

`BASE_COMPILER_INSTRUCTIONS` is one shared blob. Target adaptation is
two short paragraphs (`codex`, `claude-code`) plus `generic`. There is
no vendor×tier rendering profile, no classifier, no elicitation form,
and no block library.

Pinned generator models:

| Profile | Model | Reasoning |
| --- | --- | --- |
| `openai-standard-v1` | `gpt-5.6-terra` | medium |
| `openai-deep-v1` | `gpt-5.6-sol` | high, two passes |
| `openai-bulk-metadata-v1` | `gpt-5.6-luna` | low |
| `anthropic-sonnet-5-v1` | `claude-sonnet-5` | medium |
| `google-gemini-3.5-flash-v1` | `gemini-3.5-flash` | medium |

Default preference: `openai-standard-v1`.

### 2.3 Saved artifact

A compiled result is a structured object (`ENHANCEMENT_RESULT_SCHEMA`)
with `enhancedPrompt`, summary, tags, assumptions, validation steps,
sources, and metadata. The prompt body is saved as Markdown. SQLite and
QMD are disposable indexes.

### 2.4 Eval today

| Item | State |
| --- | --- |
| Cases | 24, frozen 2026-07-19, splits development/validation/protected |
| Rubric | 0–100, seven criteria, hard failures |
| Judge | `gpt-5.6-terra` via Responses API, same family as generator |
| Runner | `evals/run-provider.mts`, spend gated |
| CI | No GitHub workflow runs evals |
| Baseline | compiler 1.0.0 accepted; 1.2.x rejected as noisy |

Categories in the 24: debugging, implementation, review, research, UI,
destructive, rename, missing-information, tests, docs, data,
accessibility, release, performance, API, multilingual, mobile,
authorization, security. Missing as first-class classes: migration,
greenfield, investigation-only CI, audit, infrastructure, adversarial
injection beyond one protected case, non-coding, already-specified,
contradictory, impossibly broad.

### 2.5 OpenSpec

Active and relevant: `eval-hardening` (unfinished), `compiler-1-2-0`
(code shipped, baseline rejected), `closed-loop`,
`generation-compiler` (this rebuild). Foundation archive:
`2026-07-21-build-prompt-studio`.

---

## 3. Raycast API surface (docs + `@raycast/api` 1.104.23)

Fetched 2026-08-13 from developers.raycast.com.

### 3.1 AI

- `AI.ask(prompt, options?)` returns `Promise<string> & EventEmitter`.
- Stream via the `data` event. `useAI` from `@raycast/utils` streams by
  default (`stream: true`).
- `environment.canAccess(AI)` gates access. Missing Pro: the call
  prompts for access, then throws if declined. Docs require a clear
  path, not a raw throw.
- `AI.Creativity`: `"none" | "low" | "medium" | "high" | "maximum" |
  number`. Numbers clamp to 0–2.
- `AI.Model`: large enum. Default documented as
  `AI.Model["OpenAI_GPT-4o_mini"]`. Unavailable models fall back.
  Listed models include GPT-5.x, Claude 4.x, Gemini 2.5/3.x. The enum
  on the 2026-08-13 page does not list `gpt-5.6-sol` / `gpt-5.6-terra`
  / `claude-sonnet-5` as used by this repo's provider profiles.
- Rate limit for extension AI: 10/minute, 100/hour.
- AI Extensions (`/ai/create-an-ai-extension`) are a separate Pro
  surface for Chat/Quick AI tools. This repo does not use them.

### 3.2 Other APIs in use or required by the spec

| API | Confirmed | Used today |
| --- | --- | --- |
| Preferences (`getPreferenceValues`, manifest schema) | yes | yes |
| Clipboard copy/paste/readText | yes | paste and capture |
| `getSelectedText` | yes; rejects if none | Quick Capture only |
| `getFrontmostApplication` | yes (environment/utilities) | not used by Enhance |
| LocalStorage (encrypted, extension-scoped) | yes | drafts, recents |
| Cache (disk LRU, default 10 MB) | yes | not used; project context has its own cache |
| Command arguments + fallbackText | yes | Enhance Prompt |

### 3.3 Implication for this product

Generation today uses provider HTTP APIs with pinned snapshots and
JSON schema. That matches OpenAI's shutdown of reusable prompt objects
(`v1/prompts` on 2026-11-30) and this repo's "prompts in code" rule.

Open decision (do not invent):

- **A — keep provider keys (current).** Pins snapshots, structured
  output, eval matches production. Users without keys cannot compile.
- **B — add Raycast `AI.ask` as a no-key path.** Needs Pro, cannot pin
  the eval models, no schema validation, rate-limited, model fallback
  can silently change the compiler.

Recommend A as the measured compiler. B is a later optional path and
must not be the eval generator.

---

## 4. Vendor sources (current pages)

| ID | Vendor | URL | Role |
| --- | --- | --- | --- |
| A-BP | Anthropic | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices | All current Claude models |
| A-O5 | Anthropic | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 | Claude Opus 5 |
| A-S5 | Anthropic | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5 | Claude Sonnet 5 |
| A-CC | Anthropic | https://code.claude.com/docs/en/best-practices | Claude Code product |
| A-CACHE | Anthropic | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | Cache prefix order |
| O-PE | OpenAI | https://developers.openai.com/api/docs/guides/prompt-engineering | Prompt engineering + reasoning vs GPT |
| O-56 | OpenAI | https://developers.openai.com/api/docs/guides/latest-model.md | GPT-5.6 family |
| O-SOL | OpenAI | https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md | GPT-5.6 Sol / family prompting |
| O-CACHE | OpenAI | https://developers.openai.com/api/docs/guides/prompt-caching | Cache prefix order |
| O-CDX | OpenAI | https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide | `gpt-5.3-codex` harness |

Rejected as current-model sources:

- GPT-5 prompting cookbook (predecessor; named a frontend stack that
  GPT-5.6 Sol guidance does not repeat).
- Anthropic marketing blog "best practices for 2026".
- Third-party summaries.

Google Gemini is a product challenger in this repo. This Phase 0 table
covers the two vendors named in the rebuild spec. Google remains a
fallback-profile target until its current prompting page is ingested
the same way.

---

## 5. Rule table

Last column: `G` = governs the prompt we emit to the target agent.
`C` = governs our compiler's own model call. `B` = both, applied at
different layers.

| RULE-ID | Vendor | Model scope | Reasoning tier | Directive | G/C |
| --- | --- | --- | --- | --- | --- |
| A-BP-01 | Anthropic | all current | all | Be clear and explicit. Do not rely on inference for "above and beyond". | B |
| A-BP-02 | Anthropic | all current | all | Few-shot examples steer format and tone. Wrap examples in XML. | C |
| A-BP-03 | Anthropic | all current | all | Structure mixed content with XML tags (`instructions`, `context`, documents). | B |
| A-BP-04 | Anthropic | all current | all | Longform data (≥20k tokens) at the top, above query, instructions, and examples. Queries at the end improved quality up to 30% in Anthropic tests. | G |
| A-BP-05 | Anthropic | all current | all | Wrap documents in XML with source metadata. Quote relevant spans before using them. | G |
| A-BP-06 | Anthropic | all current | all | Prefer adaptive thinking over manual chain-of-thought. | C |
| A-BP-07 | Anthropic | Sonnet 5 / 4.6 / 4.5 / Haiku 4.5 | reasoning | If the harness compacts, say so and tell the model not to stop early for token-budget reasons. | G |
| A-BP-08 | Anthropic | agentic coding | reasoning | Persistence language is for harnesses that actually compact. Do not emit it to a one-shot generic target. | G |
| A-O5-01 | Anthropic | Opus 5 | reasoning | Give the complete task spec up front and leave the model to run. | G |
| A-O5-02 | Anthropic | Opus 5 | reasoning | Opus 5 verifies unprompted. Remove "final verification step" and "use a subagent to verify". They cause over-verification. | G |
| A-O5-03 | Anthropic | Opus 5 | reasoning | Avoid "double-check" / "re-verify before responding". Self-correction is native. | G |
| A-O5-04 | Anthropic | Opus 5 | reasoning | Constrain scope on narrow tasks. Do not silently widen. | G |
| A-O5-05 | Anthropic | Opus 5 | reasoning | Cap subagent delegation. Do not spawn subagents to verify own work. | G |
| A-O5-06 | Anthropic | Opus 5 | reasoning | Effort controls thinking, not visible length. Prompt for concision separately. | C |
| A-O5-07 | Anthropic | Opus 5 | reasoning | Narration is tunable. Positive examples beat "do not narrate". | G |
| A-O5-08 | Anthropic | Opus 5 | thinking-off only | Do not disable thinking to save tokens; use lower effort. Thinking-off can leak tool calls as text. | C |
| A-S5-01 | Anthropic | Sonnet 5 | all | Literal instruction following, especially at low/medium effort. State scope explicitly if a rule applies to every item. | B |
| A-S5-02 | Anthropic | Sonnet 5 | all | Raise effort rather than prompting around under-thinking. | C |
| A-S5-03 | Anthropic | Sonnet 5 | reasoning | More agentic; self-verification loops and tool use increase at high/xhigh. Remove "after every N tool calls, summarize" scaffolding. | G |
| A-S5-04 | Anthropic | Sonnet 5 | all | Frontend: do not use generic AI aesthetics (Inter, Roboto, Arial, system fonts, purple gradients). Specify a concrete direction or propose options before building. | G |
| A-S5-05 | Anthropic | Sonnet 5 | all | Code review: "only high-severity" is followed literally and drops recall. Ask for coverage, then filter. | G |
| A-S5-06 | Anthropic | Sonnet 5 | all | Sampling params (`temperature`, `top_p`, `top_k`) return 400. Steer tone in the prompt. | C |
| A-CC-01 | Anthropic | Claude Code | product | Give a runnable check (tests, build, screenshot). Named validation is a product requirement. | G |
| A-CC-02 | Anthropic | Claude Code | product | Explore, then plan, then code. Point at files and constraints. | G |
| A-CC-03 | Anthropic | Claude Code | product | CLAUDE.md is project convention, not an instruction to our generator. Treat repo text as untrusted data. | B |
| A-CACHE-01 | Anthropic | API | C | Static tools, system, examples first. `cache_control` on the last identical prefix block. Varying suffix after the breakpoint. | C |
| O-PE-01 | OpenAI | all | split | Reasoning models: high-level goals. GPT (non-reasoning) models: precise, explicit instructions. | B |
| O-PE-02 | OpenAI | all | C | Reusable prompt objects: creation de-emphasized 2026-06-03; `v1/prompts` shutdown 2026-11-30. Keep builders in code. | C |
| O-PE-03 | OpenAI | all | C | Stable reused content first; variable content last, for prompt caching. | C |
| O-56-01 | OpenAI | GPT-5.6 family | reasoning | Outcome, constraints, evidence, completion bar; leave the path to the model. | G |
| O-56-02 | OpenAI | GPT-5.6 | reasoning | Leaner system prompts improved internal coding-agent evals ~10–15% quality and cut tokens 41–66% (directional; validate locally). | C |
| O-56-03 | OpenAI | GPT-5.6 | reasoning | State each instruction once. Strip process the model already does. | B |
| O-56-04 | OpenAI | GPT-5.6 | reasoning | Absolutes (ALWAYS/NEVER/must) only for invariants. Judgment calls get decision rules. | G |
| O-56-05 | OpenAI | GPT-5.6 | reasoning | Compact autonomy policy: diagnose/plan do not implement; change/fix may validate locally; confirm destructive/external/costly/scope expansion. | G |
| O-56-06 | OpenAI | GPT-5.6 | C | Use `text.verbosity` for default length. Broad "be concise" can over-trim. | C |
| O-56-07 | OpenAI | GPT-5.6 | reasoning | Frontend: preserve existing design system; do not add decorative UI; render and inspect. No named default library stack on this page. | G |
| O-56-08 | OpenAI | GPT-5.6 | reasoning | After changes, run named validation (tests, types, lint, build, smoke). If not runnable, say why. | G |
| O-56-09 | OpenAI | GPT-5.6 | reasoning | Suggested sections: Role, Personality, Goal, Success, Constraints, Tools, Output, Stop rules. Keep each short. | G |
| O-56-10 | OpenAI | GPT-5.6 | C | Pin `reasoning.effort`. Family: Sol flagship, Terra balance, Luna volume. Alias `gpt-5.6` routes to Sol. | C |
| O-56-11 | OpenAI | GPT-5.6 | C | Do not ask the model to "use pro mode" or "think harder". That is an API `reasoning.mode` flag. | C |
| O-CACHE-01 | OpenAI | GPT-5.6+ | C | Exact prefix match. Static instructions/tools first. Dynamic last. Writes bill 1.25×; reads discounted. | C |
| O-CDX-01 | OpenAI | gpt-5.3-codex | reasoning | Start from Codex-Max prompt; tactical additions only. | G |
| O-CDX-02 | OpenAI | gpt-5.3-codex | reasoning | Persistence and autonomy: finish implementation and verification in-turn unless paused. | G |
| O-CDX-03 | OpenAI | gpt-5.3-codex | reasoning | Do not prompt for upfront plans, preambles, or mid-rollout status; that can stop the rollout early. Harnesses that want preambles must persist Responses API `phase`. | G |
| O-CDX-04 | OpenAI | gpt-5.3-codex | reasoning | Frontend: avoid AI slop and default stacks (Inter, Roboto, Arial, system, purple-on-white). Preserve an existing design system. | G |
| O-CDX-05 | OpenAI | gpt-5.3-codex | C | Default interactive effort `medium`; `high`/`xhigh` for hard tasks. Dropping `phase` degrades `gpt-5.3-codex`. | C |

Rules deliberately not implemented yet are listed in section 9.

---

## 6. Conflict table

Branch on these. Do not average. Each profile records the chosen
side and the citation.

### C1. Context placement (quality)

| Side | Position | Citation |
| --- | --- | --- |
| Anthropic | Long documents and inputs at the top; query and instructions last. Up to +30% on complex multidocument tests. | A-BP-04 |
| OpenAI GPT-5.6 | Suggested prompt structure is instructions-first (Goal, Success, Constraints, then tools/output). Current Sol page does not repeat a documents-at-top quality claim. | O-56-09 |
| OpenAI predecessor (rejected) | GPT-5 / GPT-4.1 cookbooks discussed instruction-then-context ordering. Not used. | — |

Profile branch: Anthropic-family generated prompts place long evidence
before the task statement. OpenAI-family generated prompts follow
O-56-09 (outcome and constraints before per-request evidence of
ordinary size). For ≥20k-token pasted dumps on an Anthropic target,
A-BP-04 wins even if that hurts cache hits.

### C2. Instruction density

| Side | Position | Citation |
| --- | --- | --- |
| OpenAI | Reasoning tier: goals and trust. Non-reasoning: precise explicit steps. | O-PE-01, O-56-01 |
| Anthropic Opus 5 | Complete spec up front, then leave it to run (still outcome-heavy). | A-O5-01 |
| Anthropic Sonnet 5 | Literal; under-specify at low effort and it will not generalize. | A-S5-01 |

Profile branch: density is a function of reasoning tier first, then
vendor literalism. Sonnet 5 at low/medium effort is denser than Opus 5
at high effort.

### C3. Self-verification

| Side | Position | Citation |
| --- | --- | --- |
| Opus 5 | Verifies unprompted. Process-level verify instructions degrade. | A-O5-02, A-O5-03 |
| GPT-5.6 | Emit named validation commands after changes. | O-56-08 |
| Claude Code product | Give a runnable check. | A-CC-01 |
| Sonnet 5 | Already runs verification loops; do not add cadence scaffolding. | A-S5-03 |

Resolution, not a merge: emit **named, repo-discoverable checks**
(the test command, the typecheck) for Codex, GPT-5.6, and Claude Code.
Never emit **process scaffolding** ("include a final verification
step", "use a subagent to verify", "after every 3 tool calls") on
Opus 5 / Sonnet 5 / Claude Code-fronting-Opus-5. Named checks are
data. Process scaffolding is the harmful instruction.

### C4. Frontend defaults

| Side | Position | Citation |
| --- | --- | --- |
| Anthropic Sonnet 5 | Forbid generic AI aesthetics; specify a concrete direction or propose options. | A-S5-04 |
| Codex | Same anti-slop list; preserve existing systems. | O-CDX-04 |
| GPT-5.6 Sol | Preserve existing design system; do not add decorative UI. No named library stack on the current page. | O-56-07 |
| GPT-5 predecessor (rejected) | Named a recommended frontend stack. Do not encode. | — |

Current-page agreement: never emit a default component library stack.
Branch only on whether to emit the anti-slop block (Anthropic/Codex
yes on greenfield UI) versus preserve-existing-only (GPT-5.6
incremental UI).

### C5. Persistence / non-termination

| Side | Position | Citation |
| --- | --- | --- |
| Codex | Persist until the task is done; skip preamble prompting. | O-CDX-02, O-CDX-03 |
| Anthropic | Persistence language only when the harness actually compacts. | A-BP-07, A-BP-08 |
| GPT-5.6 | Stopping conditions and loop minimization, correctness first. | O-56-01 |

Do not emit Codex persistence to Generic or to a one-shot API call.

### C6. Caching vs Anthropic quality order

Both vendors: stable prefix first, dynamic suffix last (A-CACHE-01,
O-CACHE-01, O-PE-03). Anthropic quality order puts long per-request
documents first, which is dynamic and will miss the cache.

This trade is **unmeasured** in Prompt Studio. Phase 3 must measure
it on the compiler call (not on the emitted prompt). Until then,
profiles record the intended branch and mark the trade `unmeasured`.

---

## 7. Reasoning-tier map (versioned config, not a fact)

Reviewed 2026-08-13. Stale on the next model release.

| Target product | Current fronted model (best public evidence) | Vendor | Tier | Profile key |
| --- | --- | --- | --- | --- |
| Claude Code | Opus 5 and/or Sonnet 5 (user-selectable; product docs assume adaptive thinking) | Anthropic | reasoning | `anthropic × reasoning` |
| Codex | `gpt-5.3-codex` per current Codex prompting guide | OpenAI | reasoning | `openai-codex × reasoning` |
| Cursor | User-selected; often GPT-5.6 or Claude | unknown at generate time | resolve from preference | preference or `generic` |
| Windsurf | Cascade; model not pinned in our tree | unknown | resolve from preference | preference or `generic` |
| Raw OpenAI API reasoning | `gpt-5.6-sol` / terra with effort > none | OpenAI | reasoning | `openai × reasoning` |
| Raw OpenAI API non-reasoning | GPT-5.6 with `reasoning.effort: none`, or GPT-class | OpenAI | non-reasoning | `openai × non-reasoning` |
| Raw Anthropic API | `claude-sonnet-5`, `claude-opus-5` | Anthropic | reasoning (adaptive on by default) | `anthropic × reasoning` |
| Generic / self-hosted | unknown | none | conservative intersection | `generic-fallback` |

Repo `PromptTarget` today is only `generic | codex | claude-code`.
Cursor and Windsurf are not first-class targets. Adding them is a
product decision, not a silent enum change.

Our **compiler call** (C column) currently uses GPT-5.6 Terra/Sol
(reasoning) or Claude Sonnet 5 (reasoning). Treat our own generator
as a reasoning-tier caller: outcome-first compiler instructions,
named schema, no process over-specification (already close to
`BASE_COMPILER_INSTRUCTIONS`).

---

## 8. Conceptual model (compiler objects)

Real objects the rebuild must name:

| Object | Meaning |
| --- | --- |
| RoughInput | User text plus tagged evidence (stack trace, diff, path, URL) |
| TaskClass | Taxonomy label with calibrated confidence |
| Gap | Missing fact; bucket discoverable / inferable / blocking |
| TargetProfile | Declarative vendor × tier config with provenance |
| PromptBlock | Versioned, eval-scored fragment |
| CompiledPrompt | The emitted artifact plus surfaced assumptions |
| EvaluationCase | Frozen input, reference notes, must/must-not |
| GenerationRun | One compile with tokens, latency, profile id |

Gap buckets are the load-bearing distinction. Silently filling a
blocking gap is the highest-cost failure. Asking a discoverable gap
is the most annoying failure.

---

## 9. Deliberately not implemented (with reason)

Every rule in section 5 is either queued for a profile field or listed
here.

| RULE-ID | Status | Reason |
| --- | --- | --- |
| A-BP-04/05 | queued | Anthropic profile section order; unmeasured vs cache |
| A-O5-02/03, A-S5-03, O-56-08, A-CC-01 | queued | C3 branch in profiles |
| A-S5-04, O-CDX-04, O-56-07 | queued | C4 branch; never emit GPT-5 named stack |
| O-CDX-03 `phase` | not in generated prompt | Harness concern for our Codex CLI, not for a pasted prompt |
| O-56-11 pro mode | compiler-call only | API flag, never prompt text |
| A-O5-08 thinking-off | compiler-call only | We keep thinking/effort on for Sonnet 5 |
| A-S5-06 sampling 400 | compiler-call only | Anthropic transport must not send temperature |
| PTC / multi-agent / computer use | not implemented | Out of scope for pasted coding-agent prompts |
| Raycast AI.ask as generator | deferred | Open decision in 3.3 |
| Google prompting page | deferred | Ingest before shipping a Google-specific profile |

Existing `BASE_COMPILER_INSTRUCTIONS` already matches O-56-01, O-56-04,
O-56-05, and "do not invent facts". It does not branch C1–C4. That is
the rebuild gap.

---

## 10. Eval gap versus this spec

| Spec | Repo today |
| --- | --- |
| ≥60 golden cases | 24 |
| 12 dimensions, 0–4 | 7 criteria, 0–100 |
| Judge on another family | Same family (`gpt-5.6-terra`) |
| Span citations | Free-text notes |
| Human calibration / agreement | Not reported |
| N≥3 majority vote | Single run (eval-hardening unimplemented) |
| Downstream fixture-repo agents | Not built |
| CI gate on generation changes | No eval workflow |
| Anti-pattern automated checks | Partial via required/prohibited lists |

Honcho and `eval-hardening` agree: do not retune compiler text until
the measuring stick is trustworthy.

---

## 11. Assumptions

1. Claude Code in 2026-08 still fronts Sonnet 5 / Opus 5 class models.
   Map is config; it will go stale.
2. Codex prompting guide's `gpt-5.3-codex` is still the Codex product
   model. If Codex moves to GPT-5.6, the Codex profile is a data edit.
3. Enhance Prompt will keep provider-key generation for the measured
   compiler (decision A in 3.3) unless Alex chooses B.
4. Frozen 24 case identifiers stay immutable. New cases are additive.

---

## 12. Next

Phase 1: `docs/01-eval-harness.md` plus runnable corpus/rubric/judge
work on this branch. Finish `eval-hardening` items that unblock
stable scores. Do not edit `BASE_COMPILER_INSTRUCTIONS` yet.
