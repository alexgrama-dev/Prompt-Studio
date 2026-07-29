import type { PromptRecord } from "./prompt-store.ts";

interface RecordSearchFilters {
  target?: PromptRecord["target"];
  projectPath?: string;
  tag?: string;
  favorite?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

interface RecordSearchResult {
  id: string;
  score: number;
  matchedBy: string[];
}

export function searchPromptRecords(
  records: readonly PromptRecord[],
  query: string,
  filters: RecordSearchFilters = {},
): RecordSearchResult[] {
  const needle = normalizeSearchText(query);
  const tokens = needle.split(/\s+/u).filter(Boolean);
  return records
    .filter((record) => filters.includeArchived || !record.archivedAt)
    .filter((record) => !filters.target || record.target === filters.target)
    .filter(
      (record) =>
        !filters.projectPath || record.project?.path === filters.projectPath,
    )
    .filter(
      (record) =>
        !filters.tag ||
        record.tags.some(
          (tag) =>
            normalizeSearchText(tag) === normalizeSearchText(filters.tag!),
        ),
    )
    .filter(
      (record) =>
        filters.favorite === undefined || record.favorite === filters.favorite,
    )
    .flatMap((record) => {
      if (!needle) {
        return [
          {
            id: record.id,
            score: record.favorite ? 2 : 0,
            matchedBy: record.favorite ? ["favorite"] : ["recent"],
            updatedAt: record.updatedAt,
            title: record.title,
          },
        ];
      }
      const fields = fallbackSearchFields(record);
      if (
        !tokens.every((token) =>
          fields.some((field) =>
            field.values.some((value) => value.includes(token)),
          ),
        )
      ) {
        return [];
      }
      const matchedBy = fields
        .filter((field) => fieldMatches(field.values, tokens))
        .map((field) => field.name);
      const title = normalizeSearchText(record.title);
      const tags = record.tags.map(normalizeSearchText);
      const score =
        (title === needle ? 100 : 0) +
        (fieldMatches([title], tokens) ? 40 : 0) +
        (tags.includes(needle) ? 70 : 0) +
        (fieldMatches(tags, tokens) ? 35 : 0) +
        (fieldMatches(record.aliases.map(normalizeSearchText), tokens)
          ? 32
          : 0) +
        (fieldMatches(record.searchTerms.map(normalizeSearchText), tokens)
          ? 30
          : 0) +
        (fieldMatches(
          record.project
            ? [
                normalizeSearchText(record.project.name),
                normalizeSearchText(record.project.path),
              ]
            : [],
          tokens,
        )
          ? 25
          : 0) +
        (fieldMatches([normalizeSearchText(record.summary)], tokens) ? 10 : 0) +
        (fieldMatches([normalizeSearchText(record.body)], tokens) ? 1 : 0) +
        (record.favorite ? 2 : 0);
      return [
        {
          id: record.id,
          score,
          matchedBy: matchedBy.length > 0 ? matchedBy : ["full text"],
          updatedAt: record.updatedAt,
          title: record.title,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, clampLimit(filters.limit))
    .map(({ id, score, matchedBy }) => ({ id, score, matchedBy }));
}

function fallbackSearchFields(record: PromptRecord) {
  const field = (name: string, values: readonly string[]) => ({
    name,
    values: values.map(normalizeSearchText).filter(Boolean),
  });
  return [
    field("title", [record.title]),
    field("tag", record.tags),
    field("alias", record.aliases),
    field(
      "project",
      record.project ? [record.project.name, record.project.path] : [],
    ),
    field("hidden search term", record.searchTerms),
    field("summary", [record.summary]),
    field("prompt body", [record.body]),
    field("target", [record.target]),
    field("full text", [
      ...(record.assumptions ?? []),
      ...(record.missingInformation ?? []),
      ...(record.validationSteps ?? []),
      ...(record.sources ?? []).flatMap((source) => [
        source.title,
        ...(source.supports ?? []),
      ]),
      ...Object.values(record.taxonomy ?? {}).flat(),
    ]),
  ];
}

function fieldMatches(values: readonly string[], tokens: readonly string[]) {
  return tokens.every((token) => values.some((value) => value.includes(token)));
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function clampLimit(limit = 100): number {
  return Math.max(1, Math.min(500, Math.trunc(limit)));
}
