# Prompt Studio enhancement evaluations

This directory freezes the quality bar before the enhancement compiler is
tuned.

`cases.json` contains 24 rough-prompt cases:

- `development`: visible while compiler instructions are being designed.
- `validation`: used to compare a candidate after tuning.
- `protected`: regression cases that cannot fail even when the aggregate score
  improves.

Every case records facts that must survive and facts the enhancer must not
invent. `rubric.md` defines the human score and hard failure rules.
`profiles.json` fixes the candidate model settings and the measurements every
run must record.

OpenAI, Anthropic, and Google use the same runner and report format:

```bash
pnpm eval:openai -- --limit 1
pnpm eval:anthropic -- --limit 1
pnpm eval:google -- --limit 1
```

These commands are dry runs unless `--confirm-spend --max-usd <limit>` is
present. A live run reads only the selected provider's environment key, writes a
private mode-0600 report, and never stores the key.

The baseline is append-only after the first accepted live run. Existing cases
may gain clarification, but their identifiers, split, rough input, required
facts, and prohibited inventions must not be changed to make a compiler look
better.
