# Search Runtime Reliability — Verification

Date: 2026-07-29

## Outcome

- Exact search, Markdown fallback, QMD meaning search, CLI, MCP, and the Raycast no-match state were verified on the MacBook.
- A live check found that generic `coding-agent prompt` text in every vector query made a broad AMP Studio prompt match unrelated requests.
- Prompt Studio now embeds only the requested task. The confidence rule is calibrated to `0.35` for that uninflated query.

## Real QMD Controls

- `find the underlying cause before making a small repair` returned the two relevant diagnosis prompts at `0.430` and `0.376`.
- `zzqvplmokn` had a strongest raw score of `0.210` and returned no prompt.
- `organize my spice rack` had a strongest raw score of `0.185` and returned no prompt.
- `make blueberry pancakes` had a strongest raw score of `0.156` and returned no prompt.
- Raycast showed No Matching Prompt for `organize my spice rack` and retained the exact query with both recovery routes.

## CLI and MCP Evidence

- A CLI search against a missing SQLite path returned the exact Markdown prompt and printed `INDEX_NOT_CREATED`.
- `pnpm verify:mcp-mutations` passed on the MacBook. It exposed the separate enhancement-save tool, required confirmation, rejected invalid feedback, and kept the audit privacy-safe.
- The installed CLI symlink reported a stale-build warning after a shared-core source timestamp changed. `pnpm build:cli` cleared that warning.
- The MacBook CLI reported 14 valid prompts, no invalid prompts, and a healthy 14-record search index.

## Automated Evidence

- `pnpm test`: 85 passed, 0 failed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with zero warnings.
- `pnpm check`: passed on the Mac Mini.
- `pnpm check:store`: passed.
- `openspec validate --all --strict`: 20 passed, 0 failed.
