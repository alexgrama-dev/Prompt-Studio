# Reverse Prompt Video + Gemini 3.7 Default — Verification

Date: 2026-08-18

## Outcome

- Reverse Prompt still hands off to the existing Enhance → Review → Save path.
- Local video files Reverse Prompt already accepts (mp4/mov/m4v/webm/avi/mkv)
  are attached as vision after cost and privacy review, the same way images are.
- The model must see the media, not a filename. The compiled prompt is
  instructed not to tell the next agent to open a local path.
- Default Enhance model is Gemini 3.7 Flash with `thinkingLevel: high`.

## What was wired

### Video

- Extended `enhancement-vision.ts` with `local-video` sources and video MIME
  types. No new command.
- Google `generateContent` receives video as `inline_data` (`mime_type` +
  base64). Confirmed against Gemini video-understanding docs.
- OpenAI Responses and Anthropic Messages do not document native video input.
  Those providers fail clearly before the request instead of dropping the file.
- Cost estimate adds a conservative 60-second video allowance (Google documents
  ~263 tokens/second; 60s ≈ 15,780 tokens). Pricing copy mentions that.

### Gemini 3.7 Flash default

- Profile id: `google-gemini-3.7-flash-v1`
- Model id: `gemini-3.7-flash`
- `thinkingLevel` / `reasoningEffort`: `high` (not `xhigh`; Flash rejects it)
- `package.json` Default Model is this profile. Gemini 3.5 Flash remains
  selectable.
- Disabled Google activation still falls back to OpenAI Standard.
- Introductory paid-tier price from the Gemini 3.7 Flash model card
  (2026-08-13): $0.75 / $3.75 per 1M through 2026-12-31, then $1.50 / $7.50
  from 2027-01-01. Cached input follows the existing 10% pattern.

## Remaining limitations

- HEIC, TIFF, and BMP still cannot be sent as vision. Export as PNG, JPEG,
  WebP, or GIF.
- HTML pages are not fetched. Use a screenshot or a direct https image URL.
- Video is Google-only. OpenAI and Anthropic fail before the request.
- Local video is capped at 20 MB to stay within Gemini inline-data guidance.
  Larger clips are rejected with a clear size error; Files API upload is not
  added.
- `.mkv` is sent as `video/x-matroska`. Gemini's published MIME list includes
  mp4/mov/avi/webm and not mkv; Google may still reject that container.
- Duration is not measured locally, so the pre-request cost estimate uses the
  60-second allowance rather than exact video tokens.

`pnpm build` and `pnpm dev` stay on the MacBook Pro.
