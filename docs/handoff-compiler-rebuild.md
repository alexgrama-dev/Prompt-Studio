# Handoff: generation compiler rebuild

Date: 2026-08-13
Branch: `compiler-rebuild` from `main` at `fa03008477ad4221eac69ee1b0a5860071b9a234`
Host: Mac Mini (source and non-runtime checks only)

## Starting state

Prompt Studio already compiles rough thoughts into a structured prompt.
Compiler version is `prompt-studio-compiler/1.2.2`. Targets are
`generic`, `codex`, and `claude-code`. Generation uses user API keys
(OpenAI, Anthropic, Google), not Raycast `AI.ask`.

The frozen eval has 24 cases and a 0–100 seven-criterion rubric.
Three 2026-08-01 OpenAI Standard runs flipped 8 of 24 pass/fail
verdicts. The 1.2.0/1.2.1 scores are noise. Accepted baseline remains
compiler 1.0.0 at 98.67 with zero hard failures. OpenSpec change
`eval-hardening` is open and unfinished.

## Planned scope

1. Phase 0: `docs/00-ground-truth.md` from current vendor pages and
   the live repo. Done when this handoff is committed with that file.
2. Phase 1: expand the eval to ≥60 cases and a 0–4 twelve-dimension
   rubric; harden the judge; keep the frozen 24 identifiers unchanged.
3. Later phases: declarative vendor×tier profiles, pipeline stages
   justified by eval, anti-pattern checks, then compiler instruction
   changes. Do not retune compiler text until the new harness is
   stable.

## Rollback

Delete the branch. `main` is unchanged until a PR merges. New docs
and eval schema live only on `compiler-rebuild`. Do not rewrite
`evals/cases.json` identifiers, `roughInput`, `requiredFacts`, or
`prohibitedInventions` on the frozen 24 cases.

## Runtime limits

Do not run `pnpm build` or `pnpm dev` on the Mac Mini. Live evals
need `--confirm-spend` and a user-supplied key. Downstream agent
evals are unpaid until the offline suite is trustworthy.

## Design council

Phase 0 is domain and conceptual-model work, not surface work.
Loaded: `layers-intro`. Surface, Impeccable, and Rams are deferred
until a pipeline change needs a Raycast UI change. Rams is not
configured in this session.
