# Downstream fixtures

Put license-clean fixture repositories here. Each `*.json` manifest
describes one agent run. The planner loads those files. A live run
still needs `--confirm-spend`, agent keys, and the repo trees.

Example manifest:

```json
{
  "id": "bugfix-codex",
  "caseId": "dev-debug-intermittent-api",
  "taskClass": "bugfix",
  "repoPath": "bugfix-codex",
  "agent": "codex-cli",
  "timeoutMs": 120000,
  "successChecks": ["tests pass"]
}
```

`repoPath` must be relative to this directory. Absolute paths and `..`
are rejected. Do not commit secrets.
