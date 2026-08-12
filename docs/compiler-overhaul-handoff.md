# Prompt Compiler Overhaul Handoff

## Objective

Replace Prompt Studio's hand-authored enhancement template with an evaluated,
model-adaptive compiler for terse coding requests. Complete all phases and gates
in the accepted overhaul brief.

## Starting state

- Date: 2026-08-12
- Starting host: Alex’s MacBook Pro (`Alexs-MacBook-Pro`), as recorded when the
  branch was created; current code work runs on the Mac Mini
- Branch: `cursor/compiler-overhaul-78b1`
- Base branch: `main`
- Base commit: `fa03008477ad4221eac69ee1b0a5860071b9a234`
- Current compiler: `prompt-studio-compiler/1.2.1`
- Existing frozen evaluation: 24 cases with an accepted 1.0.0 baseline
- Phase 0 ground truth is recorded in `docs/00-ground-truth.md`
- Eval-hardening is implemented: supplied-context judging, guardrail split,
  and N=3 majority-vote decisions
- Remaining blocker: live 3-generation re-run still needs an explicit cost
  ceiling and credentials
- Runtime boundary: Raycast builds and UI checks run only on the MacBook Pro

## Planned scope

1. Capture current Raycast, OpenAI, and Anthropic behavior with citations.
2. Build a 60-case corpus, anchored rubric, calibrated judging, downstream
   fixture tasks, and CI regression checks before changing generation behavior.
3. Add typed, pure compiler stages for capture, classification, gap analysis,
   optional context, elicitation, target profiling, composition, critique, and
   rendering.
4. Add schema-validated vendor and reasoning-tier profiles with provenance,
   conflict branches, staleness checks, and a generic fallback.
5. Add anti-pattern checks, local telemetry, caching, streaming Raycast delivery,
   preferences, history, and graceful degraded paths.
6. Run fresh unit, integration, profile, downstream, adversarial, and Raycast
   checks. Record only measured results.

## Proof required

- Every named deliverable exists and matches current implementation.
- Every completion-gate row has direct evidence or remains explicitly open.
- Every generation change has a fresh evaluation receipt.
- Downstream generated prompts beat raw inputs per task class.
- Raycast paths have captured runtime evidence, not build-only inference.

## Rollback

No production data migration is planned. Markdown prompt files remain unchanged.
To abandon the overhaul, switch back to `main` and delete the unmerged
`cursor/compiler-overhaul-78b1` branch after preserving any desired research
documents. Do not reset or overwrite user work.
