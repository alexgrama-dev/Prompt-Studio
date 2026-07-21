## ADDED Requirements

### Requirement: Optional project selection

The system SHALL discover Git repositories only within user-configured local
project roots and an optional user-configured SSH project root, and SHALL offer
None as a project-agnostic option.

#### Scenario: Select no project

- **WHEN** the user chooses None
- **THEN** the enhancer performs no repository inspection and creates no project binding

#### Scenario: Discover configured projects

- **WHEN** configured project roots contain Git repositories
- **THEN** the enhancement form offers those repositories without scanning unrelated home-directory locations

#### Scenario: Discover Mac Mini projects

- **WHEN** the configured SSH alias can read the configured Mac Mini project root
- **THEN** the enhancement form offers repositories under that exact root with a visible Mac Mini label

#### Scenario: Browse projects by location

- **WHEN** local and remote discovery completes
- **THEN** the project picker groups available repositories into Recent, MacBook, and Mac Mini sections
- **AND** a recently used repository is not duplicated in its machine section

#### Scenario: Mac Mini is unavailable

- **WHEN** SSH discovery fails or the Mac Mini is offline
- **THEN** local project discovery and project-agnostic enhancement remain available without retrying in the background
- **AND** the form explains that only Mac Mini projects are unavailable

#### Scenario: Choose a repository folder directly

- **WHEN** the user explicitly chooses a local Git repository folder that is outside the configured discovery roots
- **THEN** the enhancer may inspect only that exact repository for the current request without scanning its parent folders or adding them to configured discovery roots

#### Scenario: Choose a nested folder

- **WHEN** the user chooses a folder inside a Git repository instead of its root
- **THEN** the enhancer rejects it and asks for the repository root

### Requirement: Read-only repository inspection

The system SHALL inspect a selected repository without modifying files, Git
state, branches, remotes, issues, or external services.

#### Scenario: Build repository context

- **WHEN** a project is selected
- **THEN** the system reads applicable agent instructions, project documentation, dependency manifests, lockfiles, top-level structure, relevant files, available validation commands, branch, commit identifier, and relevant uncommitted-change summaries

#### Scenario: Enhancement fails

- **WHEN** project inspection or enhancement fails
- **THEN** the repository and its Git state remain unchanged

#### Scenario: Inspect a Mac Mini repository

- **WHEN** a Mac Mini repository is selected
- **THEN** the system uses the existing SSH connection for bounded read-only Git and file operations, without enabling a network file share or copying the repository

### Requirement: Bounded relevant context

The system SHALL send a small context bundle selected for the user's request
rather than the entire repository.

#### Scenario: Notes identify a file or symbol

- **WHEN** the rough thoughts name a file, symbol, feature, or error
- **THEN** the context bundle prioritizes directly matching files and nearby project instructions

#### Scenario: Context exceeds the configured limit

- **WHEN** relevant repository material exceeds the context limit
- **THEN** the system keeps higher-priority instructions and exact matches, records omitted categories, and does not truncate text silently mid-record

#### Scenario: A relevant source file exceeds the per-file limit

- **WHEN** a relevant UTF-8 source file is too large to include whole
- **THEN** the system may include a bounded, line-numbered excerpt around query matches, visibly marks omitted gaps, and scans the exact excerpt for secret-like values before transmission

### Requirement: Sensitive-file exclusion

The system SHALL exclude known credential files, private keys, generated
dependency directories, binary files, and detected secret-like values from
outbound model context.

#### Scenario: Repository contains an environment file

- **WHEN** a selected repository contains `.env` or equivalent credential files
- **THEN** those files are excluded from the context bundle

#### Scenario: Relevant file contains a likely secret

- **WHEN** a candidate text excerpt contains a detected secret-like value
- **THEN** the value is redacted or the excerpt is excluded before any network request

### Requirement: Context disclosure

The system SHALL show which repository files and repository-state facts will be
sent before project-aware enhancement begins.

#### Scenario: Review project context

- **WHEN** the user reaches the project-context review step
- **THEN** the system lists included file paths and allows project code to be excluded while retaining non-code metadata

### Requirement: Project binding and staleness

Saved project-aware prompts SHALL record the repository identity, branch, commit
identifier, and source file paths used.

#### Scenario: Project changed after prompt creation

- **WHEN** the current repository commit differs from the saved prompt binding
- **THEN** the prompt detail shows that its project context may be stale
