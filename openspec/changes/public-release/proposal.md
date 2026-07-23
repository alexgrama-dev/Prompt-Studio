## Why

Prompt Studio is public on GitHub but is not ready for a stranger to install or
for Raycast to review. The repository lacks a license file, public contribution
and security guidance, a release history, and a safe Store package. Publishing
from the repository root would also copy internal verification material and
unfinished surfaces into the Raycast submission.

The working local prompt library is already useful on its own. Shipping that
smaller surface is the fastest honest public release.

## What Changes

- Publish only the working local library and menu-bar commands in the initial
  Raycast Store package.
- Keep the unfinished Enhance command, provider credentials, remote project
  setting, command-line interface, and local agent interface out of the initial
  Store manifest.
- Prepare the Store package in an ignored directory from an explicit public
  file list.
- Remove the machine-specific default SSH project root from the development
  manifest so a fresh checkout never attempts a remote connection implicitly.
- Replace the internal rollout dossier with a user-first README and add privacy,
  security, contribution, license, changelog, issue, and pull request guidance.
- Add public screenshots containing no credentials, customer data, or personal
  paths.

## Capabilities

### New Capabilities

- `public-distribution`: a reviewable, local-only Raycast Store package and the
  public maintenance material needed to support it.

### Modified Capabilities

None. Removing the default SSH value makes the existing project-context
behavior match its requirement that remote discovery be user-configured.

## Impact

- The development repository retains all existing source and experimental
  capabilities.
- The first Store package contains two usable commands and one local directory
  preference.
- No prompt format or existing prompt file changes.
- No new network request, credential, storage location, or background process.
