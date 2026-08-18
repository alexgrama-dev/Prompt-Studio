# Reverse Prompt Vision — Verification

Date: 2026-08-18

## Outcome

- Reverse Prompt still hands off to the existing Enhance → Review → Save path.
- A local PNG, JPEG, WebP, or GIF is no longer treated as a filename-only brief.
  Enhance reads those pixels after the user submits the Enhance form and sends
  them as vision input on OpenAI, Anthropic, and Google requests.
- Filename and path are labels only. The compiled prompt is instructed not to
  tell the next agent to open a local file, and Prompt Studio execution
  wrappers stay out of the reverse-prompt body.

## What was wired

- OpenAI Responses `input_image` with high detail.
- Anthropic Messages image content blocks.
- Google Gemini `inline_data` parts.
- Public https image URLs whose path looks like png/jpg/webp/gif are fetched
  after review, with the same host safety checks as research URLs.
- Video files and ordinary HTML URLs are not fetched or uploaded.

## Remaining limitations

- HEIC, TIFF, and BMP classify as images but cannot be sent as vision. Export
  as PNG, JPEG, WebP, or GIF.
- Video bytes are not accepted by the current provider request path.
- HTML pages are not fetched. Use a screenshot or a direct https image URL.

`pnpm build` and `pnpm dev` stay on the MacBook Pro.
