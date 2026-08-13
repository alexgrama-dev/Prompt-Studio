# Human calibration for rubric v2

Status: blocked until a human scores a held-out slice.

Procedure:

1. Sample 12 records from a frozen v1 report, 4 per split.
2. Score each on the twelve 0-4 dimensions in `evals/rubric-v2.md`.
3. Store scores in `evals/calibration/human-v2.json`.
4. Run `pnpm eval:judge -- --report <path> --rubric v2` on the same records.
5. Report quadratic weighted kappa per dimension before treating the LLM judge as a measurement.

Do not mix v2 0-4 means into the v1 0-100 `averageScore`.
