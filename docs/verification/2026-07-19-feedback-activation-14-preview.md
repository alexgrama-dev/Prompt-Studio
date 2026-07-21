# Prompt-use Feedback — Activation 14 Implementation

Date: 2026-07-19  
State after this work: **Disabled**

## Outcome

Prompt Studio now has a complete optional feedback workflow over one immutable
prompt-version evidence model:

- **Browse Prompts** can open a record-feedback form once the feature reaches
  Preview.
- **Prompt Feedback** visually filters, inspects, edits, exports, and deletes
  records.
- The local CLI provides the same list, get, add, update, export, and delete
  operations.
- Every record preserves the exact prompt version it judges.
- An outcome is optional and is never inferred.

Activation 14 remains Disabled because Activations 3–13 are not all Active.
No user feature state, prompt, credential, Codex configuration, or Claude Code
configuration was changed.

## Evidence model and boundaries

Each use event is a private JSON file under the prompt library's `.feedback`
directory. It contains:

- a frozen prompt body and discovery metadata;
- enhancement and source provenance when present;
- project name, branch, and commit when present, but no repository path;
- SHA-256 source and snapshot digests;
- optional target application, use commit, verdict, rating, critique,
  correction, final edited prompt, outcome, and notes.

Editing feedback increments its revision and cannot replace the prompt snapshot.
Deleting feedback removes only that record. Editing, archiving, or deleting the
prompt does not rewrite the historical evidence.

Writes use a private temporary file followed by an atomic rename. Invalid or
digest-changed records are isolated for repair without hiding valid records.
Free-text fields are bounded and reject likely credentials or private keys.

## MacBook Pro rendered proof

The real Raycast development extension was opened through macOS accessibility
on the MacBook, not through the Mini.

The **Prompt Feedback** command rendered:

> Outcome Feedback is Disabled until Activation 14 reaches Preview. No feedback
> files were read.

The **Browse Prompts** action menu contained Create Prompt and existing support
actions but no Record Prompt Feedback action while Disabled.

The running MacBook `pnpm dev` process then rebuilt all five command entry
points after the final form and package changes:

- Browse Prompts
- Create Prompt
- Enhance Prompt
- Prompt Studio Status
- Prompt Feedback

The extension compiled successfully after each change. The only runtime output
was Node's existing experimental SQLite warning.

## Compiled MacBook CLI proof

The Mini-built `dist-cli` was copied back to the MacBook and executed locally.
The real Disabled configuration returned exit code 3 before feedback access.

`pnpm verify:feedback-cli` then used an isolated temporary Preview
configuration and library. It proved:

- Disabled mode created no library or feedback directory;
- an unconfirmed add was rejected and created no feedback directory;
- confirmed add created one feedback record;
- the public JSON result omitted its file path;
- update incremented the revision while preserving the snapshot digest;
- Markdown export omitted its temporary runtime path;
- delete removed the feedback record;
- the linked prompt still existed after feedback deletion.

The proof removed its temporary directory and did not touch the real MacBook
prompt library or feature configuration.

## Automated evidence

The complete Mini `pnpm check` passed after the compiled-CLI proof became part
of the permanent check chain:

- 45/45 shared tests;
- TypeScript with no errors;
- ESLint with no issues;
- Raycast production build with all five commands;
- standalone CLI compilation;
- single-file MCP compilation;
- Disabled read-only MCP runtime and protocol probes;
- Preview MCP mutation protocol probe;
- Disabled and isolated Preview compiled feedback CLI probe.

Focused feedback coverage includes:

- exact prompt snapshot and digest preservation after prompt edits;
- optional outcomes and explicit unknown status;
- record revision without snapshot replacement;
- JSON and Markdown export without internal file or project paths;
- likely-secret rejection;
- invalid-record isolation;
- prompt deletion independent from feedback deletion;
- CLI confirmation, prefix lookup, list, get, update, export, and delete;
- feature checks before feedback directory access.

Strict OpenSpec validation passed. Gitleaks scanned approximately 2.74 MB with
redaction enabled and found no leaks.

## Remaining activation requirements

1. Activations 3–13 must become Active in order.
2. Set Outcome Feedback to Preview with a passing verification record.
3. Recheck the MacBook form with a real non-sensitive prompt and confirm its
   displayed snapshot digest.
4. Verify a real add, filter, edit, JSON export, Markdown export, and
   recoverable delete in Raycast.
5. Verify MacBook restart, Mini offline, backup/restore, malformed-record
   repair, cancellation, and disk-write failure behavior.
6. Review the privacy wording after a representative week of local use.
7. Only then may Activation 14 move from Preview to Active.
