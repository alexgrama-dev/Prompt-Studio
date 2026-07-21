# Prompt Studio Complete Product Baseline

Date: 2026-07-19  
Updated: 2026-07-20  
Primary runtime: **MacBook Pro**  
Build and test mirror: **Mac Mini over SSH**

## What is now true

Every requested capability is represented by working shared-core, Raycast, CLI,
test, and documentation paths. The product is not turning all of them on at
once.

The MacBook's real activation state is:

| Capability group                           | Current state      |
| ------------------------------------------ | ------------------ |
| Portable Markdown store                    | Active             |
| Raycast visual library and exact search    | Active             |
| Rebuildable SQLite search                  | Active             |
| QMD meaning-based discovery                | Active             |
| OpenAI prompt enhancement                  | Active             |
| Local project context                      | Active             |
| Context7 version-specific documentation    | Active             |
| Current web research                       | Active             |
| Exa research                               | Active             |
| Official read-only GitHub MCP              | Disabled · skipped |
| Anthropic provider                         | Preview            |
| Google through outcome-backed optimization | Disabled           |

The final row represents Activations 10–15: Google, local CLI, read-only MCP,
MCP mutations, outcome feedback, and optimization.

Disabled means the feature stops before its protected data, credential, network,
or mutation boundary. The code is present and tested. Activation 8 is Disabled
because the user intentionally omitted it; Activations 10–15 remain Disabled
until their own prerequisites pass.

## MacBook-first architecture

```text
MacBook Raycast / Codex / Claude Code
                |
                +-> MacBook Markdown prompts and private support files
                +-> MacBook SQLite and QMD indexes
                +-> MacBook-local CLI and stdio MCP executables

Mac Mini <- source mirror over SSH -> build, test, lint, bundle, scan
```

Nothing in the product runtime calls SSH or waits for the Mini. The Mini-built
CLI and MCP bundles were copied back and executed locally on the MacBook. The
real Raycast extension was rendered and inspected on the MacBook.

## Product surfaces

Raycast now contains six native commands:

1. **Browse Prompts** — visual exact and meaning-based discovery, filters,
   details, favorites, history, staleness, and one-action copy.
2. **Create Prompt** — writes one portable validated Markdown record.
3. **Enhance Prompt** — rough thoughts, optional project/research routing,
   provider choice, preview, edit, and explicit save.
4. **Prompt Studio Status** — activation and verification visibility.
5. **Prompt Feedback** — optional immutable-version use evidence.
6. **Prompt Optimization** — visual evidence selection, transmission review,
   candidates, score import, measured proposal review, exact approval, and
   rollback.

The local CLI covers status, discovery, prompt mutations, enhancement, MCP
confirmation, feedback, and optimization over the same core. The local MCP
bundle exposes four bounded reads first and four separately gated,
request-token-bound mutations later. Delete is not an MCP tool.

## Verification summary

The latest Mini `pnpm check` passed:

- 54/54 shared unit and integration tests;
- one TypeScript workspace covering Raycast, shared core, CLI, MCP, evaluations,
  tests, and verification scripts;
- a credential-boundary regression check proving that CLI status output does
  not export provider keys from the process environment;
- TypeScript;
- ESLint with zero warnings;
- Raycast production build with all six commands;
- standalone CLI compilation;
- single-file MCP compilation;
- Disabled and Preview protocol probes;
- compiled feedback CLI proof;
- compiled optimization CLI proof.

Strict OpenSpec validation passed. Gitleaks scanned approximately 3 MB with
redaction enabled and found no leaks.

The MacBook independently passed:

- a 2026-07-20 rendered recheck of the real empty-library state, including its
  direct Create Prompt recovery action;
- a 2026-07-20 rendered recheck of the Enhancement Preview form and its
  `Run Standard Quality Evaluation` action;
- the authorized 24-case Standard evaluation, which completed without a
  provider or schema failure for an estimated $0.358664 against its $2.30
  maximum;
- the real blind-review list and manual seven-score rubric, both rendered
  without exposing provider or model;
- Alex's delegated 24-case qualitative review, which passed with a 98.67
  average, zero hard failures, and zero protected-case failures;
- the real project-agnostic enhance, preview, edit, approved save, browse, and
  copy flow, whose final provider request cost an estimated $0.0147;
- the populated library and meaning-only search result after repairing a
  concurrent QMD-refresh collision exposed by that save;
- the real Raycast **Prompt Feedback** Disabled screen;
- the real Raycast **Prompt Optimization** Disabled screen;
- Browse Prompts without a hidden feedback action while feedback is Disabled;
- the copied MCP Disabled and isolated mutation Preview probes;
- the copied compiled feedback CLI proof;
- the copied compiled optimization CLI proof;
- local CLI status without reading prompt data while the CLI is Disabled.

