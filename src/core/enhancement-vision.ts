import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { safeResearchSourceUrl } from "./research-safety.ts";

export const VISION_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
] as const;

export const VISION_VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".avi",
  ".mkv",
] as const;

export const VISION_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const VISION_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/avi",
  "video/x-matroska",
] as const;

export type EnhancementVisionImageMimeType =
  (typeof VISION_IMAGE_MIME_TYPES)[number];
export type EnhancementVisionVideoMimeType =
  (typeof VISION_VIDEO_MIME_TYPES)[number];
export type EnhancementVisionMimeType =
  | EnhancementVisionImageMimeType
  | EnhancementVisionVideoMimeType;
export type EnhancementVisionKind = "image" | "video";
export type EnhancementVisionProvider = "openai" | "anthropic" | "google";

export const MAX_VISION_IMAGE_BYTES = 8_000_000;
export const MAX_VISION_VIDEO_BYTES = 20_000_000;
export const VISION_IMAGE_TOKEN_ESTIMATE = 4_000;
/** Conservative 60s allowance at Google's documented 263 tokens/second. */
export const VISION_VIDEO_TOKEN_ESTIMATE = 16_000;
export const VISION_FETCH_TIMEOUT_MS = 15_000;

export const VISION_COMPILER_ADDENDUM = `
An image is attached as vision input. The pixels are the visual source of truth.
Describe the visible UI, layout, verbatim text, components, and styling from that
image. Do not treat a filename, path, or URL as a substitute for the pixels.
Do not tell the next agent to open a local file path.
Do not copy Prompt Studio execution-guardrail wrappers, compiler contract
language, or secret-handling boilerplate into the enhancedPrompt body. Those
wrappers are added separately after compilation.
`.trim();

export const VISION_VIDEO_COMPILER_ADDENDUM = `
A video is attached as vision input. The frames and audible speech are the visual
source of truth. Describe visible UI, motion, verbatim on-screen text, and spoken
words from that video. Do not treat a filename, path, or URL as a substitute for
the media. Do not tell the next agent to open a local file path.
Do not copy Prompt Studio execution-guardrail wrappers, compiler contract
language, or secret-handling boilerplate into the enhancedPrompt body. Those
wrappers are added separately after compilation.
`.trim();

export type EnhancementVisionSource =
  | { kind: "local-image"; filePath: string; label: string }
  | { kind: "remote-image"; url: string; label: string }
  | { kind: "local-video"; filePath: string; label: string };

export interface EnhancementVisionImage {
  mimeType: EnhancementVisionMimeType;
  label: string;
  base64: string;
}

const MIME_BY_EXTENSION: Readonly<Record<string, EnhancementVisionMimeType>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/avi",
  ".mkv": "video/x-matroska",
};

const MIME_BY_CONTENT_TYPE: Readonly<
  Record<string, EnhancementVisionMimeType>
> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

export function visionMimeForPath(
  filePath: string,
): EnhancementVisionMimeType | undefined {
  return MIME_BY_EXTENSION[extname(filePath).toLowerCase()];
}

export function visionMediaKind(
  vision: Pick<EnhancementVisionImage, "mimeType"> | EnhancementVisionSource,
): EnhancementVisionKind {
  if ("kind" in vision) {
    return vision.kind === "local-video" ? "video" : "image";
  }
  return (VISION_VIDEO_MIME_TYPES as readonly string[]).includes(
    vision.mimeType,
  )
    ? "video"
    : "image";
}

export function providerAcceptsVision(
  provider: EnhancementVisionProvider,
  vision: Pick<EnhancementVisionImage, "mimeType"> | EnhancementVisionSource,
): boolean {
  return visionMediaKind(vision) === "image" || provider === "google";
}

export function assertProviderAcceptsVision(
  provider: EnhancementVisionProvider,
  vision: Pick<EnhancementVisionImage, "mimeType"> | EnhancementVisionSource,
): void {
  if (providerAcceptsVision(provider, vision)) return;
  throw new Error(
    "OpenAI and Anthropic cannot accept video. Choose Google Gemini, or export a screenshot instead. The video was not dropped silently.",
  );
}

