const forbiddenCredentialMarkers = [
  { label: "OpenAI preference field", pattern: /openaiApiKey/ },
  { label: "OpenAI environment variable", pattern: /OPENAI_API_KEY/ },
  {
    label: "OpenAI-shaped secret",
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  },
] as const;

export function assertStoreTextIsCredentialSafe(
  file: string,
  contents: string,
): void {
  for (const marker of forbiddenCredentialMarkers) {
    if (marker.pattern.test(contents)) {
      throw new Error(`${marker.label} is forbidden in Store file: ${file}`);
    }
  }
}
