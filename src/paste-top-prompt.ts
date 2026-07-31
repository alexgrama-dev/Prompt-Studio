import { Clipboard, LocalStorage, showHUD } from "@raycast/api";
import { pickAmbientPrompt } from "./core/ambient";
import { getPromptStudioPreferences } from "./core/extension-preferences";
import { extractPlaceholders } from "./core/placeholders";
import { listPrompts, resolvePromptDirectory } from "./core/prompt-store";
import { getFeatureStatus, loadFeatureStatuses } from "./core/features";
import { recordLastLibraryPaste } from "./core/last-library-paste";
import { loadPromptUsageEvidence, recordPromptUse } from "./core/search-index";

/**
 * Zero-keystroke paste: no list, no search. Pastes the prompt bound to the
 * repository in the first project root, or the most-used prompt otherwise.
 */
export default async function PasteTopPrompt() {
  const preferences = getPromptStudioPreferences();
  const directory = resolvePromptDirectory(preferences.libraryDirectory);
  const library = await listPrompts(directory);
  const { usage } = loadPromptUsageEvidence();
  const projectPath = preferences.projectRoots?.split(",")[0]?.trim();

  const pick = pickAmbientPrompt(library.records, {
    ...(projectPath ? { projectPath } : {}),
    usage: new Map(
      [...usage.entries()].map(([id, entry]) => [id, entry.useCount]),
    ),
  });
  if (!pick.record) {
    await showHUD(pick.reason);
    return;
  }
  // A prompt with unfilled placeholders would paste literal {{tokens}}, so it
  // is copied instead and the user is told why.
  if (extractPlaceholders(pick.record.body).length > 0) {
    await Clipboard.copy(pick.record.body);
    await showHUD(`Copied ${pick.record.title} — it has placeholders to fill`);
    return;
  }
  await Clipboard.paste(pick.record.body);
  try {
    recordPromptUse(pick.record.id);
  } catch {
    // ponytail: a missing index only loses ranking, never the paste.
  }
  try {
    await recordLastLibraryPaste(
      LocalStorage,
      getFeatureStatus(await loadFeatureStatuses(), "feedback").effectiveState,
      pick.record,
    );
  } catch {
    // ponytail: losing the rating pointer never undoes a successful paste.
  }
  await showHUD(`Pasted ${pick.record.title} — ${pick.reason}`);
}
