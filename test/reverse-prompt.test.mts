import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildReversePromptThoughts,
  classifyReversePromptInput,
  initialReversePromptFields,
  reversePromptFormSource,
  reversePromptSourceFromFiles,
  reversePromptVisionSource,
} from "../src/core/reverse-prompt.ts";
import { enhancePromptThoughtsLaunchContext } from "../src/core/launch-context.ts";

async function writableMediaFile(
  directory: string,
  name: string,
): Promise<string> {
  const path = join(directory, name);
  await writeFile(path, "fixture");
  return path;
}

test("Reverse Prompt classifies image, URL, and video without fetching", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-reverse-"));
  const image = await writableMediaFile(directory, "hero.png");
  const video = await writableMediaFile(directory, "clip.MOV");

  assert.deepEqual(classifyReversePromptInput({ filePath: image }), {
    kind: "image",
    value: image,
    label: "hero.png",
  });
  assert.deepEqual(classifyReversePromptInput({ filePath: video }), {
    kind: "video",
    value: video,
    label: "clip.MOV",
  });
  assert.deepEqual(
    classifyReversePromptInput({ url: "https://example.com/ui" }),
    {
      kind: "url",
      value: "https://example.com/ui",
      label: "example.com/ui",
    },
  );
  assert.deepEqual(
    classifyReversePromptInput({
      fallbackText: "https://example.com/from-selection",
    }),
    {
      kind: "url",
      value: "https://example.com/from-selection",
      label: "example.com/from-selection",
    },
  );
});

test("Reverse Prompt rejects mixed, credentialed, unknown, or unreadable sources", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-reverse-"));
  const missing = join(directory, "missing.png");
  const nested = join(directory, "folder.png");
  await mkdir(nested);

  assert.throws(
    () =>
      classifyReversePromptInput({
        filePath: join(directory, "shot.png"),
        url: "https://example.com",
      }),
    /not both/,
  );
  assert.throws(
    () =>
      classifyReversePromptInput({ url: "https://user:secret@example.com" }),
    /credentials/,
  );
  assert.throws(
    () => classifyReversePromptInput({ url: "ftp://example.com/file" }),
    /http or https/,
  );
  assert.throws(
    () => classifyReversePromptInput({ filePath: join(directory, "notes.md") }),
    /image|video/,
  );
  assert.throws(() => classifyReversePromptInput({}), /Choose one/);
  assert.throws(
    () => reversePromptSourceFromFiles(["a.png", "b.png"]),
    /one image or video/,
  );
  assert.throws(
    () => classifyReversePromptInput({ filePath: missing }),
    /not readable/,
  );
  assert.throws(
    () => classifyReversePromptInput({ filePath: nested }),
    /image or video file/,
  );
});

test("Reverse Prompt builds enhance-ready thoughts and keeps URL evidence fenced", () => {
  const imageThoughts = buildReversePromptThoughts({
    source: {
      kind: "image",
      value: "/tmp/card.png",
      label: "card.png",
    },
    notes: "Keep the empty state and the primary button label.",
    target: "codex",
  });
  assert.match(imageThoughts, /reusable prompt that would produce this image/);
  assert.match(imageThoughts, /Source label: card.png/);
  assert.match(imageThoughts, /pixels are the visual source of truth/);
  assert.match(imageThoughts, /Keep the empty state/);
  assert.match(
    imageThoughts,
    /Do not tell the next agent to open a local file path/,
  );
  assert.doesNotMatch(imageThoughts, /\/tmp\/card\.png/);
  assert.doesNotMatch(imageThoughts, /<untrusted-evidence/);
  assert.doesNotMatch(
    imageThoughts,
    /Do not invent visual, spoken, or page details that were not supplied/,
  );

  const urlThoughts = buildReversePromptThoughts({
    source: {
      kind: "url",
      value: "https://example.com/docs",
      label: "example.com/docs",
    },
    target: "generic",
  });
  assert.match(urlThoughts, /produce this URL/);
  assert.match(urlThoughts, /Do not invent/);
  assert.match(urlThoughts, /page at this URL was not fetched/);
  assert.match(
    urlThoughts,
    /<untrusted-evidence source="argument">\nhttps:\/\/example.com\/docs\n<\/untrusted-evidence>/,
  );

  const videoThoughts = buildReversePromptThoughts({
    source: {
      kind: "video",
      value: "/tmp/clip.mp4",
      label: "clip.mp4",
    },
    target: "codex",
  });
  assert.match(videoThoughts, /cannot accept video bytes/);
  assert.doesNotMatch(videoThoughts, /\/tmp\/clip\.mp4/);

  assert.throws(
    () =>
      buildReversePromptThoughts({
        source: {
          kind: "url",
          value: "https://example.com/?api_key=abcdefghijklmnopqrst",
          label: "example.com",
        },
        target: "codex",
      }),
    /secret/,
  );
});

