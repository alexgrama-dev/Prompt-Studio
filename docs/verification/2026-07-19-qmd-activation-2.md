# QMD Semantic Discovery Activation 2 Verification

Verified and activated on 2026-07-19.

## Outcome

QMD meaning-based prompt discovery is active in the real MacBook Pro Raycast
extension. SQLite exact search remains the immediate first result source and
the automatic fallback.

`search text -> immediate SQLite results -> local QMD meaning results -> one ranked list`

Exact title, tag, project, and body matches remain ahead of meaning-only
matches. A result that appears in both sources is shown once with both match
explanations.

## MacBook Pro rendered proof

Two temporary prompts were indexed:

- an intermittent API timeout and retry-race debugging prompt
- an unrelated mobile layout design prompt

The query below intentionally shared no exact phrase with the API prompt:

`unreliable server communication works on some attempts but not others`

Observed behavior:

- SQLite returned no exact result.
- Raycast returned only the intermittent API prompt.
- The result displayed `Matched: meaning (QMD)`.
- The unrelated mobile-design prompt was excluded by the semantic confidence
  boundary.
- Prompt Studio Status displayed QMD 2.5.3, Preview during the check, Healthy,
  two documents, two vectors, last update, executable path, and a manual refresh
  action.

QMD then moved from Preview to Active with a timestamped passing verification
record.

## Automated proof

The same source passed on the MacBook Pro and Mac Mini:

- 9 of 9 tests
- TypeScript type checking
- ESLint with zero warnings
- Prettier formatting check
- production Raycast build
- strict OpenSpec validation

The QMD test boundary uses an injected command runner, so automated tests never
touch the user's real QMD collection, download models, or contaminate the live
prompt index. It covers:

- isolated collection creation
- update and embedding command sequence
- saved fingerprint and health checks
- strict JSON result validation
- prompt-ID recovery from QMD paths
- deterministic SQLite and QMD result fusion
- unavailable-QMD reporting and exact-search fallback

## Privacy and performance

QMD 2.5.3 runs locally. The MacBook already had its embedding, reranking, and
query-expansion model files cached. Prompt content was not sent to an external
service.

The active Raycast path uses a structured lexical-plus-vector query and disables
the heavier reranker. SQLite results appear immediately; the local meaning
result followed in about one second during rendered verification.

Raycast starts extensions with a narrow command path. The first Preview check
therefore exposed `env: node: No such file or directory` even though QMD worked
in Terminal. The integration now supplies a bounded macOS child-process path
including `/opt/homebrew/bin`, so QMD can find Node without depending on the
interactive shell.

## Recovery behavior

If QMD is missing, stale, unhealthy, times out, or returns malformed JSON:

- SQLite exact and filtered search remains active.
- Raycast shows a recoverable failure notice.
- Prompt Studio Status shows the QMD failure.
- Refresh QMD Meaning Index rebuilds the local collection and embeddings.

## Final cleanup

Both temporary prompts were deleted after activation. Final live state:

- Markdown prompt records: 0
- invalid prompt records: 0
- SQLite records: 0, Healthy
- QMD documents and vectors: 0, Healthy
- optional capabilities after Activation 2: all Disabled

## Mac Mini note

The repo integration passes all automated checks on the Mac Mini. Its separate
global QMD installation currently has a native `better-sqlite3` component built
for an older Node version, so live QMD CLI execution there reports a Node ABI
mismatch. The Mac Mini is not the product runtime, and its shared global install
was not silently rebuilt. The MacBook Pro runtime is healthy and fully rendered.

## 2026-07-20 populated-library regression recheck

Saving the first real enhanced prompt exposed a development-mode race: two
Raycast loads both saw a stale QMD index and ran `qmd update` concurrently. One
refresh completed; the other failed on QMD's SQLite primary-key constraint.

The shared QMD rebuild function now reuses one in-flight refresh for identical
requests and waits before changing to a different collection target. The
focused regression check runs two rebuild requests together and proves only one
QMD update occurs.

The Mac Mini then passed all 50 tests, typecheck, lint, every build and runtime
probe, strict OpenSpec validation, and the secret scan. On the MacBook Pro,
Browse Prompts reopened without an error and the meaning-only query
`find the underlying cause before making a small repair` returned the saved
prompt with `Matched: meaning (QMD)`. QMD remains Active.
