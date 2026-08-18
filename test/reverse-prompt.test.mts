import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReversePromptThoughts,
  classifyReversePromptInput,
  initialReversePromptFields,
  reversePromptSourceFromFiles,
} from "../src/core/reverse-prompt.ts";

test("Reverse Prompt classifies image, URL, and video without fetching", () => {
  assert.deepEqual(
    classifyReversePromptInput({ filePath: "/tmp/hero.png" }),
    { kind: "image", value: "/tmp/hero.png", label: "hero.png" },
  );
  assert.deepEqual(
    classifyReversePromptInput({ filePath: "clip.MOV" }),
    { kind: "video", value: "clip.MOV", label: "clip.MOV" },
  );
  assert.deepEqual(classifyReversePromptInput({ url: "https://example.com/ui" }), {
    kind: "url",
    value: "https://example.com/ui",
    label: "example.com/ui",
  });
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

test("Reverse Prompt rejects mixed, credentialed, or unknown sources", () => {
  assert.throws(
    () =>
      classifyReversePromptInput({
        filePath: "shot.png",
        url: "https://example.com",
      }),
    /not both/,
  );
  assert.throws(
    () => classifyReversePromptInput({ url: "https://user:secret@example.com" }),
    /credentials/,
  );
  assert.throws(
    () => classifyReversePromptInput({ url: "ftp://example.com/file" }),
    /http or https/,
  );
  assert.throws(
    () => classifyReversePromptInput({ filePath: "notes.md" }),
    /image|video/,
  );
  assert.throws(() => classifyReversePromptInput({}), /Choose one/);
  assert.throws(
    () => reversePromptSourceFromFiles(["a.png", "b.png"]),
    /one image or video/,
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
  assert.match(imageThoughts, /Source: card.png/);
  assert.match(imageThoughts, /Keep the empty state/);
  assert.doesNotMatch(imageThoughts, /<untrusted-evidence/);

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
  assert.match(
    urlThoughts,
    /<untrusted-evidence source="argument">\nhttps:\/\/example.com\/docs\n<\/untrusted-evidence>/,
  );

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

test("Reverse Prompt prefills a URL or media path from launch text", () => {
  assert.deepEqual(initialReversePromptFields(), { files: [], url: "" });
  assert.deepEqual(
    initialReversePromptFields("https://example.com/app"),
    { files: [], url: "https://example.com/app" },
  );
  assert.deepEqual(initialReversePromptFields(undefined, "/tmp/demo.webp"), {
    files: ["/tmp/demo.webp"],
    url: "",
  });
  assert.deepEqual(initialReversePromptFields("just a sentence"), {
    files: [],
    url: "",
  });
});
