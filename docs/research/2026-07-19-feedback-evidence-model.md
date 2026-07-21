# Prompt-use Feedback Evidence Model

Date: 2026-07-19

## Decision

Prompt Studio treats feedback like a dated lab note, not a label attached to a
changeable prompt. The record keeps the exact prompt version that was judged,
plus optional observations about how it was used. A later prompt edit cannot
quietly change what the old rating means.

```text
current prompt -> immutable snapshot -> optional use evidence
      later edit --------X---------> old snapshot
```

## Evidence that is stored

The immutable prompt snapshot contains:

- prompt identifier and update time;
- exact body, title, summary, target, tags, aliases, and hidden search terms;
- enhancement model/compiler provenance when present;
- project name, branch, and commit when present, but never the repository path;
- external and local source records when present;
- a digest of the serialized source prompt and a second digest of the stored
  snapshot.

The mutable use evidence contains:

- use time, target agent, target application, and optional project commit;
- useful, not useful, or not rated;
- optional one-to-five rating;
- optional critique, correction, and final edited prompt;
- optional observed outcome and private notes.

An absent outcome stays absent. Prompt Studio does not infer success from a
positive rating, a final prompt, or the lack of a complaint.

## Why local JSON owns feedback

Markdown owns prompts because it is readable and portable. Feedback has a more
structured lifecycle: one record per use event, revisioned edits, direct JSON
export, and individual deletion. Private JSON beside the prompt library makes
those boundaries visible while preserving the same MacBook-owned backup
surface.

SQLite is an index (a rebuildable lookup aid), not the evidence owner. Putting
feedback only in SQLite would make a deleted or rebuilt index capable of
destroying user-authored evidence. A hosted service would add an unnecessary
privacy and availability dependency.

## Integrity and privacy boundaries

- The snapshot digest is checked whenever a record is read.
- Feedback writes use a temporary file, private `0600` permissions, and an
  atomic rename so an interrupted write cannot leave a partial record.
- Invalid JSON or a changed snapshot is isolated as a repair item; it does not
  prevent valid records from loading.
- Free-text evidence is bounded and rejected when it resembles credentials or
  private keys.
- The MacBook owns the prompt and feedback directories. The Mini build mirror
  never becomes a runtime dependency.
- Deleting a feedback record does not delete its prompt. Deleting or changing a
  prompt does not erase the historical feedback snapshot.

## Activation boundary

Activation 14 gates feedback independently from enhancement and optimization.
When Disabled, the CLI and Raycast stop before reading the `.feedback`
directory. Browse Prompts omits its record-feedback action, and the dedicated
Raycast command explains that no files were read.

Activation 15 may later use human-recorded feedback as one source for candidate
testing. It must still require representative cases and explicit scoring
criteria. Feedback alone is not proof that a proposed prompt is optimized.
