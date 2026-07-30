import type { PromptCaptureKind } from "./prompt-store.ts";

export function captureTextFromSources(
  selected?: string,
  clipboard?: string,
): string | undefined {
  return [selected, clipboard].find((value) => value?.trim());
}

export function captureTitleFromText(text: string): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  let length = 0;
  let clipped = "";
  for (const character of compact) {
    if (length < 77) clipped += character;
    length += 1;
    if (length > 80) break;
  }
  if (length <= 80) return compact;
  clipped = clipped.trimEnd();
  return `${clipped.replace(/\s+\S*$/u, "") || clipped}…`;
}

export function captureKindTitle(kind: PromptCaptureKind): string {
  if (kind === "next-prompt") return "Next Prompt";
  if (kind === "keep") return "Keep";
  return "Idea";
}