export function visionTokenEstimate(
  vision: Pick<EnhancementVisionImage, "mimeType"> | EnhancementVisionSource,
): number {
  return visionMediaKind(vision) === "video"
    ? VISION_VIDEO_TOKEN_ESTIMATE
    : VISION_IMAGE_TOKEN_ESTIMATE;
}

export function visionCompilerAddendum(
  vision: Pick<EnhancementVisionImage, "mimeType"> | EnhancementVisionSource,
): string {
  return visionMediaKind(vision) === "video"
    ? VISION_VIDEO_COMPILER_ADDENDUM
    : VISION_COMPILER_ADDENDUM;
}

export function placeholderVisionForSource(
  source: EnhancementVisionSource,
): EnhancementVisionImage {
  return {
    mimeType: source.kind === "local-video" ? "video/mp4" : "image/png",
    label: source.label,
    base64: "AA==",
  };
}

export function isSafeRemoteImageUrl(value: string): boolean {
  const safe = safeResearchSourceUrl(value);
  if (!safe) return false;
  try {
    const mime = visionMimeForPath(new URL(safe).pathname);
    return (
      mime !== undefined && visionMediaKind({ mimeType: mime }) === "image"
    );
  } catch {
    return false;
  }
}

export function visionInputSummary(
  vision: Pick<EnhancementVisionImage, "label" | "mimeType">,
): { kind: EnhancementVisionKind; label: string; mimeType: string } {
  return {
    kind: visionMediaKind(vision),
    label: vision.label,
    mimeType: vision.mimeType,
  };
}

export function validateEnhancementVision(
  vision: EnhancementVisionImage,
): EnhancementVisionImage {
  const kind = visionMediaKind(vision);
  const label = vision.label.trim();
  if (!label || label.length > 300) {
    throw new Error(
      kind === "video"
        ? "The attached video needs a short filename label."
        : "The attached image needs a short filename label.",
    );
  }
  if (label.includes("/") || label.includes("\\")) {
    throw new Error(
      kind === "video"
        ? "The attached video label must be a filename, not a path."
        : "The attached image label must be a filename, not a path.",
    );
  }
  const allowed =
    kind === "video" ? VISION_VIDEO_MIME_TYPES : VISION_IMAGE_MIME_TYPES;
  if (!(allowed as readonly string[]).includes(vision.mimeType)) {
    throw new Error(
      kind === "video"
        ? "Enhance can send MP4, MOV, M4V, WebM, AVI, or MKV video. Export the clip in one of those formats."
        : "Enhance can send PNG, JPEG, WebP, or GIF pixels. Export the image in one of those formats.",
    );
  }
  const maxBytes =
    kind === "video" ? MAX_VISION_VIDEO_BYTES : MAX_VISION_IMAGE_BYTES;
  const bytes = decodeBase64Media(vision.base64, kind, maxBytes);
  if (bytes.byteLength > maxBytes) {
    throw new Error(mediaTooLargeMessage(kind, maxBytes));
  }
  return {
    mimeType: vision.mimeType,
    label,
    base64: Buffer.from(bytes).toString("base64"),
  };
}

export async function resolveEnhancementVision(
  source: EnhancementVisionSource,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<EnhancementVisionImage> {
  if (source.kind === "local-image" || source.kind === "local-video") {
    return readLocalVisionMedia(source.filePath, source.label, source.kind);
  }
  return fetchRemoteVisionImage(source.url, source.label, options);
}

export function openaiVisionContentPart(
  vision: EnhancementVisionImage,
): Record<string, unknown> {
  assertProviderAcceptsVision("openai", vision);
  return {
    type: "input_image",
    detail: "high",
    image_url: `data:${vision.mimeType};base64,${vision.base64}`,
  };
}

export function anthropicVisionContentPart(
  vision: EnhancementVisionImage,
): Record<string, unknown> {
  assertProviderAcceptsVision("anthropic", vision);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: vision.mimeType,
      data: vision.base64,
    },
  };
}

export function googleVisionContentPart(
  vision: EnhancementVisionImage,
): Record<string, unknown> {
  return {
    inline_data: {
      mime_type: vision.mimeType,
      data: vision.base64,
    },
  };
}

