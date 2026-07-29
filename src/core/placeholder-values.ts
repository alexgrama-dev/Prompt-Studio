import { extractPlaceholders } from "./placeholders.ts";
import { containsLikelySecret } from "./secrets.ts";

const STORAGE_PREFIX = "prompt-studio.placeholder-values.";
const CREDENTIAL_NAME =
  /(?:^|[\s_-])(?:api[\s_-]?key|access[\s_-]?token|auth(?:orization)?|credential|password|secret|signature|private[\s_-]?key)(?:$|[\s_-])/i;

interface PlaceholderPrompt {
  id: string;
  updatedAt: string;
  body: string;
}

export interface PlaceholderValueStorage {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function loadRememberedPlaceholderValues(
  storage: PlaceholderValueStorage,
  prompt: PlaceholderPrompt,
): Promise<Record<string, string>> {
  try {
    const raw = await storage.getItem(storageKey(prompt.id));
    if (!raw) return {};
    const saved = JSON.parse(raw) as unknown;
    if (!isObject(saved) || saved.promptUpdatedAt !== prompt.updatedAt) return {};
    const values = saved.values;
    if (!isObject(values)) return {};
    return safeValues(prompt.body, values);
  } catch {
    return {};
  }
}

export async function saveRememberedPlaceholderValues(
  storage: PlaceholderValueStorage,
  prompt: PlaceholderPrompt,
  values: Readonly<Record<string, string>>,
): Promise<"saved" | "cleared" | "failed"> {
  const safe = safeValues(prompt.body, values);
  try {
    if (Object.keys(safe).length === 0) {
      await storage.removeItem(storageKey(prompt.id));
      return "cleared";
    }
    await storage.setItem(
      storageKey(prompt.id),
      JSON.stringify({ promptUpdatedAt: prompt.updatedAt, values: safe }),
    );
    return "saved";
  } catch {
    return "failed";
  }
}

export async function forgetRememberedPlaceholderValues(
  storage: PlaceholderValueStorage,
  promptId: string,
): Promise<boolean> {
  try {
    await storage.removeItem(storageKey(promptId));
    return true;
  } catch {
    return false;
  }
}

function safeValues(
  body: string,
  values: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const name of extractPlaceholders(body)) {
    const value = values[name];
    if (
      typeof value === "string" &&
      value.trim() &&
      !CREDENTIAL_NAME.test(name) &&
      !containsLikelySecret(value)
    ) {
      safe[name] = value;
    }
  }
  return safe;
}

function storageKey(promptId: string): string {
  return `${STORAGE_PREFIX}${promptId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
