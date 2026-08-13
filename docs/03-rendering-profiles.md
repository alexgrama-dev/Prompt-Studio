# Rendering profiles

Date: 2026-08-13.
Depends on: `docs/00-ground-truth.md`.
Status: declarative schema and cited defaults. No profile has beaten
`generic-fallback` on a measured eval yet. Unmeasured profiles do not
ship as generation logic.

## Key

Profiles are keyed on **vendor × reasoning tier**, not vendor alone.
Resolved at generation time from the selected target product, then
from the versioned map in ground truth section 7.

| Profile id | Vendor | Tier | Intended products |
| --- | --- | --- | --- |
| `anthropic-reasoning-v1` | Anthropic | reasoning | Claude Code, Opus 5, Sonnet 5 |
| `openai-reasoning-v1` | OpenAI | reasoning | GPT-5.6 Sol/Terra with effort > none |
| `openai-codex-reasoning-v1` | OpenAI | reasoning | Codex (`gpt-5.3-codex` as of 2026-08-13) |
| `openai-nonreasoning-v1` | OpenAI | non-reasoning | GPT-5.6 effort none / GPT-class |
| `generic-fallback-v1` | none | conservative intersection | unknown, self-hosted, Cursor/Windsurf until mapped |

Model names are data in this file, never hardcoded in compose logic.

## Shared cache constraint (both vendors, compiler call)

Stable reused content first. Dynamic per-request content last.
Citations: A-CACHE-01, O-CACHE-01, O-PE-03.
Last verified: 2026-08-13.

This governs **our** generate call. It is not a compromise on C1
(quality order of the emitted prompt).

Context-placement versus caching for Anthropic long dumps: unmeasured.
Do not claim a winner.

## Conflict branches (never average)

| Conflict | anthropic-reasoning | openai-reasoning | openai-codex-reasoning | openai-nonreasoning | generic-fallback |
| --- | --- | --- | --- | --- | --- |
| C1 context placement | Long evidence above task (A-BP-04) | Outcome/constraints first (O-56-09) | Outcome first; Codex-Max order | Precise instructions first, then data | Instructions then evidence; no 30% claim |
| C2 density | Complete spec, then leave it (A-O5-01); Sonnet literal (A-S5-01) | Outcome + constraints, not step lists (O-56-01) | Codex-Max tactical additions (O-CDX-01) | Explicit steps (O-PE-01) | Outcome + constraints + one stop rule |
| C3 verification | Named checks only; no process scaffolding (A-O5-02, A-CC-01) | Named validation commands (O-56-08) | Persist through verification (O-CDX-02) | Explicit check lists | Named checks; no "double-check" |
| C4 frontend | Anti-slop / propose options (A-S5-04) | Preserve existing system (O-56-07) | Anti-slop; preserve existing (O-CDX-04) | Preserve existing | Never emit a named default stack |

GPT-5 cookbook named stack: rejected predecessor. Last verified
2026-08-13 on O-SOL.

## Field provenance (minimum)

Every field below must keep `source` (RULE-ID) and `verified`.
Unattributable guidance does not enter.

### anthropic-reasoning-v1

| Field | Value | Source | Verified |
| --- | --- | --- | --- |
| sectionOrder | documents/evidence, then task, then constraints | A-BP-04 | 2026-08-13 |
| structure | XML delimiters for mixed content | A-BP-03 | 2026-08-13 |
| density | complete spec, not step-by-step workflow | A-O5-01 | 2026-08-13 |
| selfVerificationProcess | suppress | A-O5-02, A-S5-03 | 2026-08-13 |
| namedChecks | emit inspect-then-name, or Claude Code runnable check | A-CC-01 | 2026-08-13 |
| persistence | only if harness compacts | A-BP-07 | 2026-08-13 |
| preamble | tunable; no "after every N tools" | A-O5-07, A-S5-03 | 2026-08-13 |
| subagents | cap; never to verify own work | A-O5-05 | 2026-08-13 |
| frontend | forbid generic AI aesthetics; no named stack | A-S5-04 | 2026-08-13 |
| absoluteLanguage | invariants only | O-56-04 intersection | 2026-08-13 |

### openai-reasoning-v1

| Field | Value | Source | Verified |
| --- | --- | --- | --- |
| sectionOrder | Goal, Success, Constraints, Tools, Output, Stop, then per-request evidence | O-56-09 | 2026-08-13 |
| structure | Markdown headings; short sections | O-56-09 | 2026-08-13 |
| density | outcome-first | O-56-01 | 2026-08-13 |
| selfVerificationProcess | named validation after changes | O-56-08 | 2026-08-13 |
| persistence | stop rules; do not over-ask | O-56-05 | 2026-08-13 |
| frontend | preserve existing design system | O-56-07 | 2026-08-13 |
| lean | state each instruction once | O-56-03 | 2026-08-13 |

### openai-codex-reasoning-v1

| Field | Value | Source | Verified |
| --- | --- | --- | --- |
| persistence | finish in-turn; no preamble prompting | O-CDX-02, O-CDX-03 | 2026-08-13 |
| frontend | anti-slop; preserve existing systems | O-CDX-04 | 2026-08-13 |
| phase | not in pasted prompts; harness-only | O-CDX-03 | 2026-08-13 |
| density | Codex-Max base, tactical additions | O-CDX-01 | 2026-08-13 |

### openai-nonreasoning-v1

| Field | Value | Source | Verified |
| --- | --- | --- | --- |
| density | precise explicit instructions | O-PE-01 | 2026-08-13 |
| planning | prompted planning more important at low/no reasoning | O-PE-01 | 2026-08-13 |

### generic-fallback-v1

Conservative intersection: outcome, constraints, success, stop,
named checks, no process scaffolding, no named frontend stack, no
persistence language, instructions then ordinary-size evidence.
Must win or tie against a vendor profile on unknown targets before
that vendor profile ships. Not yet measured.

## Staleness

Re-fetch the URLs in ground truth section 4 when a model family
releases. A profile older than 90 days without a re-verify is stale.
The map in ground truth section 7 is config, not a fact.

## Ship rule

A profile that does not beat `generic-fallback-v1` on its own target
does not replace the fallback. No such bake-off has been run.
