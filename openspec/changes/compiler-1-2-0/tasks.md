## 1. Compiler revision

- [x] 1.1 Add the threshold-preservation rule to the base compiler instructions
- [x] 1.2 Make rendered-UI verification conditional in the Codex and Claude Code target adaptations and omit it for tasks that cannot change UI
- [x] 1.3 Restrict named technologies in tags, aliases, and hidden search phrases to those the user or supplied context named
- [x] 1.4 Bump `ENHANCEMENT_COMPILER_VERSION` to 1.2.0 and pin all three rules with a regression test

## 2. Verification

- [x] 2.1 Pass the full check gate on the Mac Mini mirror
  - 2026-07-23: exit 0 with 61/61 tests including the new compiler-rule regression test.
- [ ] 2.2 Re-run the frozen 24-case evaluation against compiler 1.2.0 and accept it as the new baseline (blocked on a one-run OPENAI_API_KEY)
