# Changelog

## [Initial Release] - {PR_MERGE_DATE}

- Browse, search, preview, create, edit, duplicate, archive, restore, and delete
  prompts stored as local Markdown files.
- Paste prompts into the frontmost application or copy them to the clipboard.
- Fill reusable `{{placeholders}}` before using a prompt.
- Copy ready prompts from the macOS menu bar, while prompts with placeholders
  open on the chosen prompt in the main library for completion.
- Enhance or optimize rough thoughts into a complete prompt, then review the
  result before saving it as Markdown or copying it.
- Ask for a provider key only when you submit an enhancement, not when the
  Store package first opens.
- Return every indexed library match instead of hiding matches after a fixed
  500-prompt ceiling.
- Keep usage ranking in a local JSON cache compatible with Raycast's runtime.
- Ignore advanced-feature settings from local development builds so the Store
  release always uses its compatible built-in search.
- Keep Prompt Library and Frequent Prompts local-only, with no Prompt Studio
  network request or account required.
