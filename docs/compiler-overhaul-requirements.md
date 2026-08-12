# Prompt Compiler Overhaul Requirements

This ledger converts the accepted brief into auditable evidence. A requirement
is complete only when the listed proof exists in the current repository or
runtime.

| Area         | Requirement                                                | Required proof                                        | State    |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Ground truth | Current repository component inventory                     | `docs/00-ground-truth.md` plus source links           | Complete |
| Ground truth | Current Raycast AI and extension API surface               | Official citations and installed declarations         | Complete |
| Ground truth | Current OpenAI and Anthropic directives                    | Explicit rule columns and separate application scopes | Complete |
| Ground truth | Vendor conflicts and target-tier mapping                   | Cited conflict table and dated target mapping         | Complete |
| Evaluation   | At least 60 labeled real cases and references              | Runnable corpus validation                            | Missing  |
| Evaluation   | Twelve anchored rubric dimensions                          | Schema and judge prompt tests                         | Partial  |
| Evaluation   | Calibrated cross-family judge                              | Human slice, agreement report, span citations         | Missing  |
| Evaluation   | Downstream fixture-repository evaluation                   | Real agent runs and outcome records                   | Missing  |
| Evaluation   | CI per-case regression gate                                | CI workflow and failing regression fixture            | Missing  |
| Pipeline     | Stages A through I have typed contracts                    | Pure functions and public behavior tests              | Missing  |
| Profiles     | Vendor, model-family, and effort-aware profile key         | Runtime resolver and schema validation                | Missing  |
| Profiles     | Supported branches and explicit exclusions                 | Profile provenance and rendered-output tests          | Missing  |
| Profiles     | Generic fallback and staleness check                       | Tests and independent profile evaluations             | Missing  |
| Safety       | Every Phase 4 defect class is detected                     | One failing test per defect class                     | Missing  |
| Optimization | Versioned block search with per-class results              | `docs/05-optimization-log.md` and run artifacts       | Missing  |
| Raycast      | Streaming, access gate, preferences, history, destinations | Captured MacBook runtime evidence                     | Missing  |
| Quality      | Strict TypeScript, structured model boundaries, retries    | Typecheck, tests, and failure-path checks             | Partial  |
| Telemetry    | Local-only stage and cache measurements                    | Typed store and privacy tests                         | Missing  |
| Verification | Unit, integration, classifier, adversarial, downstream     | Fresh complete run artifacts                          | Missing  |
| Delivery     | Logical commits and PR description                         | Git history and final PR text                         | Missing  |

## Completion rule

The overhaul remains incomplete while any accepted completion-gate requirement
lacks direct current evidence. A passing narrow test cannot prove a broader row.
