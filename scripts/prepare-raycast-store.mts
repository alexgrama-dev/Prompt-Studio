import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertStoreTextIsCredentialSafe } from "./store-safety.mts";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(repositoryRoot, "dist-store");

if (
  basename(outputDirectory) !== "dist-store" ||
  dirname(outputDirectory) !== repositoryRoot
) {
  throw new Error(`Refusing to replace unexpected path: ${outputDirectory}`);
}

const rootFiles = [
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "eslint.config.cjs",
] as const;
const rootDirectories = ["assets", "media", "metadata"] as const;
const sourceFiles = [
  "src/browse-prompts.tsx",
  "src/core/extension-preferences.ts",
  "src/core/features.ts",
  "src/core/feedback-revision.ts",
  "src/core/feedback-store.ts",
  "src/core/browse-state.ts",
  "src/core/last-library-paste.ts",
  "src/core/launch-context.ts",
  "src/core/placeholder-values.ts",
  "src/core/placeholders.ts",
  "src/core/project-context.ts",
  "src/core/prompt-store.ts",
  "src/core/qmd-search.ts",
  "src/core/record-search.ts",
  "src/core/secrets.ts",
  "src/feature-status.tsx",
  "src/feedback-form.tsx",
  "src/menubar-prompts.tsx",
  "src/prompt-feedback.tsx",
  "src/prompt-form.tsx",
] as const;

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of rootFiles) {
  await cp(join(repositoryRoot, file), join(outputDirectory, file));
}

for (const directory of rootDirectories) {
  await cp(join(repositoryRoot, directory), join(outputDirectory, directory), {
    recursive: true,
  });
}

for (const file of sourceFiles) {
  const destination = join(outputDirectory, file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(repositoryRoot, file), destination);
}

await cp(
  join(repositoryRoot, "store", ".prettierrc"),
  join(outputDirectory, ".prettierrc"),
);
await cp(
  join(repositoryRoot, "store", "package.json"),
  join(outputDirectory, "package.json"),
);
await cp(
  join(repositoryRoot, "store", "tsconfig.json"),
  join(outputDirectory, "tsconfig.json"),
);
await cp(
  join(repositoryRoot, "store", "src", "core", "search-index.ts"),
  join(outputDirectory, "src", "core", "search-index.ts"),
);
await cp(
  join(repositoryRoot, "store", "src", "core", "extension-preferences.ts"),
  join(outputDirectory, "src", "core", "extension-preferences.ts"),
);
await cp(
  join(repositoryRoot, "store", "src", "core", "features.ts"),
  join(outputDirectory, "src", "core", "features.ts"),
);
await cp(
  join(repositoryRoot, "store", "package-lock.json"),
  join(outputDirectory, "package-lock.json"),
);

const expectedTopLevel = [
  ".prettierrc",
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "assets",
  "eslint.config.cjs",
  "media",
  "metadata",
  "package-lock.json",
  "package.json",
  "src",
  "tsconfig.json",
].sort();
const actualTopLevel = (await readdir(outputDirectory)).sort();

if (JSON.stringify(actualTopLevel) !== JSON.stringify(expectedTopLevel)) {
  throw new Error(
    `Unexpected Store package contents:\n${actualTopLevel.join("\n")}`,
  );
}

const manifest = JSON.parse(
  await readFile(join(outputDirectory, "package.json"), "utf8"),
) as {
  commands?: { name?: string }[];
  preferences?: { name?: string }[];
};
const commandNames = manifest.commands?.map(({ name }) => name) ?? [];
const preferenceNames = manifest.preferences?.map(({ name }) => name) ?? [];

if (
  JSON.stringify(commandNames) !==
  JSON.stringify(["browse-prompts", "menubar-prompts"])
) {
  throw new Error(`Unexpected Store commands: ${commandNames.join(", ")}`);
}

if (JSON.stringify(preferenceNames) !== JSON.stringify(["libraryDirectory"])) {
  throw new Error(
    `Unexpected Store preferences: ${preferenceNames.join(", ")}`,
  );
}

const credentialSafeFiles = [
  ...rootFiles,
  ...sourceFiles,
  "package.json",
  "tsconfig.json",
];

for (const file of credentialSafeFiles) {
  const contents = await readFile(join(outputDirectory, file), "utf8");
  assertStoreTextIsCredentialSafe(file, contents);
}

console.log(
  `Prepared Raycast Store package with ${actualTopLevel.length} allowlisted top-level entries at ${outputDirectory}`,
);
