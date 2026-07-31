import type { PromptRecord } from "./prompt-store.ts";

export interface PendingEnhancementHistory {
  history?: PromptRecord;
}

export async function finishEnhancementHistory(
  pending: PendingEnhancementHistory,
  writeHistory: () => Promise<PromptRecord>,
  clearDraft: () => Promise<void>,
): Promise<PromptRecord> {
  const history = pending.history ?? (await writeHistory());
  pending.history = history;
  await clearDraft();
  return history;
}

export function enhancementRunWasCancelled(
  error: unknown,
  signal?: AbortSignal,
): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error &&
      (error.name === "AbortError" ||
        /cancelled|canceled/i.test(error.message)))
  );
}
