# Store Enhance / Optimize — Verification

Date: 2026-08-18

## Outcome

- The Store package exposes Prompt Library, Enhance Prompt, and Frequent
  Prompts Menu.
- Store preferences remain the local prompt directory only.
- Opening Enhance Prompt does not request a provider key.
- Submitting Enhance without a saved key opens the one-run key form, then the
  existing review → save or copy path.

## Automated checks

- `pnpm test:store-core`
- `pnpm typecheck`
- Store-manifest and store-safety checks in `store/*.test.mts`
- `pnpm package:store` asserts the three Store commands and the single
  directory preference

## MacBook Pro

Load the generated `dist-store/` package in Raycast:

1. Open Prompt Studio. No credential form appears.
2. Open Enhance Prompt. The form starts with the task.
3. Submit Enhance. A one-run provider key field appears.
4. After a successful run, review the prompt, then save or copy.
5. Confirm Prompt Library and Frequent Prompts still work without a key.
