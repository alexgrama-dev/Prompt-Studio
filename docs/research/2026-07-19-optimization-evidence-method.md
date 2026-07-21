# Outcome-backed Prompt Optimization Method

Date: 2026-07-19

## Decision

Prompt Studio does not treat “the user liked this once” as proof that a prompt
is optimized. Optimization is a controlled comparison:

```text
observed feedback -> alternative instruction layers -> tune on development
                  -> check on unseen validation -> protect critical cases
                  -> human accepts exact version -> reversible activation
```

This is like testing a recipe change. The first tasting helps adjust it; a
second group checks that the change works beyond the original tasters; allergy
rules remain non-negotiable even if average taste scores improve.

## Why feedback is evidence, not a target

A useful rating can reflect the project, agent, timing, or user edits rather
than the compiler instructions. A not-useful rating can be equally ambiguous
without a critique, correction, or observed result. Candidate generation
therefore requires at least two explicitly selected feedback records and at
least one not-useful record explaining what should change.

An absent downstream outcome remains absent. A rating is never converted into a
claimed task success. Conflicting useful and not-useful records for the same
prompt snapshot stay visible; the winning candidate must name every conflicting
record it claims to address.

## Candidate boundary

The existing compiler contract is fixed. It preserves user requirements,
separates facts from assumptions, treats retrieved text as data, keeps
authorization boundaries, and requires strict structured output. A candidate
may add a small general instruction layer but cannot replace that base.

This protects against a common optimization failure: improving the saved cases
by removing a safeguard that those cases did not happen to exercise.

Candidate generation uses GPT-5.6 Sol with high reasoning because it is a
low-frequency, high-impact design task. The model choice follows the same
quality-first Deep profile already researched for prompt enhancement. It is
still only a candidate generator; it is not the evaluator or approver.

## Transmission and cost

The generation plan is reviewable before any request. It shows:

- selected prompt titles and immutable version digests;
- selected verdicts, ratings, critiques, corrections, and optional observed
  outcomes;
- frozen evaluation identifiers, splits, requirements, and prohibited
  inventions;
- requested candidate count;
- provider, model, reasoning level, request digest, and conservative cost cap.

It excludes prompt bodies, final edited prompts, private notes, project paths,
credentials, and existing evaluation outputs. One OpenAI Responses request uses
`store:false`; this does not imply zero retention. A positive confirmed USD
limit and the OpenAI key are required only at execution time.

## Evaluation rules

Every subject—the baseline and every candidate—must have completed human-review
scores for every selected case. The rubric totals 100 across fidelity,
completeness, unsupported facts, actionability, validation, authorization, and
appropriate length.

Selection is deliberately asymmetric:

1. Development scores choose the provisional candidate.
2. Validation scores check that single choice on separate cases.
3. Every protected case must avoid hard failure and score at least as well as
   the baseline.
4. The measured cost increase must stay within its explicit limit.
5. Any incomplete, duplicated, mismatched, or non-human-reviewed score set is
   rejected without changing the proposal.

This prevents repeatedly looking at validation results to tune all candidates,
which would turn the validation set into another development set.

## Approval and rollback

An evaluated winner remains a proposal. Approval requires:

- no blocked reason;
- the exact winning candidate;
- the exact full compiler-policy digest;
- a current compiler digest that still matches the proposal baseline;
- explicit human confirmation.

The compiler-state file keeps every accepted policy and each activation or
rollback event. Rolling back selects a prior digest; it does not erase the
later policy, proposal, score records, feedback, or prompt versions.

Preview acceptance can test storage and rollback, but enhancement reads the
accepted policy only after Activation 15 becomes Active.

## Primary method sources

The broader model, prompting, privacy, and evaluation research is recorded in
`docs/research/2026-07-19-enhancement-engine.md`. Its primary sources include
OpenAI's prompt guidance, evaluation best practices, Responses API, Structured
Outputs, data controls, safety guidance, and pricing. The local frozen rubric
and split definitions are in `evals/rubric.md`, `evals/cases.json`, and
`evals/README.md`.
