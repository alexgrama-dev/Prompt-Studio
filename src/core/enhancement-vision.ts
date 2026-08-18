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

export const VISION_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type EnhancementVisionMimeType =
  (typeof VISION_IMAGE_MIME_TYPES)[number];

export const MAX_VISION_IMAGE_BYTES = 8_000_000;
export const VISION_IMAGE_TOKEN_ESTIMATE = 4_000;
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

export type EnhancementVisionSource =
  | { kind: "local-image"; filePath: string; label: string }
  | { kind: "remote-image"; url: string; label: string };

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

export function isSafeRemoteImageUrl(value: string): boolean {
  const safe = safeResearchSourceUrl(value);
  if (!safe) return false;
  try {
    return visionMimeForPath(new URL(safe).pathname) !== undefined;
  } catch {
    return false;
  }
}

export function visionInputSummary(
  vision: Pick<EnhancementVisionImage, "label" | "mimeType">,
): { kind: "image"; label: string; mimeType: string } {
  return {
    kind: "image",
    label: vision.label,
    mimeType: vision.mimeType,
  };
}

export function validateEnhancementVision(
  vision: EnhancementVisionImage,
): EnhancementVisionImage {
  const label = vision.label.trim();
  if (!label || label.length > 300) {
    throw new Error("The attached image needs a short filename label.");
  }
  if (label.includes("/") || label.includes("\\")) {
    throw new Error("The attached image label must be a filename, not a path.");
  }
  if (
    !(VISION_IMAGE_MIME_TYPES as readonly string[]).includes(vision.mimeType)
  ) {
    throw new Error(
      "Enhance can send PNG, JPEG, WebP, or GIF pixels. Export the image in one of those formats.",
    );
  }
  const bytes = decodeBase64Image(vision.base64);
  if (bytes.byteLength > MAX_VISION_IMAGE_BYTES) {
    throw new Error(
      `The attached image is larger than ${Math.floor(MAX_VISION_IMAGE_BYTES / 1_000_000)} MB.`,
    );
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
  if (source.kind === "local-image") {
    return readLocalVisionImage(source.filePath, source.label);
  }
  return fetchRemoteVisionImage(source.url, source.label, options);
}

export function openaiVisionContentPart(
  vision: EnhancementVisionImage,
): Record<string, unknown> {
  return {
    type: "input_image",
    detail: "high",
    image_url: `data:${vision.mimeType};base64,${vision.base64}`,
  };
}

export function anthropicVisionContentPart(
  vision: EnhancementVisionImage,
): Record<string, unknown> {
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

async function readLocalVisionImage(
  filePath: string,
  label: string,
): Promise<EnhancementVisionImage> {
  const mimeType = visionMimeForPath(filePath);
  if (!mimeType) {
    throw new Error(
      "Enhance can send PNG, JPEG, WebP, or GIF pixels. Export the image in one of those formats.",
    );
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    throw new Error(
      `The selected image is not readable: ${basename(filePath) || label}`,
    );
  }
  if (!info.isFile()) {
    throw new Error("Choose one image file.");
  }
  if (info.size > MAX_VISION_IMAGE_BYTES) {
    throw new Error(
      `The attached image is larger than ${Math.floor(MAX_VISION_IMAGE_BYTES / 1_000_000)} MB.`,
    );
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
  if (!mimeType) {
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

function decodeBase64Image(value: string): Uint8Array {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > Math.ceil((MAX_VISION_IMAGE_BYTES * 4) / 3) + 8
  ) {
    throw new Error(
      `The attached image is larger than ${Math.floor(MAX_VISION_IMAGE_BYTES / 1_000_000)} MB.`,
    );
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(trimmed) || trimmed.length % 4 !== 0) {
    throw new Error("The attached image is not valid base64.");
  }
  const bytes = Buffer.from(trimmed, "base64");
  if (bytes.byteLength === 0) {
    throw new Error("The attached image is empty.");
  }
  return bytes;
}
