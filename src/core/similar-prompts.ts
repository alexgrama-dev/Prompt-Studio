import { searchPromptRecords } from "./record-search.ts";
import type { PromptRecord, PromptTarget } from "./prompt-store.ts";

export interface SimilarPromptExample {
  title: string;
  body: string;
}

const DEFAULT_LIMIT = 2;
const DEFAULT_MAX_BODY = 800;
const MIN_QUERY = 8;

export function recallSimilarPrompts(
  records: readonly PromptRecord[],
  query: string,
  options: {
    target?: PromptTarget;
    limit?: number;
    maxBodyChars?: number;
  } = {},
): SimilarPromptExample[] {
  const needle = query.trim();
  if (needle.length < MIN_QUERY || records.length === 0) return [];
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxBody = options.maxBodyChars ?? DEFAULT_MAX_BODY;
  const hits = searchPromptRecords(records, needle, {
    ...(options.target ? { target: options.target } : {}),
    limit: Math.max(limit * 4, 8),
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  const out: SimilarPromptExample[] = [];
  for (const hit of hits) {
    const record = byId.get(hit.id);
    if (!record) continue;
    const body = clipBody(record.body, maxBody);
    if (body.length < MIN_QUERY) continue;
    if (out.some((item) => item.body === body)) continue;
    out.push({ title: record.title, body });
    if (out.length >= limit) break;
  }
  return out;
}

export function similarPromptCompilerSection(
  examples: readonly SimilarPromptExample[],
): string {
  if (examples.length === 0) return "";
  const blocks = examples.map(
    (example, index) =>
      `Example ${index + 1} — ${example.title}\n${example.body}`,
  );
  return [
    "Similar saved prompts (style and structure only).",
    "Do not copy their project names, files, commands, or facts unless the user named them.",
    ...blocks,
  ].join("\n\n");
}

function clipBody(body: string, maxChars: number): string {
  const text = body.trim();
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars - 1);
  const boundary = head.lastIndexOf(" ");
  const kept = boundary >= Math.floor(maxChars / 2) ? head.slice(0, boundary) : head;
  return `${kept.trimEnd()}…`;
}
