# Reverse Prompt — Verification

Date: 2026-08-18

## Outcome

- Personal Prompt Studio now has a second root command, **Reverse Prompt**, next to Prompt Library.
- The command accepts one image file, one video file, or one http(s) URL, plus optional notes and a target.
- Submit builds a local reverse-prompt brief and opens the existing Enhance Prompt form. Review, copy, and save stay on that path.
- Reverse Prompt does not request a credential, fetch the URL, or read file bytes. If OpenAI Enhancement is Disabled, the command explains that and stops.

## Automated Evidence

- `pnpm test`: includes `test/reverse-prompt.test.mts` for classification, secret rejection, URL fencing, and launch prefill.
- `pnpm typecheck`: TypeScript validation.
- `pnpm lint`: Raycast lint.

`pnpm build` and `pnpm dev` stay on the MacBook Pro.

## Store Boundary

- `store/package.json` still exposes only Prompt Library and Frequent Prompts Menu.
- Reverse Prompt is not copied into the Store package and has no command-level API key field.

## How to tell it worked on the MacBook Pro

1. Sync this branch and run `pnpm dev`.
2. Open **Reverse Prompt**. If Activation 3 is Disabled, you see that message and no key prompt.
3. After Enhancement is enabled, pick a local screenshot or paste `https://example.com`, add a short note, and choose Continue to Enhance.
4. Enhance Prompt opens with the reverse-prompt brief already filled. Complete enhance, review the compiled prompt, then copy or save.
5. The saved file is ordinary Prompt Studio Markdown in the library directory.

## Remaining Device Check

- Live enhancement still needs an enabled provider and a key in extension preferences, same as Enhance Prompt.