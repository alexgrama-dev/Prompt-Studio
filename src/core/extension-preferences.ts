import { getPreferenceValues } from "@raycast/api";

export interface PromptStudioPreferences {
  libraryDirectory?: string;
  qmdExecutable?: string;
  projectRoots?: string;
  sshProjectRoot?: string;
}

export function getPromptStudioPreferences(): PromptStudioPreferences {
  return getPreferenceValues<PromptStudioPreferences>();
}
