# Prompt Studio enhancement evaluations

This directory freezes the quality bar before the enhancement compiler is
tuned.

`cases.json` contains 24 frozen rough-prompt cases:

- `development`: visible while compiler instructions are being designed.
- `validation`: used to compare a candidate after tuning.
- `protected`: regression cases that cannot fail even when the aggregate score
  improves.

`cases-extended.json` adds 37 cases covering task classes and adversarial
shapes. The default evaluation plan still uses only the frozen 24. Pass
`{ corpus: "all" }` to include both (60+).

Every case records facts that must survive and facts the enhancer must not
invent. `rubric.md` is the historical 0–100 score. `rubric-v2.md` is the
twelve-dimension 0–4 rubric. `profiles.json` fixes the candidate model
settings and the measurements every run must record.

OpenAI, Anthropic, and Google use the same runner and report format:

```bash
pnpm eval:openai -- --limit 1
pnpm eval:anthropic -- --limit 1
pnpm eval:google -- --limit 1
```

These commands are dry runs unless `--confirm-spend --max-usd <limit>` is
present. A live run reads only the selected provider's environment key, writes a
private mode-0600 report, and never stores the key.

Accept/reject decisions need `--repeats 3`. Default `repeats` is 1 so a
single-generation debug run keeps the frozen 24-case cost. The plan
multiplies `maximumModelTokenCostUsd` by `repeats`. Repeat `--case <id>`
to pin a subset:

```bash
pnpm eval:openai -- --case protected-untrusted-reference --case dev-test-flake --repeats 3
```

The baseline is append-only after the first accepted live run. Existing cases
may gain clarification, but their identifiers, split, rough input, required
facts, and prohibited inventions must not be changed to make a compiler look
better.
