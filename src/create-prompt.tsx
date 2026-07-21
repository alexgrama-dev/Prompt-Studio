import { getPreferenceValues, showHUD } from "@raycast/api";
import { createPrompt, resolvePromptDirectory } from "./core/prompt-store";
import { commaSeparated, PromptForm } from "./prompt-form";

interface Preferences {
  libraryDirectory?: string;
}

export default function CreatePrompt() {
  const preferences = getPreferenceValues<Preferences>();

  return (
    <PromptForm
      navigationTitle="Save Existing Prompt"
      submitTitle="Save Unchanged"
      onSubmit={async (values) => {
        await createPrompt(
          resolvePromptDirectory(preferences.libraryDirectory),
          {
            title: values.title,
            summary: values.summary,
            body: values.body,
            target: values.target,
            tags: commaSeparated(values.tags),
            aliases: commaSeparated(values.aliases),
            searchTerms: commaSeparated(values.searchTerms),
          },
        );
        await showHUD("Prompt saved unchanged");
      }}
    />
  );
}
