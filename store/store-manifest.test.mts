import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Store manifest exposes Enhance Prompt without install-time credentials", async () => {
  const manifest = JSON.parse(await readFile("store/package.json", "utf8")) as {
    commands?: Array<{
      name?: string;
      title?: string;
      icon?: string;
    }>;
    preferences?: Array<{ name?: string; required?: boolean; type?: string }>;
  };

  assert.deepEqual(
    manifest.commands?.map(({ name, title, icon }) => [name, title, icon]),
    [
      ["browse-prompts", "Prompt Library", "prompt-library.png"],
      ["enhance-prompt", "Enhance Prompt", "enhance-prompt.png"],
      ["menubar-prompts", "Frequent Prompts Menu", "frequent-prompts.png"],
    ],
  );
  assert.deepEqual(
    manifest.preferences?.map(({ name, required, type }) => [
      name,
      required,
      type,
    ]),
    [["libraryDirectory", false, "textfield"]],
  );
  assert.equal(
    manifest.preferences?.some((preference) =>
      /apiKey|token|password/i.test(preference.name ?? ""),
    ),
    false,
  );
});

test("Store-facing copy unhides Enhance / Optimize and keeps credentials off first open", async () => {
  const [readme, privacy, changelog, views] = await Promise.all([
    readFile("README.md", "utf8"),
    readFile("PRIVACY.md", "utf8"),
    readFile("CHANGELOG.md", "utf8"),
    readFile("store/src/open-studio-views.ts", "utf8"),
  ]);

  assert.match(readme, /Enhance \/ Optimize/);
  assert.match(readme, /\*\*Enhance Prompt\*\*/);
  assert.doesNotMatch(
    readme,
    /They are not commands in the initial Store release/,
  );
  assert.match(
    readme,
    /asks for a provider key only when you submit an enhancement/,
  );
  assert.match(privacy, /Enhance Prompt contacts a model provider only after/);
  assert.match(
    changelog,
    /Ask for a provider key only when you submit an enhancement/,
  );
  assert.match(views, /STUDIO_SCREENS_AVAILABLE = true/);
  assert.match(views, /CAPTURE_INBOX_AVAILABLE = false/);
  assert.match(views, /from "\.\/enhance-prompt"/);
});
