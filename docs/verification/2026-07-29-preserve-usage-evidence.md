# Preserve Usage Evidence Verification

Date: 2026-07-29  
Change: `preserve-usage-evidence`  
Implementation branch: `cdx/prompt-studio-daily-use`

## Result

Search-index rebuilds now carry forward recorded prompt-use counts. If the
existing evidence cannot be read, the rebuild stops before replacing the
index. Statistics also distinguish an unavailable index from prompts with a
recorded count of zero.

## Automated proof

The Mac Mini mirror passed `pnpm check`:

- 71/71 shared tests passed.
- TypeScript and ESLint passed.
- The Raycast extension, CLI, and MCP bundles built.
- All CLI and MCP runtime probes passed.

`pnpm check:store` also passed:

- 3/3 Store-core tests passed.
- The allowlisted Store package installed, linted, and built.

`openspec validate --all --strict` passed 19/19 items.

## MacBook runtime proof

The clean MacBook runtime checked out commit `9df892f` from the implementation
branch and rebuilt its CLI. Before the rebuild, the real library contained 13
valid prompts and the SQLite search index was healthy at schema 4.

The rebuild reported:

```text
Exact search: healthy · 13 prompts
QMD semantic index: unchanged
```

A read-only query captured the complete usage rows before and after the
rebuild. The live index currently has no recorded-use rows, so the observed
proof is deliberately bounded:

| Snapshot | Rows | Total uses | SHA-256 |
| --- | ---: | ---: | --- |
| Before | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| After | 0 | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The table above does not demonstrate a non-zero live carry-forward because
there was no live usage row to preserve. The regression
`SQLite search rebuild preserves recorded prompt usage` covers a non-zero
snapshot across explicit and automatic rebuilds.

The MacBook status also confirmed that GitHub MCP Research, Anthropic Provider,
and Google Provider remain Disabled.
