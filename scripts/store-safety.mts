const sourceCodeFile = /\.(?:[cm]?ts|tsx)$/;

const forbiddenCredentialMarkers = [
  {
    label: "OpenAI preference field",
    pattern: /openaiApiKey/,
    allowInSource: true,
  },
  {
    label: "OpenAI environment variable",
    pattern: /OPENAI_API_KEY/,
    allowInSource: true,
  },
  {
    label: "OpenAI-shaped secret",
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
    allowInSource: false,
  },
] as const;

export function assertStoreTextIsCredentialSafe(
  file: string,
  contents: string,
): void {
  const isSource = sourceCodeFile.test(file);
  for (const marker of forbiddenCredentialMarkers) {
    if (marker.allowInSource && isSource) continue;
    if (marker.pattern.test(contents)) {
      throw new Error(`${marker.label} is forbidden in Store file: ${file}`);
    }
  }
}