async function readLocalVisionMedia(
  filePath: string,
  label: string,
  expectedKind: "local-image" | "local-video",
): Promise<EnhancementVisionImage> {
  const kind = expectedKind === "local-video" ? "video" : "image";
  const mimeType = visionMimeForPath(filePath);
  if (!mimeType || visionMediaKind({ mimeType }) !== kind) {
    throw new Error(
      kind === "video"
        ? "Enhance can send MP4, MOV, M4V, WebM, AVI, or MKV video. Export the clip in one of those formats."
        : "Enhance can send PNG, JPEG, WebP, or GIF pixels. Export the image in one of those formats.",
    );
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    throw new Error(
      `The selected ${kind} is not readable: ${basename(filePath) || label}`,
    );
  }
  if (!info.isFile()) {
    throw new Error(
      kind === "video" ? "Choose one video file." : "Choose one image file.",
    );
  }
  const maxBytes =
    kind === "video" ? MAX_VISION_VIDEO_BYTES : MAX_VISION_IMAGE_BYTES;
  if (info.size > maxBytes) {
    throw new Error(mediaTooLargeMessage(kind, maxBytes));
  }
  const bytes = await readFile(filePath);
  return validateEnhancementVision({
    mimeType,
    label: label || basename(filePath),
    base64: bytes.toString("base64"),
  });
}

async function fetchRemoteVisionImage(
  url: string,
  label: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal },
): Promise<EnhancementVisionImage> {
  const safeUrl = safeResearchSourceUrl(url);
  if (!safeUrl || !isSafeRemoteImageUrl(safeUrl)) {
    throw new Error(
      "Only a public https image URL can be fetched as vision input.",
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error("Image fetch timed out.")),
    VISION_FETCH_TIMEOUT_MS,
  );
  let response: Response;
  try {
    response = await fetcher(safeUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: VISION_IMAGE_MIME_TYPES.join(",") },
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new Error("Enhancement cancelled. No prompt was saved.");
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : "The image URL could not be fetched.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `The image URL returned HTTP ${response.status} and was not sent to the model.`,
    );
  }
  const finalUrl = safeResearchSourceUrl(response.url || safeUrl);
  if (!finalUrl || !isSafeRemoteImageUrl(finalUrl)) {
    await response.body?.cancel();
    throw new Error(
      "The image URL redirected to an address that cannot be fetched safely.",
    );
  }
  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  const mimeType =
    (contentType ? MIME_BY_CONTENT_TYPE[contentType] : undefined) ??
    visionMimeForPath(new URL(finalUrl).pathname);
  if (!mimeType || visionMediaKind({ mimeType }) !== "image") {
    await response.body?.cancel();
    throw new Error(
      "The URL did not return a PNG, JPEG, WebP, or GIF. The page was not sent.",
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_VISION_IMAGE_BYTES) {
    throw new Error(
      `The attached image is larger than ${Math.floor(MAX_VISION_IMAGE_BYTES / 1_000_000)} MB.`,
    );
  }
  return validateEnhancementVision({
    mimeType,
    label: label || basename(new URL(finalUrl).pathname) || "image",
    base64: bytes.toString("base64"),
  });
}

function decodeBase64Media(
  value: string,
  kind: EnhancementVisionKind,
  maxBytes: number,
): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > Math.ceil((maxBytes * 4) / 3) + 8) {
    throw new Error(mediaTooLargeMessage(kind, maxBytes));
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed) || trimmed.length % 4 !== 0) {
    throw new Error(
      kind === "video"
        ? "The attached video is not valid base64."
        : "The attached image is not valid base64.",
    );
  }
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.byteLength === 0) {
    throw new Error(
      kind === "video"
        ? "The attached video is empty."
        : "The attached image is empty.",
    );
  }
  return bytes;
}

function mediaTooLargeMessage(
  kind: EnhancementVisionKind,
  maxBytes: number,
): string {
  return `The attached ${kind} is larger than ${Math.floor(maxBytes / 1_000_000)} MB.`;
}
