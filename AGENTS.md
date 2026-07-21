# Prompt Studio

The approved behavior lives in `openspec/changes/build-prompt-studio/`.

## Invariants

- Markdown prompt files are the recoverable source of truth.
- SQLite and QMD are disposable indexes.
- Optional capabilities start Disabled and activate in the numbered order.
- A disabled capability performs no network request, background work, credential request, or data mutation.
- Local Git project context is read-only.
- Model output is validated and previewed before saving.

## Commands

- `pnpm test` — focused shared-core checks
- `pnpm typecheck` — TypeScript validation
- `pnpm lint` — Raycast lint
- `pnpm build` — Raycast production build
- `pnpm dev` — load the extension in Raycast development mode

Run build, test, lint, and typecheck on the Mac Mini mirror.
