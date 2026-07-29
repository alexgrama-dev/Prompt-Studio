/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Prompt Directory - Absolute path or ~/ path containing Prompt Studio Markdown files */
  "libraryDirectory": string,
  /** QMD Executable - Optional absolute path to qmd; conventional macOS install paths are detected automatically */
  "qmdExecutable": string,
  /** Project Roots - Folders Prompt Studio may scan for saved Git repositories; you can also choose one exact repo directly in Enhance Prompt */
  "projectRoots": string,
  /** Mac Mini Project Root - Optional read-only SSH source in host:path form; leave blank to disable */
  "sshProjectRoot"?: string,
  /** OpenAI API Key - Shared encrypted preference for Enhance Prompt and Idea Studio; read only after an explicit OpenAI action */
  "openaiApiKey"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `browse-prompts` command */
  export type BrowsePrompts = ExtensionPreferences & {}
  /** Preferences accessible in the `enhance-prompt` command */
  export type EnhancePrompt = ExtensionPreferences & {
  /** Context7 API Key - Stored by Raycast in encrypted command-scoped storage; used only after an exact documentation query is reviewed */
  "context7ApiKey"?: string
}
  /** Preferences accessible in the `idea-studio` command */
  export type IdeaStudio = ExtensionPreferences & {}
  /** Preferences accessible in the `menubar-prompts` command */
  export type MenubarPrompts = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `browse-prompts` command */
  export type BrowsePrompts = {}
  /** Arguments passed to the `enhance-prompt` command */
  export type EnhancePrompt = {
  /** Rough thoughts */
  "thoughts": string
}
  /** Arguments passed to the `idea-studio` command */
  export type IdeaStudio = {
  /** Idea to capture */
  "idea": string
}
  /** Arguments passed to the `menubar-prompts` command */
  export type MenubarPrompts = {}
}

