export type BrowseEmptyState =
  | "load-failure"
  | "empty-library"
  | "no-results"
  | "filtered-empty";

export const ENHANCE_PROMPT_ITEM_ID = "studio:enhance-prompt";
export const REVERSE_PROMPT_ITEM_ID = "studio:reverse-prompt";
export const CAPTURE_INBOX_ITEM_ID = "studio:capture-inbox";

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

export function selectedLibraryItemId(
  selectedPromptId: string | null,
  visibleIds: readonly string[],
  studioRowIds: readonly string[],
): string | undefined {
  if (selectedPromptId && studioRowIds.includes(selectedPromptId)) {
    return selectedPromptId;
  }
  if (selectedPromptId && visibleIds.includes(selectedPromptId)) {
    return selectedPromptId;
  }
  return visibleIds[0] ?? studioRowIds[0];
}
