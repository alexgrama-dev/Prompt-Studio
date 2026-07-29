import type { FeatureState } from "./features.ts";
import { promptVersionSnapshot } from "./feedback-store.ts";
import type { PromptRecord } from "./prompt-store.ts";

export const LAST_LIBRARY_PASTE_KEY = "prompt-studio.last-library-paste";

export interface LastLibraryPastePointer {
  schemaVersion: 1;
  promptId: string;
  promptUpdatedAt: string;
  sourceDigest: string;
  pastedAt: string;
}

export interface LastLibraryPasteStorage {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface RatingEvidence {
  prompt: {
    promptId: string;
    promptUpdatedAt: string;
    sourceDigest: string;
  };
  use: { usedAt: string };
  verdict: "not-rated" | "useful" | "not-useful";
}

export function quickRatingEnabled(state: FeatureState): boolean {
  return state !== "disabled";
}

export async function recordLastLibraryPaste(
  storage: LastLibraryPasteStorage,
  state: FeatureState,
  prompt: PromptRecord,
  now = new Date(),
): Promise<"saved" | "disabled" | "failed"> {
  if (!quickRatingEnabled(state)) return "disabled";
  try {
    const version = promptVersionSnapshot(prompt);
    const pointer: LastLibraryPastePointer = {
      schemaVersion: 1,
      promptId: prompt.id,
      promptUpdatedAt: prompt.updatedAt,
      sourceDigest: version.sourceDigest,
      pastedAt: now.toISOString(),
    };
    await storage.setItem(LAST_LIBRARY_PASTE_KEY, JSON.stringify(pointer));
    return "saved";
  } catch {
    return "failed";
  }
}

export async function loadLastLibraryPaste(
  storage: LastLibraryPasteStorage,
  state: FeatureState,
): Promise<LastLibraryPastePointer | undefined> {
  if (!quickRatingEnabled(state)) return undefined;
  try {
    const raw = await storage.getItem(LAST_LIBRARY_PASTE_KEY);
    return raw ? parsePointer(JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export async function clearLastLibraryPaste(
  storage: LastLibraryPasteStorage,
  state: FeatureState,
): Promise<boolean> {
  if (!quickRatingEnabled(state)) return false;
  try {
    await storage.removeItem(LAST_LIBRARY_PASTE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function resolveLastLibraryPaste(
  pointer: LastLibraryPastePointer,
  records: readonly PromptRecord[],
): PromptRecord | undefined {
  return records.find(
    (record) =>
      record.id === pointer.promptId &&
      record.updatedAt === pointer.promptUpdatedAt &&
      promptVersionSnapshot(record).sourceDigest === pointer.sourceDigest,
  );
}

export function lastLibraryPasteWasRated(
  pointer: LastLibraryPastePointer,
  feedback: readonly RatingEvidence[],
): boolean {
  return feedback.some(
    (record) =>
      record.prompt.promptId === pointer.promptId &&
      record.prompt.promptUpdatedAt === pointer.promptUpdatedAt &&
      record.prompt.sourceDigest === pointer.sourceDigest &&
      record.use.usedAt === pointer.pastedAt &&
      record.verdict !== "not-rated",
  );
}

export async function completeLastPasteRating(
  writeFeedback: () => Promise<void>,
  clearPointer: () => Promise<boolean>,
): Promise<"saved" | "saved-pointer-retained" | "failed"> {
  try {
    await writeFeedback();
  } catch {
    return "failed";
  }
  try {
    return (await clearPointer()) ? "saved" : "saved-pointer-retained";
  } catch {
    return "saved-pointer-retained";
  }
}

function parsePointer(value: unknown): LastLibraryPastePointer | undefined {
  if (!isObject(value) || value.schemaVersion !== 1) return undefined;
  const promptId = value.promptId;
  const promptUpdatedAt = value.promptUpdatedAt;
  const sourceDigest = value.sourceDigest;
  const pastedAt = value.pastedAt;
  if (
    typeof promptId !== "string" ||
    typeof promptUpdatedAt !== "string" ||
    typeof sourceDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(sourceDigest) ||
    typeof pastedAt !== "string" ||
    !validTimestamp(promptUpdatedAt) ||
    !validTimestamp(pastedAt)
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    promptId,
    promptUpdatedAt,
    sourceDigest,
    pastedAt,
  };
}

function validTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
