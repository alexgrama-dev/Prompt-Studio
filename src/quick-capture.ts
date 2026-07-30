import {
  Clipboard,
  getSelectedText,
  showHUD,
} from "@raycast/api";
import {
  captureKindTitle,
  captureTextFromSources,
  captureTitleFromText,
} from "./core/capture-queue";
import { getPromptStudioPreferences } from "./core/extension-preferences";
import {
  listPrompts,
  PROMPT_CAPTURE_KINDS,
  promptSeedDirectory,
  recordPromptSeed,
  resolvePromptDirectory,
  type PromptCaptureKind,
} from "./core/prompt-store";

export default async function QuickCapture(props: {
  arguments?: { text?: string; kind?: string };
}) {
  const explicit = props.arguments?.text;
  let selected: string | undefined;
  let clipboard: string | undefined;
  if (!explicit?.trim()) {
    try {
      selected = await getSelectedText();
    } catch {
      selected = undefined;
    }
    if (!selected?.trim()) clipboard = await Clipboard.readText();
  }
  const text = captureTextFromSources(explicit, selected, clipboard);
  if (!text) {
    await showHUD("Enter, select, or copy text first");
    return;
  }

  const requestedKind = props.arguments?.kind;
  const kind: PromptCaptureKind = PROMPT_CAPTURE_KINDS.includes(
    requestedKind as PromptCaptureKind,
  )
    ? (requestedKind as PromptCaptureKind)
    : "next-prompt";

  try {
    const directory = resolvePromptDirectory(
      getPromptStudioPreferences().libraryDirectory,
    );
    const existing = await listPrompts(promptSeedDirectory(directory));
    const record = await recordPromptSeed(directory, {
      title: captureTitleFromText(text),
      body: text,
      target: "generic",
      capture: { kind },
    });
    const reused = existing.records.some((item) => item.id === record.id);
    await showHUD(
      reused
        ? `${captureKindTitle(kind)} already captured`
        : `${captureKindTitle(kind)} captured`,
    );
  } catch (error) {
    await showHUD(
      `Could not capture item: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
