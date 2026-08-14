# Downstream fixtures

Put license-clean fixture repositories here. Each `*.json` manifest
describes one agent run. The planner loads those files. A live run
still needs `--confirm-spend`, agent keys, and the repo trees.

`repoPath` must be relative to this directory. Absolute paths and `..`
are rejected. Do not commit secrets.

Shipped fixtures:

| Manifest | Tree | Agent | Check |
| --- | --- | --- | --- |
| `bugfix-codex.json` | off-by-one `add.py` | `codex-cli` | `python3 -m unittest test_add.py -q` |
| `diagnose-claude.json` | identity bug in `broken.py` | `claude-code` | `DIAGNOSIS.md` exists and `broken.py` is unchanged |
| `ui-change.json` | HTML button labeled Submit | `codex-cli` | button label becomes Save |

Without `--confirm-spend` the planner stays dry-run with skip reason
`no-confirm-spend`. An empty fixture directory still reports
`missing-fixtures`.
