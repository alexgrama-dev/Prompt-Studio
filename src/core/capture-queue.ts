import type { PromptCaptureKind } from "./prompt-store.ts";

export function captureTextFromSources(
  explicit?: string,
  selected?: string,
  clipboard?: string,
): string | undefined {
  return [explicit, selected, clipboard].find((value) => value?.trim());
}

export function captureTitleFromText(text: string): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length <= 80) return compact;
  const clipped = compact.slice(0, 77).trimEnd();
  return `${clipped.replace(/\s+\S*$/u, "") || clipped}…`;
}

export function captureKindTitle(kind: PromptCaptureKind): string {
  if (kind === "next-prompt") return "Next Prompt";
  if (kind === "keep") return "Keep";
  return "Idea";
}
