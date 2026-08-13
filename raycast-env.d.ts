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
  "sshProjectRoot": string,
  /** OpenAI API Key - Shared encrypted preference for Enhance Prompt and Capture Inbox; read only after an explicit OpenAI action */
  "openaiApiKey"?: string,
  /** Default Model - The enhancement profile Enhance Prompt starts with; a Disabled provider falls back to OpenAI Standard */
  "defaultEnhancementProfile": "openai-standard-v1" | "openai-deep-v1" | "anthropic-sonnet-5-v1" | "google-gemini-3.5-flash-v1",
  /** Quality - Runs a second model pass that reviews the compiled prompt against your original thoughts. Roughly doubles the enhancement cost. */
  "selfReviewPass": boolean,
  /**  - Generate several candidates, score each with a blind judge, and preselect the winner. Multiplies the enhancement cost by the number of variants and adds one judge call each. */
  "variantCount": "0" | "2" | "3" | "4",
  /** Anthropic API Key - Read only after you start an Anthropic enhancement; leave blank to type a one-run key each time */
  "anthropicApiKey"?: string,
  /** Google API Key - Read only after you start a Google enhancement; leave blank to type a one-run key each time */
  "googleApiKey"?: string,
  /** Context7 API Key - Read only after you approve a Context7 documentation request; falls back to the CONTEXT7_API_KEY environment variable */
  "context7ApiKey"?: string,
  /** Exa API Key - Read only after you approve an Exa search and its maximum cost; leave blank to type a one-run key each time */
  "exaApiKey"?: string,
  /** GitHub Token - Read only after you approve a read-only public GitHub search; leave blank to type a one-run token each time */
  "githubToken"?: string,
  /** Research Suppliers - Allow Context7 when the task names a technical library */
  "researchContext7": boolean,
  /**  - Allow Exa on Deep research; each search shows its maximum cost before it runs */
  "researchExa": boolean,
  /**  - Allow current-web retrieval when the task depends on a fact outside library documentation */
  "researchWeb": boolean,
  /**  - Allow read-only public GitHub searches when the task names upstream code or history */
  "researchGithub": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `browse-prompts` command */
  export type BrowsePrompts = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `browse-prompts` command */
  export type BrowsePrompts = {}
}

