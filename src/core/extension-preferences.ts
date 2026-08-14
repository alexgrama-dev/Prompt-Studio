import { getPreferenceValues } from "@raycast/api";

export interface PromptStudioPreferences {
  libraryDirectory?: string;
  qmdExecutable?: string;
  projectRoots?: string;
  sshProjectRoot?: string;
  defaultEnhancementProfile?: string;
  selfReviewPass?: boolean;
  variantCount?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  deepseekApiKey?: string;
  context7ApiKey?: string;
  exaApiKey?: string;
  githubToken?: string;
  researchContext7?: boolean;
  researchExa?: boolean;
  researchWeb?: boolean;
  researchGithub?: boolean;
}

export function getPromptStudioPreferences(): PromptStudioPreferences {
  return getPreferenceValues<PromptStudioPreferences>();
}
