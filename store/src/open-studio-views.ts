import { createElement, type ComponentType, type ReactNode } from "react";
import type { EnhancePromptLaunchContext } from "./core/launch-context";

export const STUDIO_SCREENS_AVAILABLE = true;
export const CAPTURE_INBOX_AVAILABLE = false;

export interface EnhancePromptViewProps {
  arguments?: { thoughts?: string };
  fallbackText?: string;
  launchContext?: EnhancePromptLaunchContext;
}

export interface CaptureInboxViewProps {
  arguments?: { idea?: string };
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
  _push: (node: ReactNode) => void,
  _props: CaptureInboxViewProps = {},
): Promise<void> {
  void _push;
  void _props;
}
