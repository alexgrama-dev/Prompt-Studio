# Product

## Register

product

## Users

Prompt Studio is for Alex first: a developer working across Codex, Claude Code,
Raycast, and terminal-based coding tools on a MacBook Pro, with a Mac mini used
as a remote build-and-test machine. The primary job is to find, improve, and
reuse the right coding prompt without remembering slash-command names or
managing prompt files by hand.

## Product Purpose

Prompt Studio turns a large prompt collection into a visual, searchable working
library. It converts rough thoughts into a complete prompt, optionally grounds
that prompt in a selected Git project and reviewed technical sources, generates
rich discovery metadata, and saves only the version the user approves.

Success means the common path feels like:

`rough thoughts -> optional project -> enhance -> review -> save or copy`

or, when the prompt already exists:

`existing prompt -> paste -> save unchanged`

The surface should stay small while the compiler, safety checks, source routing,
validation, and metadata generation handle the complexity behind it.

## Brand Personality

Simple, straightforward, smart. The product should feel calm and capable:
plain-language labels, strong defaults, visible evidence, and no need to
understand the machinery before getting a good result.

## Anti-references

- Slash-command-only prompt collections that require memorizing names.
- Configuration-heavy AI forms that expose model and research internals before
  the user can state the task.
- Chat interfaces that hide what was sent, invent facts, or save output without
  review.
- Decorative AI dashboards, nested cards, unexplained status labels, or
  marketing copy inside a working tool.

## Design Principles

1. One obvious job per screen. Enhancement starts with the task, not provider
   configuration.
2. Smart defaults first; optional control through progressive disclosure.
3. Trust through review. Show project files, sources, cost boundaries, and the
   final prompt before transmission or saving when they matter.
4. Practice what the product promises. Prompts are concise, discoverable,
   evidence-aware, and include reliable execution guardrails by default.
5. Keep ownership local. Markdown is recoverable, project reading is
   non-destructive, and optional services remain independently controlled.

## Accessibility & Inclusion

Use native Raycast controls and keyboard navigation, keep labels explicit,
preserve readable contrast, never rely on color alone for state, support reduced
motion through the host application, and keep essential cost, privacy, error,
and activation information available in plain language.