Subsequent activation checks used reviewed, bounded Context7, current-web, Exa,
and official GitHub MCP reads. No real project content was transmitted. The
Raycast simplicity check made one project-free OpenAI request for an estimated
$0.0179 and deliberately saved nothing. No commit was created.

## Raycast simplicity and polish

The MacBook Pro now verifies the common path as:

```text
describe the task -> optional project -> Enhance -> Save or Copy
```

- The default enhancement form shows only the task, target coding app,
  optional saved project, and one primary Enhance action.
- Model, provider, research depth, technical-library details, and one-run
  instructions appear only after **Customize Enhancement**.
- Choosing an arbitrary Git folder is a secondary action; saved projects remain
  a simple dropdown.
- The review screen offers **Save to Prompt Library** and **Copy Prompt**
  directly. Editing is optional rather than a required 14-field detour.
- The optional editor contains only title, summary, target, and prompt.
  Guardrails, sources, aliases, search terms, and taxonomy stay attached
  automatically.
- Manual Create Prompt hides tags, aliases, and extra search phrases behind
  **Edit Discovery Details**.
- Browse Prompts gives the narrow list column to titles alone. Summary, target,
  tags, project, file, and search-match explanation remain in the detail panel.
- A plain-language search for
  `agent benchmark evidence disagreements` selected the correct evaluation
  prompt and displayed `full text, meaning (QMD)` as the reason.

Rendered evidence:

![Simplified enhancement form](images/2026-07-20-raycast-simplified-enhance.png)

![Progressively disclosed customization](images/2026-07-20-raycast-customize-progressive.png)

![Optional manual discovery fields](images/2026-07-20-raycast-manual-discovery-details.png)

![Cleaner prompt library](images/2026-07-20-raycast-cleaner-library.png)

![Direct save or copy review](images/2026-07-20-raycast-direct-save-review.png)

![Compact optional editor](images/2026-07-20-raycast-compact-editor.png)

## Evidence by activation

`docs/verification/` contains one report for every numbered capability:

- foundation and SQLite search;
- QMD discovery;
- OpenAI enhancement;
- project context;
- Context7;
- current web;
- Exa;
- official GitHub MCP;
- Anthropic;
- Google;
- local CLI;
- read-only MCP;
- MCP mutations;
- feedback;
- optimization.

Each report states what is implemented, what was tested, what remains Disabled
or Preview, and what must pass before Active.

## Commands to resume

MacBook development:

```bash
cd ~/Developer/prompt-studio
pnpm dev
```

Mirror source and run the complete Mini check:

```bash
rsync -az \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'dist-cli/' \
  --exclude 'dist-mcp/' \
  ~/Developer/prompt-studio/ \
  mini:Developer/work/prompt-studio/

ssh mini zsh -s <<'REMOTE'
cd ~/Developer/work/prompt-studio
pnpm check
openspec validate build-prompt-studio --strict
gitleaks dir . --redact --no-banner
REMOTE
```

Copy the Mini-built local executables to the MacBook:

```bash
rsync -az mini:Developer/work/prompt-studio/dist-cli/ \
  ~/Developer/prompt-studio/dist-cli/
rsync -az mini:Developer/work/prompt-studio/dist-mcp/ \
  ~/Developer/prompt-studio/dist-mcp/
```

Inspect the real safe state without reading prompt content:

```bash
cd ~/Developer/prompt-studio
./dist-cli/cli/prompt-studio.mjs status --json
node --experimental-strip-types scripts/verify-mcp-bundle.mts
node --experimental-strip-types scripts/verify-feedback-cli.mts
node --experimental-strip-types scripts/verify-optimization-cli.mts
```

## Activation and rollback rule

Only the next eligible feature may move from Disabled to Preview or from Preview
to Active. A state change requires the dependency chain plus its feature report;
Active also requires a saved passing verification record.

OpenAI Enhancement, Local Project Context, Context7 Research, Current Web
Research, and Exa Research are Active. Activation 8, official read-only GitHub
MCP research, is Disabled and intentionally skipped by user choice. It performs
no GitHub work and is excluded from Activation 9's prerequisites.

Rollback is local:

- disable the affected feature without deleting prompts;
- restore prompt files from their preserved Markdown versions;
- rebuild disposable SQLite/QMD indexes from Markdown;
- remove or narrow coding-app MCP allowlists;
- for optimization, select a prior compiler-policy digest while preserving all
  later evidence.

## Intentionally unfinished acceptance

The OpenSpec's full Raycast state matrix remains open because activating every
Preview flow solely to manufacture screenshots would violate the one-at-a-time
rollout. Populated enhancement, project, research, feedback, and optimization
surfaces must be verified when their own activation becomes eligible and real
non-sensitive evidence exists.

The complete product remains built behind the activation controls, and
Activations 1–7 are Active with saved evidence. Activation 8 is intentionally
skipped, and Activation 9 is in Preview. The next live step is Anthropic's
24-case evaluation and activation checks.
