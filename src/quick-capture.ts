import {
  Clipboard,
  getSelectedText,
  showHUD,
} from "@raycast/api";
import {
  captureTextFromSources,
  captureTitleFromText,
} from "./core/capture-queue";
import { getPromptStudioPreferences } from "./core/extension-preferences";
import {
  listPrompts,
  promptSeedDirectory,
  recordPromptSeed,
  resolvePromptDirectory,
} from "./core/prompt-store";

export default async function QuickCapture() {
  let selected: string | undefined;
  let clipboard: string | undefined;
  try {
    selected = await getSelectedText();
  } catch {
    selected = undefined;
  }
  if (!selected?.trim()) clipboard = await Clipboard.readText();
  const text = captureTextFromSources(selected, clipboard);
  if (!text) {
    await showHUD("Select or copy text first");
    return;
  }

  try {
    const directory = resolvePromptDirectory(
      getPromptStudioPreferences().libraryDirectory,
    );
    const existing = await listPrompts(promptSeedDirectory(directory));
    const record = await recordPromptSeed(directory, {
      title: captureTitleFromText(text),
      body: text,
      target: "generic",
      capture: { kind: "next-prompt" },
    });
    const reused = existing.records.some((item) => item.id === record.id);
    await showHUD(
      reused ? "Next Prompt already captured" : "Next Prompt captured",
    );
  } catch (error) {
    await showHUD(
      `Could not capture item: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
