import { accessSync, constants, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { appendUntrustedEvidence } from "./compiler-pipeline.ts";
import {
  isSafeRemoteImageUrl,
  visionMimeForPath,
  type EnhancementVisionSource,
} from "./enhancement-vision.ts";
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
  const vision = reversePromptVisionSource(draft.source);
  const instruction = [
    `Write a reusable prompt that would produce this ${kindLabel}.`,
    "",
    `Source kind: ${draft.source.kind}`,
    `Source label: ${draft.source.label}`,
    "",
    visionEvidenceInstruction(draft.source, vision),
    "",
    notes
      ? `Notes from the requester:\n${notes}`
      : vision
        ? "The requester did not add notes. Use the attached image pixels, not the filename, as the visual source of truth."
        : "The requester did not describe the source contents. Do not invent visual, spoken, or page details that were not supplied.",
    "",
    "The resulting prompt should tell a coding agent how to recreate or implement what this source represents. Describe visible UI from supplied pixels when an image is attached. Do not tell the next agent to open a local file path. Do not copy Prompt Studio execution-guardrail wrappers or secret-handling boilerplate into the prompt body; those are added separately. Distinguish verified source facts from assumptions. If important contents were not supplied, list them as missing information instead of filling them in.",
  ].join("\n");

  if (draft.source.kind !== "url") return instruction;
  return appendUntrustedEvidence(instruction, draft.source.value, "argument");
}

export function reversePromptVisionSource(
  source: ReversePromptSource,
): EnhancementVisionSource | undefined {
  if (source.kind === "image" && visionMimeForPath(source.value)) {
    return {
      kind: "local-image",
      filePath: source.value,
      label: source.label,
    };
  }
  if (source.kind === "url" && isSafeRemoteImageUrl(source.value)) {
    return { kind: "remote-image", url: source.value, label: source.label };
  }
  return undefined;
}

export function reversePromptSourceFromFiles(
  files: readonly string[],
): string | undefined {
  if (files.length > 1) {
    throw new Error("Choose one image or video file.");
  }
  return files[0]?.trim() || undefined;
}

export function reversePromptFormSource(input: {
  files: readonly string[];
  url: string;
}): ReversePromptInput {
  const filePath = reversePromptSourceFromFiles(input.files);
  const url = input.url.trim();
  return {
    ...(filePath ? { filePath } : {}),
    ...(url ? { url } : {}),
  };
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

export function assertReadableRegularFile(filePath: string): void {
  let info;
  try {
    accessSync(filePath, constants.R_OK);
    info = statSync(filePath);
  } catch {
    throw new Error(
      `The selected file is not readable: ${basename(filePath) || filePath}`,
    );
  }
  if (!info.isFile()) {
    throw new Error("Choose one image or video file.");
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
  assertReadableRegularFile(filePath);
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

function visionEvidenceInstruction(
  source: ReversePromptSource,
  vision: EnhancementVisionSource | undefined,
): string {
  if (vision?.kind === "local-image") {
    return "An image is attached as vision input. The pixels are the visual source of truth: describe layout, verbatim text, components, and styling from what is visible. Do not treat the filename as the contents.";
  }
  if (vision?.kind === "remote-image") {
    return "This https image URL will be fetched after cost and privacy review and attached as vision input. Describe the visible image from those pixels. Do not invent contents from the URL text.";
  }
  if (source.kind === "image") {
    return "This local image format cannot be sent as vision input. Export it as PNG, JPEG, WebP, or GIF. Do not invent visual details from the filename, and do not tell the next agent to open the local path.";
  }
  if (source.kind === "video") {
    return "The current enhancement providers cannot accept video bytes. Do not invent visual or spoken details from the filename, and do not tell the next agent to open the local path.";
  }
  return "The page at this URL was not fetched. Do not invent page contents from the address. If the URL is a public https image (png, jpg, webp, gif), Reverse Prompt can fetch those pixels after review.";
}
