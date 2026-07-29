export type BrowseEmptyState =
  | "load-failure"
  | "empty-library"
  | "no-results"
  | "filtered-empty";

export function browseEmptyState({
  loading,
  error,
  recordCount,
  visibleCount,
  query,
}: {
  loading: boolean;
  error?: string;
  recordCount: number;
  visibleCount: number;
  query: string;
}): BrowseEmptyState | undefined {
  if (loading) return undefined;
  if (error) return "load-failure";
  if (visibleCount > 0) return undefined;
  if (recordCount === 0) return "empty-library";
  return query.trim() ? "no-results" : "filtered-empty";
}
