import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAnthropicMessageRequest } from "../src/core/anthropic-enhancement.ts";
import {
  buildOpenAIResponseRequest,
  enhancementCompilerInput,
  enhancementCompilerInstructions,
  estimatedMaximumCostForProfileUsd,
  getEnhancementProfile,
  validateEnhancementRequest,
  type EnhancementRequest,
} from "../src/core/enhancement.ts";
import {
  anthropicVisionContentPart,
  assertProviderAcceptsVision,
  isSafeRemoteImageUrl,
  openaiVisionContentPart,
  resolveEnhancementVision,
  validateEnhancementVision,
  VISION_COMPILER_ADDENDUM,
  VISION_VIDEO_COMPILER_ADDENDUM,
} from "../src/core/enhancement-vision.ts";
import { buildGoogleGenerateContentRequest } from "../src/core/google-enhancement.ts";
import { getProviderEnhancementProfile } from "../src/core/provider-profiles.ts";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function visionImage() {
  return {
    mimeType: "image/png" as const,
    label: "01-screen.png",
    base64: PNG_1X1.toString("base64"),
  };
}

function requestWithVision(): EnhancementRequest {
  return {
    roughThoughts:
      "Write a reusable prompt that would produce this image.\n\nAn image is attached as vision input.",
    target: "codex",
    profileId: "openai-standard-v1",
    researchLevel: "none",
    vision: visionImage(),
  };
}

test("local PNG pixels become validated vision input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-vision-"));
  const filePath = join(directory, "01-screen.png");
  await writeFile(filePath, PNG_1X1);

  const vision = await resolveEnhancementVision({
    kind: "local-image",
    filePath,
    label: "01-screen.png",
  });
  assert.equal(vision.mimeType, "image/png");
  assert.equal(vision.label, "01-screen.png");
  assert.equal(Buffer.from(vision.base64, "base64").equals(PNG_1X1), true);
  assert.deepEqual(validateEnhancementVision(vision), vision);
});

test("unsupported or unsafe image sources are rejected before the model call", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-vision-"));
  const heic = join(directory, "shot.heic");
  await writeFile(heic, "not-an-image");
  await assert.rejects(
    resolveEnhancementVision({
      kind: "local-image",
      filePath: heic,
      label: "shot.heic",
    }),
    /PNG, JPEG, WebP, or GIF/,
  );
  await assert.rejects(
    resolveEnhancementVision({
      kind: "local-image",
      filePath: join(directory, "missing.png"),
      label: "missing.png",
    }),
    /not readable/,
  );
  assert.equal(isSafeRemoteImageUrl("http://example.com/ui.png"), false);
  assert.equal(isSafeRemoteImageUrl("https://127.0.0.1/ui.png"), false);
  assert.equal(isSafeRemoteImageUrl("https://example.com/docs"), false);
  assert.equal(isSafeRemoteImageUrl("https://cdn.example.com/login.png"), true);
  await assert.rejects(
    resolveEnhancementVision({
      kind: "remote-image",
      url: "https://127.0.0.1/login.png",
      label: "login.png",
    }),
    /public https image URL/,
  );
});

test("a public https image URL is fetched and attached after review", async () => {
  const vision = await resolveEnhancementVision(
    {
      kind: "remote-image",
      url: "https://cdn.example.com/login.png",
      label: "login.png",
    },
    {
      fetcher: (async () =>
        new Response(PNG_1X1, {
          status: 200,
          headers: { "content-type": "image/png" },
        })) as typeof fetch,
    },
  );
  assert.equal(vision.mimeType, "image/png");
  assert.equal(Buffer.from(vision.base64, "base64").equals(PNG_1X1), true);
});

