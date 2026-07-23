# Contributing to Prompt Studio

Thanks for helping make prompt reuse simpler and more reliable.

## Before opening a change

- Search existing issues and pull requests first.
- Keep changes focused on one problem.
- Do not commit API keys, private prompts, customer data, or machine-specific
  paths.
- Open an issue before a large behavior or architecture change so the approach
  can be agreed before implementation.

## Local setup

Prompt Studio requires macOS, Raycast, Node.js 22 or newer, and pnpm.

```bash
pnpm install
pnpm dev
```

The default prompt directory is:

```text
~/Library/Application Support/Prompt Studio/Prompts
```

Use test prompts that contain no private or customer information.

## Checks

Run the complete check before opening a pull request:

```bash
pnpm check
pnpm check:store
```

`pnpm check` covers tests, type checking, linting, the Raycast build, command
line builds, and the local integration checks. `pnpm check:store` creates the
public Store package from an explicit file list and verifies that package.

## Pull requests

In the pull request, explain:

- what problem the change solves;
- what a user will notice;
- which checks you ran;
- whether the change reads files, writes files, uses the clipboard, makes a
  network request, or needs a credential.

By contributing, you agree that your contribution is licensed under the MIT
License.
