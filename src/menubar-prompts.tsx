import {
  Clipboard,
  getPreferenceValues,
  Icon,
  launchCommand,
  LaunchType,
  LocalStorage,
  MenuBarExtra,
  showHUD,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import {
  listPromptVersions,
  listPrompts,
  resolvePromptDirectory,
  type PromptRecord,
} from "./core/prompt-store";
import {
  createPromptUseFeedback,
  listPromptUseFeedback,
} from "./core/feedback-store";
import { extractPlaceholders } from "./core/placeholders";
import { browsePromptsLaunchContext } from "./core/launch-context";
import {
  clearLastLibraryPaste,
  completeLastPasteRating,
  lastLibraryPasteWasRated,
  loadLastLibraryPaste,
  quickRatingEnabled,
  resolveLastLibraryPaste,
  type LastLibraryPastePointer,
} from "./core/last-library-paste";
import {
  getFeatureStatus,
  loadFeatureStatuses,
  type FeatureState,
} from "./core/features";
import {
  loadPromptUsage,
  rankRecordsByUsage,
  recordPromptUse,
} from "./core/search-index";

const MENU_LIMIT = 5;

interface LastPaste {
  pointer: LastLibraryPastePointer;
  prompt: PromptRecord;
}

export default function MenubarPrompts() {
  const preferences = getPreferenceValues<Preferences.MenubarPrompts>();
  const [records, setRecords] = useState<PromptRecord[]>();
  const [error, setError] = useState<string>();
  const [feedbackState, setFeedbackState] =
    useState<FeatureState>("disabled");
  const [lastPaste, setLastPaste] = useState<LastPaste>();
  const [lastPasteStatus, setLastPasteStatus] = useState<
    "none" | "rated" | "unavailable"
  >("none");
  const ratingInFlight = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        const directory = resolvePromptDirectory(preferences.libraryDirectory);
        const [library, statuses] = await Promise.all([
          listPrompts(directory),
          loadFeatureStatuses(),
        ]);
        const active = library.records.filter((record) => !record.archivedAt);
        setRecords(
          rankRecordsByUsage(active, loadPromptUsage()).slice(0, MENU_LIMIT),
        );
        const state = getFeatureStatus(statuses, "feedback").effectiveState;
        setFeedbackState(state);
        if (!quickRatingEnabled(state)) return;
        const pointer = await loadLastLibraryPaste(raycastStorage, state);
        if (!pointer) {
          setLastPasteStatus("none");
          return;
        }
        const current = library.records.find(
          (record) => record.id === pointer.promptId,
        );
        const versions = await listPromptVersions(directory, pointer.promptId);
        const prompt = resolveLastLibraryPaste(pointer, [
          ...(current ? [current] : []),
          ...versions,
        ]);
        if (!prompt) {
          setLastPasteStatus("unavailable");
          return;
        }
        const feedback = await listPromptUseFeedback(
          directory,
          pointer.promptId,
        );
        if (lastLibraryPasteWasRated(pointer, feedback.records)) {
          await clearLastLibraryPaste(raycastStorage, state);
          setLastPasteStatus("rated");
          return;
        }
        setLastPaste({ pointer, prompt });
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      }
    })();
  }, [preferences.libraryDirectory]);

  async function rateLastPrompt(verdict: "useful" | "not-useful") {
    if (!lastPaste || ratingInFlight.current) return;
    let directory: string;
    try {
      directory = resolvePromptDirectory(preferences.libraryDirectory);
    } catch {
      await showHUD("Prompt Library Unavailable");
      return;
    }
    ratingInFlight.current = true;
    const result = await completeLastPasteRating(
      async () => {
        const feedback = await listPromptUseFeedback(
          directory,
          lastPaste.prompt.id,
        );
        if (lastLibraryPasteWasRated(lastPaste.pointer, feedback.records)) {
          return;
        }
        await createPromptUseFeedback(directory, {
          prompt: lastPaste.prompt,
          usedAt: lastPaste.pointer.pastedAt,
          targetAgent: lastPaste.prompt.target,
          verdict,
        });
      },
      () => clearLastLibraryPaste(raycastStorage, feedbackState),
    );
    ratingInFlight.current = false;
    if (result === "failed") {
      await showHUD("Rating Not Saved — Retry from Prompt Library");
      return;
    }
    setLastPaste(undefined);
    setLastPasteStatus("rated");
    await showHUD(
      verdict === "useful" ? "Marked Useful" : "Marked Not Useful",
    );
  }

  return (
    <MenuBarExtra
      icon={Icon.TextDocument}
      tooltip="Frequent Prompts Menu"
      isLoading={records === undefined && error === undefined}
    >
      {error ? (
        <MenuBarExtra.Item
          title="Prompt Library Unavailable"
          subtitle={error}
        />
      ) : records && records.length === 0 ? (
        <MenuBarExtra.Item title="No Prompts Saved Yet" />
      ) : (
        <>
          {quickRatingEnabled(feedbackState) ? (
            <MenuBarExtra.Section title="Rate Last Prompt">
              {lastPaste ? (
                <>
                  <MenuBarExtra.Item
                    title={lastPaste.prompt.title}
                    subtitle={`Version ${new Date(lastPaste.prompt.updatedAt).toLocaleString()}`}
                  />
                  <MenuBarExtra.Item
                    title="Useful"
                    icon={Icon.CheckCircle}
                    shortcut={{ modifiers: ["cmd"], key: "u" }}
                    onAction={() => rateLastPrompt("useful")}
                  />
                  <MenuBarExtra.Item
                    title="Not Useful"
                    icon={Icon.XMarkCircle}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
                    onAction={() => rateLastPrompt("not-useful")}
                  />
                </>
              ) : (
                <>
                  <MenuBarExtra.Item
                    title={
                      lastPasteStatus === "rated"
                        ? "Last Paste Already Rated"
                        : lastPasteStatus === "unavailable"
                          ? "Last Paste Version Unavailable"
                          : "No Unrated Library Paste"
                    }
                    subtitle="Paste a library prompt to rate it here"
                  />
                  <MenuBarExtra.Item
                    title="Open Prompt Library"
                    icon={Icon.TextDocument}
                    shortcut={{ modifiers: ["cmd"], key: "b" }}
                    onAction={() =>
                      launchCommand({
                        name: "browse-prompts",
                        type: LaunchType.UserInitiated,
                      })
                    }
                  />
                </>
              )}
            </MenuBarExtra.Section>
          ) : null}
          <MenuBarExtra.Section title="Frequent Prompts">
            {(records ?? []).map((record) => (
              <MenuBarExtra.Item
                key={record.id}
                title={record.title}
                onAction={async () => {
                  if (extractPlaceholders(record.body).length > 0) {
                    await launchCommand({
                      name: "browse-prompts",
                      type: LaunchType.UserInitiated,
                      context: browsePromptsLaunchContext(record.id),
                    });
                    await showHUD("Open the prompt to fill its placeholders");
                    return;
                  }
                  await Clipboard.copy(record.body);
                  try {
                    recordPromptUse(record.id);
                  } catch {
                    // ponytail: a missing index only loses ranking, never the copy.
                  }
                  await showHUD("Prompt Copied");
                }}
              />
            ))}
          </MenuBarExtra.Section>
        </>
      )}
    </MenuBarExtra>
  );
}

const raycastStorage = {
  async getItem(key: string) {
    return await LocalStorage.getItem<string>(key);
  },
  async setItem(key: string, value: string) {
    await LocalStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await LocalStorage.removeItem(key);
  },
};
