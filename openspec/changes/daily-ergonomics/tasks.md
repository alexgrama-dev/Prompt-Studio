## 1. Usage-aware core

- [x] 1.1 Expose prompt usage statistics (use count, last used) from the SQLite index
- [x] 1.2 Order the default unsearched list by use recency and frequency with an updated-time fallback
- [x] 1.3 Cover usage ordering and missing-index fallback with shared tests

## 2. Paste-first use with placeholders

- [x] 2.1 Add placeholder extraction and filling for `{{name}}` variables in prompt bodies
- [x] 2.2 Make Paste the primary action and Copy the secondary action; both record a use event
- [x] 2.3 Collect placeholder values in a form before paste or copy when the body contains placeholders
- [x] 2.4 Cover placeholder parsing, filling, and empty-value behavior with shared tests

## 3. Quick Enhance entry

- [x] 3.1 Accept an optional rough-thoughts text argument on the Enhance Prompt command
- [x] 3.2 Prefill the form from the argument or Raycast fallback text

## 4. Menubar access

- [x] 4.1 Add a menubar command listing the five most-used prompts with copy on click
- [x] 4.2 Show a sensible empty state before any usage exists

## 5. Feedback nudge

- [x] 5.1 After repeated use of one prompt, show a passive toast suggesting feedback capture

## 6. Content pass

- [x] 6.1 Enrich aliases and hidden search terms of the five imported prompts without model calls
- [x] 6.2 Import a second curated batch of self-contained prompts

## 7. Verification

- [x] 7.1 Pass the full check gate on the Mac Mini mirror
  - 2026-07-21: exit 0 with 57/57 tests, typecheck, lint, all builds and probes.
- [ ] 7.2 Verify paste, ranking, placeholders, prefill, menubar, and nudge in Raycast on the MacBook
- [x] 7.3 Record a verification report
  - 2026-07-21: `docs/verification/2026-07-21-daily-ergonomics.md`; task 7.2 lists the five rendered checks that still need eyes.
