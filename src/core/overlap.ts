import type { PromptRecord } from "./prompt-store.ts";

export const DEFAULT_OVERLAP_THRESHOLD = 0.55;

export interface PromptOverlap {
  leftId: string;
  leftTitle: string;
  rightId: string;
  rightTitle: string;
  similarity: number;
}

// ponytail: O(n²) lexical Jaccard over token sets; QMD vector clustering is the
// upgrade path if the library outgrows a few thousand prompts.
export function findPromptOverlaps(
  records: readonly PromptRecord[],
  threshold = DEFAULT_OVERLAP_THRESHOLD,
): PromptOverlap[] {
  if (!(threshold >= 0.2 && threshold <= 0.95)) {
    throw new Error("The overlap threshold must be between 0.2 and 0.95.");
  }
  const active = records.filter((record) => !record.archivedAt);
  const sets = active.map(promptTokens);
  const overlaps: PromptOverlap[] = [];
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      const similarity = jaccard(sets[left]!, sets[right]!);
      if (similarity >= threshold) {
        overlaps.push({
          leftId: active[left]!.id,
          leftTitle: active[left]!.title,
          rightId: active[right]!.id,
          rightTitle: active[right]!.title,
          similarity: Number(similarity.toFixed(3)),
        });
      }
    }
  }
  return overlaps.sort((a, b) => b.similarity - a.similarity);
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  similarity: number;
}

/**
 * Near-duplicates of a prompt that is about to be saved. Checked before the
 * write so the library does not accumulate three versions of the same prompt.
 */
export function findDuplicateCandidates(
  draft: { title: string; summary: string; body: string },
  records: readonly PromptRecord[],
  threshold = DEFAULT_OVERLAP_THRESHOLD,
  limit = 3,
): DuplicateCandidate[] {
  if (!(threshold >= 0.2 && threshold <= 0.95)) {
    throw new Error("The overlap threshold must be between 0.2 and 0.95.");
  }
  const draftTokens = textTokens(
    `${draft.title} ${draft.summary} ${draft.body}`,
  );
  return records
    .filter((record) => !record.archivedAt)
    .map((record) => ({
      id: record.id,
      title: record.title,
      similarity: Number(jaccard(draftTokens, promptTokens(record)).toFixed(3)),
    }))
    .filter((candidate) => candidate.similarity >= threshold)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, Math.max(0, limit));
}

function promptTokens(record: PromptRecord): Set<string> {
  return textTokens(`${record.title} ${record.summary} ${record.body}`);
}

function textTokens(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 0;
  let shared = 0;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}