test("Reverse Prompt hands local images to Enhance as vision, not filename-only thoughts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-reverse-"));
  const image = await writableMediaFile(directory, "01-screen.png");
  const source = classifyReversePromptInput({ filePath: image });
  const vision = reversePromptVisionSource(source);
  assert.deepEqual(vision, {
    kind: "local-image",
    filePath: image,
    label: "01-screen.png",
  });
  const context = enhancePromptThoughtsLaunchContext(
    buildReversePromptThoughts({ source, target: "codex" }),
    "codex",
    undefined,
    vision,
  );
  assert.equal(context.untrustedSurface, undefined);
  assert.deepEqual(context.visionSource, vision);
  assert.match(context.thoughts, /attached as vision input/);
  assert.doesNotMatch(context.thoughts, /open 01-screen\.png/);
  assert.doesNotMatch(
    context.thoughts,
    new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );

  assert.equal(
    reversePromptVisionSource({
      kind: "image",
      value: "/tmp/shot.heic",
      label: "shot.heic",
    }),
    undefined,
  );
  assert.deepEqual(
    reversePromptVisionSource({
      kind: "url",
      value: "https://cdn.example.com/ui/login.png",
      label: "cdn.example.com/ui/login.png",
    }),
    {
      kind: "remote-image",
      url: "https://cdn.example.com/ui/login.png",
      label: "cdn.example.com/ui/login.png",
    },
  );
  assert.equal(
    reversePromptVisionSource({
      kind: "url",
      value: "https://example.com/docs",
      label: "example.com/docs",
    }),
    undefined,
  );
});

test("Reverse Prompt prefills a URL or existing media path from launch text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "prompt-studio-reverse-"));
  const image = await writableMediaFile(directory, "demo.webp");
  const missing = join(directory, "absent.webp");

  assert.deepEqual(initialReversePromptFields(), { files: [], url: "" });
  assert.deepEqual(initialReversePromptFields("https://example.com/app"), {
    files: [],
    url: "https://example.com/app",
  });
  assert.deepEqual(initialReversePromptFields(undefined, image), {
    files: [image],
    url: "",
  });
  assert.deepEqual(initialReversePromptFields(undefined, missing), {
    files: [],
    url: "",
  });
  assert.deepEqual(initialReversePromptFields("just a sentence"), {
    files: [],
    url: "",
  });
});

test("Reverse Prompt submit uses current form values and ignores launch text", () => {
  assert.deepEqual(reversePromptFormSource({ files: [], url: "" }), {});
  assert.deepEqual(
    reversePromptFormSource({
      files: [],
      url: "https://example.com/typed",
    }),
    { url: "https://example.com/typed" },
  );
  assert.deepEqual(
    reversePromptFormSource({ files: ["/tmp/hero.png"], url: "" }),
    { filePath: "/tmp/hero.png" },
  );
  assert.throws(
    () =>
      classifyReversePromptInput(
        reversePromptFormSource({
          files: [],
          url: "",
        }),
      ),
    /Choose one/,
  );
});
