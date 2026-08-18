import { basename, extname } from "node:path";
import { appendUntrustedEvidence } from "./compiler-pipeline.ts";
import type { PromptTarget } from "./prompt-store.ts";
import { containsLikelySecret } from "./secrets.ts";

export const REVERSE_PROMPT_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".heic",
  ".tif",
  ".tiff",
  ".bmp",
] as const;

export const REVERSE_PROMPT_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".avi",
  ".mkv",
] as const;

export type ReversePromptSourceKind = "image" | "url" | "video";

export interface ReversePromptSource {
  kind: ReversePromptSourceKind;
  value: string;
  label: string;
}

export interface ReversePromptInput {
  filePath?: string;
  url?: string;
  fallbackText?: string;
}

export interface ReversePromptDraft {
  source: ReversePromptSource;
  notes?: string;
  target: PromptTarget;
}

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

export function classifyReversePromptInput(
  input: ReversePromptInput,
): ReversePromptSource {
  const filePath = input.filePath?.trim() ?? "";
  const url = input.url?.trim() ?? "";
  const fallback = input.fallbackText?.trim() ?? "";

  if (filePath && url) {
    throw new Error("Use either an image or video file, or a URL, not both.");
  }

  if (filePath) return classifyLocalMedia(filePath);
  if (url) return classifyUrl(url);
  if (fallback) {
    if (looksLikeHttpUrl(fallback)) return classifyUrl(fallback);
    if (looksLikeLocalMediaPath(fallback)) return classifyLocalMedia(fallback);
    throw new Error(
      "Selected text is not an http(s) URL or a local image or video file.",
    );
  }

  throw new Error("Choose one image, URL, or video.");
}

export function buildReversePromptThoughts(draft: ReversePromptDraft): string {
  const notes = draft.notes?.trim() ?? "";
  if (containsLikelySecret(draft.source.value) || containsLikelySecret(notes)) {
    throw new Error(
      "The source or notes appear to contain a secret. Remove it before continuing.",
    );
  }
  if (notes.length > 4_000) {
    throw new Error("Notes must be 4000 characters or fewer.");
  }

  const kindLabel = sourceKindLabel(draft.source.kind);
  const instruction = [
    `Write a reusable prompt that would produce this ${kindLabel}.`,
    "",
    `Source kind: ${draft.source.kind}`,
    `Source: ${draft.source.label}`,
    "",
    notes
      ? `Notes from the requester:\n${notes}`
      : "The requester did not describe the source contents. Do not invent visual, spoken, or page details that were not supplied.",
    "",
    "The resulting prompt should tell a coding agent how to recreate or implement what this source represents. Distinguish verified source facts from assumptions. If important contents were not supplied, list them as missing information instead of filling them in.",
  ].join("\n");

  if (draft.source.kind !== "url") return instruction;
  return appendUntrustedEvidence(instruction, draft.source.value, "argument");
}

export function reversePromptSourceFromFiles(
  files: readonly string[],
): string | undefined {
  if (files.length > 1) {
    throw new Error("Choose one image or video file.");
  }
  return files[0]?.trim() || undefined;
}

export function initialReversePromptFields(
  argument?: string,
  fallbackText?: string,
): { files: string[]; url: string } {
  const raw = argument?.trim() || fallbackText?.trim() || "";
  if (!raw) return { files: [], url: "" };
  try {
    const source = classifyReversePromptInput({ fallbackText: raw });
    return source.kind === "url"
      ? { files: [], url: source.value }
      : { files: [source.value], url: "" };
  } catch {
    return { files: [], url: raw.startsWith("http") ? raw : "" };
  }
}

function classifyLocalMedia(filePath: string): ReversePromptSource {
  const extension = extname(filePath).toLowerCase();
  const kind = mediaKindForExtension(extension);
  if (!kind) {
    throw new Error(
      "Choose an image (png, jpg, webp, gif, heic) or a video (mp4, mov, webm).",
    );
  }
  const name = basename(filePath);
  if (!name) throw new Error("Choose one image or video file.");
  return { kind, value: filePath, label: name };
}

function classifyUrl(value: string): ReversePromptSource {
  if (!looksLikeHttpUrl(value)) {
    throw new Error("Enter an http or https URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter an http or https URL.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Remove credentials from the URL before continuing.");
  }
  if (containsLikelySecret(value)) {
    throw new Error(
      "The URL appears to contain a secret. Remove it before continuing.",
    );
  }
  return {
    kind: "url",
    value,
    label: parsed.host + parsed.pathname.replace(/\/$/, ""),
  };
}

function mediaKindForExtension(
  extension: string,
): Exclude<ReversePromptSourceKind, "url"> | undefined {
  if (
    (REVERSE_PROMPT_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return "image";
  }
  if (
    (REVERSE_PROMPT_VIDEO_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return "video";
  }
  return undefined;
}

function looksLikeHttpUrl(value: string): boolean {
  return HTTP_URL.test(value);
}

function looksLikeLocalMediaPath(value: string): boolean {
  return mediaKindForExtension(extname(value).toLowerCase()) !== undefined;
}

function sourceKindLabel(kind: ReversePromptSourceKind): string {
  if (kind === "url") return "URL";
  return kind;
}
