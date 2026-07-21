# Local CLI — Activation 11 Implementation

Date: 2026-07-19  
State after this work: **Disabled**

## Outcome

Prompt Studio now has a compiled local command-line interface for Codex, Claude
Code, terminals, and other coding tools. It uses the same Markdown prompt
records, exact and meaning-based search, validation, and model-provider
adapters as Raycast.

The compiled program runs directly on the MacBook Pro. The Mac Mini is only the
build-and-test mirror; it is not contacted and does not need to be awake when
the CLI runs.

Activation 11 remains Disabled because Activations 3–10 have not all passed.
The safe `status` command works now, while every prompt-reading or mutating
command stops at the activation boundary.

## Implemented commands

- `status`
- `list`
- `search`
- `get`
- `copy`
- `create`
- `update`
- `archive`
- `validate`
- `reindex`
- `enhance`

List, search, get, validation, and enhancement reuse the same shared-core
functions as the Raycast commands. SQLite and QMD remain rebuildable indexes;
Markdown remains the only durable prompt source.

## Safety and automation contract

- Human-readable output is the default.
- `--json` returns one stable success or error envelope.
- Exit codes distinguish success, usage or confirmation failure, Disabled
  capabilities, missing prompts, invalid files, operating failures, and
  cancellation.
- Create, update, archive, and reindex require `--yes`.
- Enhancement requires `--yes` before a provider call and `--save` before any
  prompt write.
- Provider keys are accepted only through `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` in the current process.
- API-key command arguments are rejected, secrets are absent from output, and a
  provider failure cannot fall back to another provider.
- A Disabled `status` call does not create or read the prompt library, inspect
  an index, read credentials, start background work, or make a network request.

## MacBook Pro runtime proof

The CLI was compiled on the Mini, copied as one complete `dist-cli` directory,
and then executed locally on the MacBook:

```bash
node dist-cli/cli/prompt-studio.mjs status --json
```

The command returned exit code 0 and reported the MacBook's actual activation
state, including `local-cli: disabled`.

The following MacBook command:

```bash
node dist-cli/cli/prompt-studio.mjs list --json
```

returned exit code 3 with `FEATURE_DISABLED` before reading the prompt library.
Neither runtime command used SSH or a Mini service.

## Automated evidence

The shared suite covers:

- Disabled status with an intentionally nonexistent library path and proof that
  the path stays nonexistent
- Disabled command rejection before library access
- create, list, multi-record ordering, exact search, identifier-prefix get,
  clipboard copy, update, archive, and archived-record filtering
- direct equality between CLI record order and the records Raycast consumes
- direct equality between CLI exact-search order and Raycast's SQLite results
- invalid Markdown reporting with the documented validation exit code
- reindex confirmation and a rebuilt healthy SQLite index
- enhancement confirmation, missing key, rejected key argument, validated
  preview, explicit save, secret exclusion, and no provider fallback

The current clean Mac Mini mirror results are:

- 38/38 shared tests passed
- TypeScript completed with no errors
- ESLint completed with no issues
- standalone CLI compilation completed successfully
- Raycast production build completed successfully
- Prettier found every checked file correctly formatted
- strict OpenSpec validation passed
- Gitleaks scanned approximately 864 KB with redaction enabled and found no
  leaks
- the compiled Mini binary returned valid JSON for `status`

The final copied MacBook artifact was executable (`-rwxr-xr-x`), returned valid
MacBook status JSON directly through its shebang, and preserved the exit-code 3
Disabled guard for `list`.

## Remaining activation requirements

1. Activations 3–10 must become Active in order.
2. Activation 11 must enter Preview with a recorded verification result.
3. The installed MacBook command must pass real-library list, search, get,
   copy, validate, reindex, and cancellation checks.
4. Enhancement must be exercised only after the selected provider is Active
   and Alex explicitly approves any paid request.
5. Only then may Activation 11 move from Preview to Active.
