# MacBook Raycast verification sweep — 2026-08-01

Dev extension rebuilt from `main` @ 1609519 (includes CodeRabbit pass-2 fixes).
Older verification reports already covered most panels on 2026-07-29/30;
this sweep closes the five open task items below. Check each, then tick the
matching task in openspec/changes/*/tasks.md.

## 1. daily-ergonomics 7.2 — paste, ranking, placeholders, prefill, menubar, nudge

1. Open Raycast, type a query that exactly matches one active prompt title.
   Root Search should offer "Paste Top Prompt" fallback: press it. Prompt
   pastes into the frontmost app in ≤ `q + 2` keystrokes. (fast-daily-reuse 2.1)
2. Open Prompt Library. Confirm ranking: most-used prompts float to top
   (usage counts from paste/copy actions).
3. Find or make one prompt with a `{{placeholder}}`. Paste it: the fill form
   appears and shows the final body preview before paste.
4. Enhance Prompt: start from an existing prompt — the form prefills from it
   instead of opening empty.
5. Menu bar "Frequent Prompts Menu": open it, pick a prompt, it pastes.
6. Nudge: after several paste actions without feedback, the gentle
   feedback nudge appears once (not repeatedly).

## 2. simplify-raycast-navigation 4.3 — five launcher commands + action panels

Confirm all five commands appear in Raycast root search and open without
error: Prompt Library, Enhance Prompt, Capture Inbox, Quick Capture
(no-view: runs, shows HUD), Paste Top Prompt (no-view). In Prompt Library,
open a prompt's action panel: Paste is first, Copy second.

## 3. restore-live-project-access 2.3 — Project picker

Enhance Prompt → Load Projects (explicit choice, no scan before).
Picker lists real local repos; choosing one attaches project context.
Try an exact-folder choice too.

## 4. complete-enhancement-lifecycle 2.1/2.2 — draft clearing, save, history

Needs an OpenAI key in Raycast preferences (or one-run key):
1. Run one enhancement to completion.
2. Save it: recovery draft clears; saving again does not duplicate.
3. Enhancement History shows the record; cancel mid-flow leaves no
   half-saved prompt.
4. CLI two-step: `prompt-studio enhance` (prepare, then save after preview).

## 5. rough-ideas-workflow 2.2 — Capture Inbox (needs OpenAI key for AI title)

Capture a rough idea: AI-generated title appears in review; manual edit
works; repeat save is safe; delete asks for confirmation; idea hands off
to Enhance Prompt with text intact.

## 6. defer-optional-enhancement-work 2.1 — cold Enhance form

Open Enhance Prompt fresh: no project scan, no SSH request, Disabled
providers cannot be selected. Load Projects only on explicit choice.

## 7. search-runtime-reliability 2.1 — search states

In Prompt Library: type gibberish → clean no-match state (not an error);
toggle meaning search if QMD is running; exact-match fallback works with
QMD off.

## Blockers to record

- No OpenAI key in preferences blocks items 4 and 5 (AI title).
- fast-daily-reuse 2.1 keystroke count: note the actual count when doing
  item 1.
