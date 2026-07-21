# Local Read-only MCP — Activation 12 Implementation

Date: 2026-07-19  
State after this work: **Disabled**

## Outcome

Prompt Studio now has a standards-based local server that lets Codex and Claude
Code discover and retrieve saved prompts through four read-only tools. The
server is built on the Mac Mini, copied as one executable file, and runs
entirely on the MacBook Pro without SSH or a Mini service.

Activation 12 remains Disabled because Activations 3–11 are not all Active.
The server can safely report its feature state now; prompt list, search, and get
requests stop before reading data.

## Implemented tools

- `prompt_studio_status`
- `prompt_studio_list`
- `prompt_studio_search`
- `prompt_studio_get`

All tools use the same Markdown parser and SQLite search contract as Raycast and
the CLI. They advertise read-only, non-destructive, repeatable, closed-world
annotations. No write, archive, enhancement, or delete tool is present.

## Read boundary

- Disabled status reads feature configuration only.
- Disabled list, search, and get stop before prompt or index access.
- The prompt directory is never created by an MCP read.
- Search opens a healthy SQLite index read-only and never rebuilds it.
- A missing, stale, or corrupt index returns `INDEX_UNAVAILABLE`.
- List returns at most 50 summaries.
- Search returns at most 25 matches.
- Get returns at most 20,000 prompt-body characters.
- Prompt file paths and project paths are not returned.
- MacBook home paths inside safe display text become `~/`.
- Secret-shaped queries and tag filters are rejected.
- Secret-shaped summaries are omitted from discovery.
- A prompt whose returned content appears to contain a secret is withheld.
- Raw local exceptions and paths are not included in errors.

## Audit and cancellation

Active calls append a local audit event with only:

- timestamp
- tool name
- success or error
- duration
- result count
- safe error code

No argument, search query, prompt ID, prompt body, or local path is logged. The
file rotates at 1 MB. If the audit cannot be written, no prompt content is
returned. Disabled requests do not create an audit file.

The server receives the MCP request cancellation signal and checks it before
and after asynchronous reads and before returning content.

## MacBook Pro protocol proof

The final bundled executable was copied from the Mini to:

```text
/Users/alexgrama/Developer/prompt-studio/dist-mcp/prompt-studio.mjs
```

It was executable and completed a dependency-free MacBook protocol probe:

```bash
node --experimental-strip-types scripts/verify-mcp-bundle.mts
```

Observed result:

- protocol `2025-11-25` initialized successfully
- all four expected tools were listed
- status returned `disabled` and `dataRead: false`
- list returned `FEATURE_DISABLED`
- the nonexistent test library, index, and audit paths stayed nonexistent
- the server wrote only protocol JSON to standard output

This was a MacBook-local child process. The probe did not contact the Mini.

## Automated evidence

The shared suite covers:

- real MCP client/server initialization over linked protocol transports
- tool listing and read-only annotations
- Disabled status and prompt-access rejection without filesystem mutation
- multi-record list and exact-search behavior
- concurrent list, search, and get calls
- UUID-prefix retrieval
- path redaction and project-path omission
- safe prompt-body bounding
- secret-shaped prompt omission and content refusal
- malformed input through the SDK's tool schema
- missing-index behavior without an implicit rebuild
- privacy-safe audit contents and audit-write failure
- cancellation before prompt access

Current clean Mini results:

- 40/40 shared tests passed
- TypeScript completed with no errors
- ESLint completed with no issues
- Raycast production build completed successfully
- standalone CLI compilation completed successfully
- the single-file MCP bundle built successfully
- an SDK client spawned the compiled bundle, completed initialization, listed
  all four tools, verified Disabled behavior, and observed no created files
- a dependency-free protocol client independently repeated that compiled-bundle
  proof
- Prettier found every checked file correctly formatted
- strict OpenSpec validation passed
- Gitleaks scanned approximately 930 KB with redaction enabled and found no
  leaks

The final copied MacBook artifact was executable (`-rwxr-xr-x`), measured
1,187,297 bytes, and repeated the protocol 2025-11-25 proof without any package
dependency or Mini connection.

## Remaining activation requirements

1. Activations 3–11 must become Active in order.
2. Activation 12 must enter Preview with a passing verification record.
3. Add the documented MacBook-only Codex and Claude Code configuration.
4. In both clients, verify tool discovery, real-library list/search/get,
   missing-index handling, cancellation, audit rotation, and Mini-offline use.
5. Only then may Activation 12 move from Preview to Active.
