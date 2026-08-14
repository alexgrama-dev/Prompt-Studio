import type { PromptUseFeedbackRecord } from "./feedback-store.ts";

export interface OutcomeLesson {
  verdict: string;
  outcome?: string;
  critique?: string;
  correction?: string;
}

const DEFAULT_LIMIT = 3;
const MAX_FIELD = 400;

export function recallOutcomeLessons(
  records: readonly PromptUseFeedbackRecord[],
  options: { limit?: number } = {},
): OutcomeLesson[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const lessons: OutcomeLesson[] = [];
  for (const record of records) {
    if (!hasLessonSignal(record)) continue;
    const critique = clip(record.critique);
    const correction = clip(record.correction);
    const outcome = record.outcome
      ? clip(
          record.outcome.summary
            ? `${record.outcome.status}: ${record.outcome.summary}`
            : record.outcome.status,
        )
      : undefined;
    if (!critique && !correction && !outcome) continue;
    lessons.push({
      verdict: record.verdict,
      ...(outcome ? { outcome } : {}),
      ...(critique ? { critique } : {}),
      ...(correction ? { correction } : {}),
    });
    if (lessons.length >= limit) break;
  }
  return lessons;
}

export function outcomeLessonCompilerSection(
  lessons: readonly OutcomeLesson[],
): string {
  if (lessons.length === 0) return "";
  const blocks = lessons.map((lesson, index) => {
    const lines = [`Lesson ${index + 1} — ${lesson.verdict}`];
    if (lesson.outcome) lines.push(`Outcome: ${lesson.outcome}`);
    if (lesson.critique) lines.push(`Not useful because: ${lesson.critique}`);
    if (lesson.correction) lines.push(`Correction that worked: ${lesson.correction}`);
    return lines.join("\n");
  });
  return [
    "Outcome lessons from later agent runs (do not copy as project facts).",
    "Treat these as failure modes to avoid, not as files, commands, or requirements.",
    ...blocks,
  ].join("\n\n");
}

function hasLessonSignal(record: PromptUseFeedbackRecord): boolean {
  if (record.verdict === "not-useful") return true;
  const status = record.outcome?.status;
  return status === "failed" || status === "partial";
}

function clip(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return;
  if (text.length <= MAX_FIELD) return text;
  const head = text.slice(0, MAX_FIELD - 1);
  const boundary = head.lastIndexOf(" ");
  const kept =
    boundary >= Math.floor(MAX_FIELD / 2) ? head.slice(0, boundary) : head;
  return `${kept.trimEnd()}…`;
}
