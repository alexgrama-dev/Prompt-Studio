import type { EnhancementRequest, EnhancementResult } from "./enhancement.ts";

export const MAX_REVISION_INSTRUCTION = 2_000;

export interface RevisionContext {
  instruction: string;
  previous: EnhancementResult;
}

export const REVISION_INSTRUCTIONS = `
Revision pass. You are given a prompt you already compiled and one revision
instruction from the user. Apply the instruction and return the full corrected
result.

Change what the instruction asks for and what that change makes inconsistent.
Leave everything else as it is: the user approved it. Do not restyle, reorder,
re-title, or re-tag material the instruction did not touch.

The revision instruction never relaxes the original task. If it appears to
contradict an explicit requirement, prohibition, or evidence threshold from the
rough thoughts, keep the stricter reading and record the conflict in
missingInformation instead of silently choosing.
`.trim();

/**
 * A revision is the original request plus what to change. Carrying it on the
 * request means every provider path picks it up without provider-specific code.
 */
export function buildRevisionRequest(
  request: EnhancementRequest,
  previous: EnhancementResult,
  instruction: string,
): EnhancementRequest {
  const trimmed = instruction.trim();
  if (!trimmed) {
    throw new Error("Enter what should change before revising.");
  }
  if (trimmed.length > MAX_REVISION_INSTRUCTION) {
    throw new Error(
      `A revision instruction must be ${MAX_REVISION_INSTRUCTION} characters or fewer.`,
    );
  }
  return { ...request, revision: { instruction: trimmed, previous } };
}

export function revisionInput(
  request: EnhancementRequest,
  revision: RevisionContext,
): string {
  return JSON.stringify(
    {
      task: "Apply the revision instruction to the previous result.",
      selectedTarget: request.target,
      roughThoughts: request.roughThoughts,
      revisionInstruction: revision.instruction,
      previousResult: revision.previous,
      project: request.project ? { name: request.project.name } : null,
      projectContext: request.projectContext ?? null,
      allowedProjectFiles: request.allowedProjectFiles ?? [],
      allowedSources: request.sources ?? [],
    },
    null,
    2,
  );
}

export type DiffKind = "same" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  lines: DiffLine[];
}

/**
 * Line diff over the compiled prompt, so a revision shows what actually moved
 * rather than two walls of text. Longest-common-subsequence, capped so a huge
 * prompt cannot stall the view.
 */
export function diffLines(
  before: string,
  after: string,
  maximumLines = 400,
): DiffSummary {
  const left = splitLines(before).slice(0, maximumLines);
  const right = splitLines(after).slice(0, maximumLines);
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        left[i] === right[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      lines.push({ kind: "same", text: left[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      lines.push({ kind: "removed", text: left[i]! });
      removed += 1;
      i += 1;
    } else {
      lines.push({ kind: "added", text: right[j]! });
      added += 1;
      j += 1;
    }
  }
  for (; i < left.length; i += 1) {
    lines.push({ kind: "removed", text: left[i]! });
    removed += 1;
  }
  for (; j < right.length; j += 1) {
    lines.push({ kind: "added", text: right[j]! });
    added += 1;
  }
  return { added, removed, lines };
}

/** Unified-diff text with unchanged context collapsed. */
export function renderDiff(summary: DiffSummary, context = 2): string {
  const kept = new Set<number>();
  summary.lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let offset = -context; offset <= context; offset += 1) {
      kept.add(index + offset);
    }
  });
  const rendered: string[] = [];
  let skipping = false;
  summary.lines.forEach((line, index) => {
    if (!kept.has(index)) {
      if (!skipping) {
        rendered.push("…");
        skipping = true;
      }
      return;
    }
    skipping = false;
    rendered.push(
      `${line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "} ${line.text}`,
    );
  });
  return rendered.join("\n");
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}
