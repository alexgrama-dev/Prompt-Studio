import { createElement, type ComponentType, type ReactNode } from "react";
import type {
  EnhancePromptLaunchContext,
  IdeaStudioLaunchContext,
} from "./core/launch-context";

export const STUDIO_SCREENS_AVAILABLE = true;
export const CAPTURE_INBOX_AVAILABLE = true;
export const REVERSE_PROMPT_AVAILABLE = true;

export interface EnhancePromptViewProps {
  arguments?: { thoughts?: string };
  fallbackText?: string;
  launchContext?: EnhancePromptLaunchContext;
}

export interface CaptureInboxViewProps {
  arguments?: { idea?: string };
  fallbackText?: string;
  launchContext?: IdeaStudioLaunchContext;
}

export interface ReversePromptViewProps {
  arguments?: { source?: string };
  fallbackText?: string;
}

export async function pushEnhancePrompt(
  push: (node: ReactNode) => void,
  props: EnhancePromptViewProps = {},
): Promise<void> {
  const { default: EnhancePrompt } = await import("./enhance-prompt");
  push(
    createElement(EnhancePrompt as ComponentType<EnhancePromptViewProps>, props),
  );
}

export async function pushCaptureInbox(
  push: (node: ReactNode) => void,
  props: CaptureInboxViewProps = {},
): Promise<void> {
  const { default: IdeaStudio } = await import("./idea-studio");
  push(
    createElement(IdeaStudio as ComponentType<CaptureInboxViewProps>, props),
  );
}

export async function pushReversePrompt(
  push: (node: ReactNode) => void,
  props: ReversePromptViewProps = {},
): Promise<void> {
  const { default: ReversePrompt } = await import("./reverse-prompt");
  push(
    createElement(
      ReversePrompt as ComponentType<ReversePromptViewProps>,
      props,
    ),
  );
}
