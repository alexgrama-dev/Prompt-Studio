import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EnhancementProvider } from "./enhancement.ts";

export const PROVIDER_KEY_NAMES = [
  "openaiApiKey",
  "anthropicApiKey",
  "googleApiKey",
  "deepseekApiKey",
] as const;

export type ProviderKeyName = (typeof PROVIDER_KEY_NAMES)[number];

export type LocalProviderKeys = Partial<Record<ProviderKeyName, string>>;

export function providerKeysPath(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Prompt Studio",
    "provider-keys.json",
  );
}

export function loadLocalProviderKeys(
  path = providerKeysPath(),
): LocalProviderKeys {
  if (
    process.env.PROMPT_STUDIO_DISABLE_LOCAL_PROVIDER_KEYS === "1" &&
    path === providerKeysPath()
  ) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    const keys: LocalProviderKeys = {};
    for (const name of PROVIDER_KEY_NAMES) {
      const value = record[name];
      if (typeof value === "string" && value.trim()) {
        keys[name] = value.trim();
      }
    }
    return keys;
  } catch (error) {
    if (isMissingFile(error)) return {};
    throw error;
  }
}

export function resolveProviderApiKey(
  preferences: Partial<Record<ProviderKeyName, string | undefined>>,
  name: ProviderKeyName,
  local: LocalProviderKeys = loadLocalProviderKeys(),
): string | undefined {
  return preferences[name]?.trim() || local[name];
}

export function providerKeyNameForProvider(
  provider: EnhancementProvider,
): ProviderKeyName {
  if (provider === "anthropic") return "anthropicApiKey";
  if (provider === "google") return "googleApiKey";
  if (provider === "deepseek") return "deepseekApiKey";
  return "openaiApiKey";
}

export function resolveProviderApiKeyForProvider(
  preferences: Partial<Record<ProviderKeyName, string | undefined>>,
  provider: EnhancementProvider,
  local: LocalProviderKeys = loadLocalProviderKeys(),
): string | undefined {
  return resolveProviderApiKey(
    preferences,
    providerKeyNameForProvider(provider),
    local,
  );
}

export function localProviderKeyFromEnvironmentName(
  envName: string,
  local: LocalProviderKeys = loadLocalProviderKeys(),
): string | undefined {
  if (envName === "ANTHROPIC_API_KEY") return local.anthropicApiKey;
  if (envName === "GEMINI_API_KEY") return local.googleApiKey;
  if (envName === "DEEPSEEK_API_KEY") return local.deepseekApiKey;
  if (envName === "OPENAI_API_KEY") return local.openaiApiKey;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
