## Context

Raycast's publish command copies nearly the complete current directory into its
Store submission checkout. Running it from the repository root would therefore
include OpenSpec proposals, evaluation fixtures, internal verification
screenshots, command-line and agent experiments, and machine-specific
documentation.

The root manifest also advertises Enhance Prompt even though enhancement is
Disabled on a fresh installation and the public interface has no activation
flow. Publishing that command would promise a workflow a new Store user cannot
complete.

## Goals

- Ship a useful first public release without adding a new onboarding system.
- Make the submitted file set explicit and inspectable.
- Tell a new user exactly what data the released commands access.
- Give contributors and security reporters clear public routes.
- Preserve the private development workflow and existing advanced source.

## Non-goals

- Public activation for model enhancement, research, project context, the CLI,
  or the local agent interface.
- A hosted service, account system, telemetry, or adoption analytics.
- Rewriting the existing feature-state architecture.

## Decisions

### 1. The first Store surface is the local library

The Store manifest exposes `browse-prompts` and `menubar-prompts`. It exposes
only the local prompt-directory preference. Enhance Prompt and settings for QMD,
project discovery, SSH, OpenAI, and Context7 remain outside the initial Store
manifest.

This is intentionally narrower than the development manifest. The Store
description says "find and reuse" rather than claiming that a fresh install can
improve prompts.

### 2. Store publication uses a generated allowlisted directory

`scripts/prepare-raycast-store.mts` replaces only the fixed `dist-store/`
directory and copies a fixed list:

- the two command entry points and their transitive local source dependencies;
- icon assets and public screenshots;
- the user README, privacy statement, license, and changelog;
- Store-scoped TypeScript, lint, and formatting configuration;
- the dedicated Store manifest and npm dependency lock.

The script verifies the exact top-level result and the exact command and
preference names. It fails if an unexpected entry appears. Source files for
unreleased commands are not copied.

`dist-store/` is ignored by Git. The authoritative Store manifest and dependency
lock remain under `store/`.

### 3. Fresh installations have no implicit remote destination

The development manifest no longer defaults the optional SSH project root to a
personal machine alias. Remote discovery still works after a user explicitly
enters a `host:path` value.

### 4. Public documentation replaces rollout history as the entry point

The README explains the product, local data model, initial Store boundary,
source setup, and checks. Historical verification material remains in the
repository for maintainers but is not copied into the Store package.

Privacy language is scoped to the two commands in the initial Store manifest.
It separately discloses that advanced source-tree features exist but are not
released commands.

### 5. The Store runtime does not load Node's experimental SQLite module

Raycast's extension runtime does not provide `node:sqlite`, even when the build
machine's Node version does. The Store package therefore replaces the advanced
SQLite search module with a Store-specific compatibility module. Exact prompt
search continues to use the Markdown records already loaded by the library.
Usage counts and last-used timestamps are kept in a small atomic JSON cache so
the menu-bar ranking still works.

The development build keeps its existing SQLite implementation. The package
preparation script performs the replacement explicitly, and a Store-specific
test imports and exercises the compatibility module without `node:sqlite`.

## Risks and mitigations

- **Store and root manifests drift:** `check:store` builds and lints the
  generated Store package, and the preparation script asserts its public
  surface.
- **Build succeeds but Raycast cannot load a Node module:** the Store check
  imports and exercises its runtime compatibility module before bundling.
- **Internal files enter the submission:** the generated directory uses a
  fixed allowlist and checks the exact top-level entries.
- **Screenshots expose private information:** only reviewed synthetic prompt
  examples are copied into `media/`.
- **The narrow release appears misleading:** README and privacy documentation
  explicitly list both released commands and excluded advanced features.