test("OpenAI, Anthropic, and Google enhancement requests include image parts and omit raw paths", () => {
  const request = requestWithVision();
  const openai = buildOpenAIResponseRequest(
    request,
    getEnhancementProfile(request.profileId),
    "compiler",
    enhancementCompilerInput(request),
  );
  const content = (
    openai.input as Array<{ content: Array<Record<string, unknown>> }>
  )[0]!.content;
  assert.equal(content[0]?.type, "input_text");
  assert.deepEqual(content[1], openaiVisionContentPart(request.vision!));
  assert.match(String(content[1]?.image_url), /^data:image\/png;base64,/);
  assert.doesNotMatch(JSON.stringify(openai), /\/tmp\//);
  assert.match(enhancementCompilerInput(request), /"kind": "image"/);
  assert.doesNotMatch(enhancementCompilerInput(request), /iVBORw0KGgo/);
  assert.match(
    enhancementCompilerInstructions(request),
    new RegExp(VISION_COMPILER_ADDENDUM.slice(0, 40)),
  );

  const anthropic = buildAnthropicMessageRequest(
    { ...request, profileId: "anthropic-sonnet-5-v1" },
    getProviderEnhancementProfile("anthropic-sonnet-5-v1"),
  );
  const anthropicContent = (
    anthropic.messages as Array<{ content: Array<Record<string, unknown>> }>
  )[0]!.content;
  assert.equal(anthropicContent[0]?.type, "text");
  assert.equal(anthropicContent[1]?.type, "image");
  assert.equal(
    (anthropicContent[1]?.source as { media_type?: string }).media_type,
    "image/png",
  );

  const google = buildGoogleGenerateContentRequest(
    { ...request, profileId: "google-gemini-3.5-flash-v1" },
    getProviderEnhancementProfile("google-gemini-3.5-flash-v1"),
  );
  const parts = (
    google.contents as Array<{ parts: Array<Record<string, unknown>> }>
  )[0]!.parts;
  assert.equal(typeof parts[0]?.text, "string");
  assert.equal(
    (parts[1]?.inline_data as { mime_type?: string }).mime_type,
    "image/png",
  );

  const withVision = estimatedMaximumCostForProfileUsd(
    request,
    getEnhancementProfile(request.profileId),
  );
  const withoutVision = estimatedMaximumCostForProfileUsd(
    {
      roughThoughts: request.roughThoughts,
      target: request.target,
      profileId: request.profileId,
      researchLevel: request.researchLevel,
    },
    getEnhancementProfile(request.profileId),
  );
  assert.ok(withVision > withoutVision);

  const validated = validateEnhancementRequest(request);
  assert.equal(validated.vision?.label, "01-screen.png");
  assert.throws(
    () =>
      validateEnhancementRequest({
        ...request,
        vision: { ...request.vision!, label: "/tmp/01-screen.png" },
      }),
    /filename, not a path/,
  );
});

test("local video bytes become Google vision input and other providers fail before the request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-video-"));
  const filePath = join(directory, "clip.mp4");
  const bytes = Buffer.from("fake-mp4-bytes");
  await writeFile(filePath, bytes);

  const vision = await resolveEnhancementVision({
    kind: "local-video",
    filePath,
    label: "clip.mp4",
  });
  assert.equal(vision.mimeType, "video/mp4");
  assert.equal(vision.label, "clip.mp4");
  assert.equal(Buffer.from(vision.base64, "base64").equals(bytes), true);
  assert.deepEqual(validateEnhancementVision(vision), vision);

  const request: EnhancementRequest = {
    roughThoughts:
      "Write a reusable prompt that would produce this video.\n\nA video is attached as vision input.",
    target: "codex",
    profileId: "google-gemini-3.7-flash-v1",
    researchLevel: "none",
    vision,
  };
  const google = buildGoogleGenerateContentRequest(
    request,
    getProviderEnhancementProfile("google-gemini-3.7-flash-v1"),
  );
  const parts = (
    google.contents as Array<{ parts: Array<Record<string, unknown>> }>
  )[0]!.parts;
  assert.equal(
    (parts[1]?.inline_data as { mime_type?: string }).mime_type,
    "video/mp4",
  );
  assert.doesNotMatch(JSON.stringify(google), /\/tmp\//);
  assert.match(enhancementCompilerInput(request), /"kind": "video"/);
  assert.doesNotMatch(enhancementCompilerInput(request), /fake-mp4-bytes/);
  assert.match(
    enhancementCompilerInstructions(request),
    new RegExp(VISION_VIDEO_COMPILER_ADDENDUM.slice(0, 40)),
  );

  const withVideo = estimatedMaximumCostForProfileUsd(
    request,
    getProviderEnhancementProfile("google-gemini-3.7-flash-v1"),
  );
  const withoutVideo = estimatedMaximumCostForProfileUsd(
    {
      roughThoughts: request.roughThoughts,
      target: request.target,
      profileId: request.profileId,
      researchLevel: request.researchLevel,
    },
    getProviderEnhancementProfile("google-gemini-3.7-flash-v1"),
  );
  assert.ok(withVideo > withoutVideo);

  assert.throws(() => openaiVisionContentPart(vision), /cannot accept video/);
  assert.throws(
    () => anthropicVisionContentPart(vision),
    /cannot accept video/,
  );
  assert.throws(
    () => assertProviderAcceptsVision("openai", vision),
    /cannot accept video/,
  );
  assert.doesNotThrow(() => assertProviderAcceptsVision("google", vision));

  assert.throws(
    () =>
      buildOpenAIResponseRequest(
        { ...request, profileId: "openai-standard-v1" },
        getEnhancementProfile("openai-standard-v1"),
        "compiler",
        enhancementCompilerInput(request),
      ),
    /cannot accept video/,
  );
  assert.throws(
    () =>
      buildAnthropicMessageRequest(
        { ...request, profileId: "anthropic-sonnet-5-v1" },
        getProviderEnhancementProfile("anthropic-sonnet-5-v1"),
      ),
    /cannot accept video/,
  );
});
