import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  closeMainWindow,
  Color,
  confirmAlert,
  Detail,
  Form,
  Icon,
  Keyboard,
  LaunchProps,
  List,
  LocalStorage,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { dirname } from "node:path";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createPrompt,
  deletePrompt,
  duplicatePrompt,
  enhancementHistoryDigest,
  enhancementHistoryDirectory,
  listPrompts,
  listPromptsReadOnly,
  listPromptVersions,
  promptRecordToDraft,
  resolvePromptDirectory,
  restorePromptVersion,
  saveEnhancementHistoryToLibrary,
  updatePrompt,
  type InvalidPrompt,
  type PromptRecord,
  type PromptUpdate,
} from "./core/prompt-store";
import {
  getFeatureStatus,
  loadFeatureStatuses,
  type FeatureState,
} from "./core/features";
import { getPromptStudioPreferences } from "./core/extension-preferences";
import { currentProjectCommit } from "./core/project-context";
import { detectPromptDrift } from "./core/library-intelligence";

/** Archived state, plus a warning when the bound repository has moved on. */
function promptAccessories(
  record: PromptRecord,
  commit: string | undefined,
): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];
  if (record.archivedAt) accessories.push({ tag: "Archived" });
  const drift = detectPromptDrift(record, commit ? { commit } : {});
  if (drift) {
    accessories.push({
      icon: { source: Icon.Warning, tintColor: Color.Orange },
      tooltip: drift.headline,
    });
  }
  return accessories;
}
import {
  fusePromptSearch,
  prepareQmdDiscovery,
  searchQmd,
} from "./core/qmd-search";
import {
  defaultSearchIndexPath,
  inspectSearchIndex,
  loadPromptUsage,
  recordPromptUse,
  searchPromptRecords,
  searchPrompts,
  shouldTrackPromptUsage,
  type SearchFilters,
  type SearchResult,
} from "./core/search-index";
import { extractPlaceholders, fillPlaceholders } from "./core/placeholders";
import {
  forgetRememberedPlaceholderValues,
  loadRememberedPlaceholderValues,
  saveRememberedPlaceholderValues,
} from "./core/placeholder-values";
import {
  quickRatingEnabled,
  recordLastLibraryPaste,
} from "./core/last-library-paste";
import {
  enhancePromptFromHistoryLaunchContext,
  enhancePromptLibraryLaunchContext,
  fallbackPromptDecision,
  ideaStudioLaunchContext,
  retainPromptSelectionWhileLoading,
  type BrowsePromptsLaunchContext,
} from "./core/launch-context";
import {
  browseEmptyState,
  CAPTURE_INBOX_ITEM_ID,
  ENHANCE_HISTORY_ITEM_ID,
  ENHANCE_PROMPT_ITEM_ID,
  LIBRARY_GROUP_STORAGE_KEY,
  LIBRARY_SORT_STORAGE_KEY,
  NEW_PROMPT_ITEM_ID,
  organizeLibraryPrompts,
  parseLibraryGroupMode,
  parseLibrarySortMode,
  selectedLibraryItemId,
  type BrowseEmptyState,
  type LibraryGroupMode,
  type LibraryPromptUsage,
  type LibrarySortMode,
} from "./core/browse-state";
import {
  commaSeparated,
  PromptForm,
  type PromptFormValues,
} from "./prompt-form";
import {
  createPromptUseFeedback,
  listPromptUseFeedback,
} from "./core/feedback-store";
import {
  enhancementHistoryMarkdown,
  enhancementHistoryMatches,
  enhancementHistoryRowSummary,
  enhancementHistoryTimestamp,
  withHistoryQuality,
} from "./core/enhancement-history";
import {
  buildFeedbackRevisionThoughts,
  feedbackRevisionCandidates,
} from "./core/feedback-revision";
import { FeedbackForm, feedbackDraftFromForm } from "./feedback-form";
import FeatureStatus from "./feature-status";
import {
  STUDIO_SCREENS_AVAILABLE,
  pushCaptureInbox,
  pushEnhancePrompt,
} from "./open-studio-views";
import { ratePromptQuality } from "./core/google-quality-score";
import { resolveProviderApiKey } from "./core/provider-keys";
import PromptFeedback from "./prompt-feedback";

type LibraryFilter =
  | "current"
  | "all"
  | "favorites"
  | `target:${PromptRecord["target"]}`
  | `project:${string}`
  | `tag:${string}`;

export default function BrowsePrompts({
  launchContext,
  fallbackText,
}: LaunchProps<{ launchContext: BrowsePromptsLaunchContext }>) {
  const { push } = useNavigation();
  const preferences = getPromptStudioPreferences();
  const directory = useMemo(() => {
    try {
      return resolvePromptDirectory(preferences.libraryDirectory);
    } catch {
      return undefined;
    }
  }, [preferences.libraryDirectory]);
  const [records, setRecords] = useState<PromptRecord[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    launchContext?.promptId ?? null,
  );
  const [invalid, setInvalid] = useState<InvalidPrompt[]>([]);
  const [filter, setFilter] = useState<LibraryFilter>("current");
  const [groupMode, setGroupMode] = useState<LibraryGroupMode>("purpose");
  const [sortMode, setSortMode] = useState<LibrarySortMode>("used");
  const [usage, setUsage] = useState<Map<string, LibraryPromptUsage>>(
    () => new Map(),
  );
  const [searchText, setSearchText] = useState(fallbackText ?? "");
  const [sqliteActive, setSqliteActive] = useState(false);
  const [qmdActive, setQmdActive] = useState(false);
  const [feedbackState, setFeedbackState] = useState<FeatureState>("disabled");
  const [enhancementEnabled, setEnhancementEnabled] = useState(false);
  const [semanticSearching, setSemanticSearching] = useState(false);
  const [indexedResults, setIndexedResults] = useState<SearchResult[]>();
  const [projectCommits, setProjectCommits] = useState<
    Map<string, string | undefined>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const handledFallback = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const resolvedDirectory =
        directory ?? resolvePromptDirectory(preferences.libraryDirectory);
      const statuses = await loadFeatureStatuses();
      const library = await listPrompts(resolvedDirectory);
      const indexIsConfigured =
        getFeatureStatus(statuses, "sqlite-search").effectiveState === "active";
      const indexIsReady =
        indexIsConfigured &&
        !inspectSearchIndex(defaultSearchIndexPath(), library.records)
          .needsRebuild;
      const projectContextEnabled =
        getFeatureStatus(statuses, "project-context").effectiveState !==
        "disabled";
      const qmdIsEnabled =
        getFeatureStatus(statuses, "qmd-discovery").effectiveState !==
        "disabled";
      setFeedbackState(getFeatureStatus(statuses, "feedback").effectiveState);
      setEnhancementEnabled(
        getFeatureStatus(statuses, "openai-enhancement").effectiveState !==
          "disabled",
      );
      setRecords(library.records);
      setInvalid(library.invalid);
      try {
        setUsage(loadPromptUsage());
      } catch {
        setUsage(new Map());
      }
      setSqliteActive(indexIsReady);
      setQmdActive(false);
      setLoading(false);
      void prepareQmdDiscovery(
        qmdIsEnabled,
        resolvedDirectory,
        library.records,
        preferences.qmdExecutable,
      )
        .then((health) => setQmdActive(health?.state === "healthy"))
        .catch((qmdError: unknown) =>
          showToast(
            Toast.Style.Failure,
            "Meaning Search Unavailable",
            `Using local search. ${qmdError instanceof Error ? qmdError.message : String(qmdError)}`,
          ),
        );
      if (projectContextEnabled) {
        const paths = [
          ...new Set(
            library.records.flatMap((record) =>
              record.project ? [record.project.path] : [],
            ),
          ),
        ];
        setProjectCommits(
          new Map(
            await Promise.all(
              paths.map(
                async (path) =>
                  [
                    path,
                    await currentProjectCommit(
                      path,
                      preferences.projectRoots,
                      preferences.sshProjectRoot,
                    ),
                  ] as const,
              ),
            ),
          ),
        );
      } else {
        setProjectCommits(new Map());
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError);
      setRecords([]);
      setInvalid([]);
      setIndexedResults([]);
      setUsage(new Map());
      setError(message);
      await showToast(Toast.Style.Failure, "Could Not Load Prompts", message);
    } finally {
      setLoading(false);
    }
  }, [
    directory,
    preferences.libraryDirectory,
    preferences.projectRoots,
    preferences.qmdExecutable,
    preferences.sshProjectRoot,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void LocalStorage.getItem<string>(LIBRARY_GROUP_STORAGE_KEY).then(
      (value) => {
        setGroupMode(parseLibraryGroupMode(value));
      },
    );
    void LocalStorage.getItem<string>(LIBRARY_SORT_STORAGE_KEY).then(
      (value) => {
        setSortMode(parseLibrarySortMode(value));
      },
    );
  }, []);

  const persistGroupMode = useCallback((mode: LibraryGroupMode) => {
    setGroupMode(mode);
    void LocalStorage.setItem(LIBRARY_GROUP_STORAGE_KEY, mode);
  }, []);
  const persistSortMode = useCallback((mode: LibrarySortMode) => {
    setSortMode(mode);
    void LocalStorage.setItem(LIBRARY_SORT_STORAGE_KEY, mode);
  }, []);

  useEffect(() => {
    if (handledFallback.current || loading || error || !fallbackText?.trim()) {
      return;
    }
    handledFallback.current = true;
    const decision = fallbackPromptDecision(records, fallbackText);
    if (decision.kind === "none") return;
    const usePrompt = (body: string, mode: "paste" | "copy") =>
      useLibraryPrompt(
        decision.record,
        body,
        mode,
        shouldTrackPromptUsage(sqliteActive),
        feedbackState,
      );
    if (decision.kind === "review") {
      setSelectedPromptId(decision.record.id);
      push(
        <PlaceholderForm
          record={decision.record}
          placeholders={extractPlaceholders(decision.record.body)}
          onUse={usePrompt}
        />,
      );
      return;
    }
    void usePrompt(decision.record.body, "paste").catch(
      async (pasteError: unknown) => {
        await showToast(
          Toast.Style.Failure,
          "Could Not Paste Prompt",
          pasteError instanceof Error ? pasteError.message : String(pasteError),
        );
      },
    );
  }, [
    error,
    fallbackText,
    feedbackState,
    loading,
    push,
    records,
    sqliteActive,
  ]);

  useEffect(() => {
    let cancelled = false;
    const filters = searchFilters(filter, records.length);
    let exact: SearchResult[];
    if (sqliteActive) {
      try {
        exact = searchPrompts(searchText, filters, defaultSearchIndexPath());
      } catch (searchError) {
        exact = searchPromptRecords(records, searchText, filters);
        setSqliteActive(false);
        void showToast(
          Toast.Style.Failure,
          "SQLite Search Unavailable",
          `Using Markdown search. ${searchError instanceof Error ? searchError.message : String(searchError)}`,
        );
      }
    } else {
      exact = searchPromptRecords(records, searchText, filters);
    }
    setIndexedResults(exact);
    if (!qmdActive || searchText.trim().length < 2) {
      setSemanticSearching(false);
      return;
    }
    setSemanticSearching(true);
    void searchQmd(searchText, preferences.qmdExecutable)
      .then((semantic) => {
        if (cancelled) return;
        const recordsById = new Map(
          records.map((record) => [record.id, record]),
        );
        const filteredSemantic = semantic.filter((result) => {
          const record = recordsById.get(result.id);
          return record ? recordMatchesFilter(record, filter) : false;
        });
        setIndexedResults(fusePromptSearch(exact, filteredSemantic));
      })
      .catch((qmdError: unknown) => {
        if (cancelled) return;
        setQmdActive(false);
        void showToast(
          Toast.Style.Failure,
          "Meaning Search Unavailable",
          `Using local search. ${qmdError instanceof Error ? qmdError.message : String(qmdError)}`,
        );
      })
      .finally(() => {
        if (!cancelled) setSemanticSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    filter,
    preferences.qmdExecutable,
    qmdActive,
    records,
    searchText,
    sqliteActive,
  ]);

  const visible = useMemo(() => {
    if (indexedResults) {
      const byId = new Map(records.map((record) => [record.id, record]));
      return indexedResults.flatMap((result) => {
        const record = byId.get(result.id);
        return record ? [record] : [];
      });
    }
    return records.filter((record) => recordMatchesFilter(record, filter));
  }, [filter, indexedResults, records]);
  const sections = useMemo(
    () =>
      organizeLibraryPrompts(visible, {
        groupMode,
        sortMode,
        usage,
        ...(searchText.trim() && sortMode !== "title"
          ? { preserveSearchOrder: true }
          : {}),
      }),
    [groupMode, searchText, sortMode, usage, visible],
  );
  const arrangedIds = useMemo(
    () =>
      sections.flatMap((section) =>
        section.records.map((record) => record.id),
      ),
    [sections],
  );
  const arrangementActions = (
    <LibraryArrangementActions
      groupMode={groupMode}
      sortMode={sortMode}
      onGroupModeChange={persistGroupMode}
      onSortModeChange={persistSortMode}
    />
  );
  const matchesById = useMemo(
    () =>
      new Map(
        (indexedResults ?? []).map((result) => [
          result.id,
          result.matchedBy.join(", "),
        ]),
      ),
    [indexedResults],
  );
  const projects = useMemo(
    () =>
      [
        ...new Map(
          records
            .filter((record) => record.project)
            .map((record) => [record.project!.path, record.project!]),
        ).values(),
      ].sort((left, right) => left.name.localeCompare(right.name)),
    [records],
  );
  const taskTypes = useMemo(
    () => [...new Set(records.flatMap((record) => record.tags))].sort(),
    [records],
  );
  const emptyState = browseEmptyState({
    loading: loading || semanticSearching,
    ...(error ? { error } : {}),
    recordCount: records.length,
    visibleCount: visible.length + invalid.length,
    query: searchText,
  });
  const showEnhanceRow =
    STUDIO_SCREENS_AVAILABLE &&
    enhancementEnabled &&
    emptyState !== "load-failure" &&
    emptyState !== "empty-library";
  const showCaptureRow =
    STUDIO_SCREENS_AVAILABLE &&
    emptyState !== "load-failure" &&
    emptyState !== "empty-library";
  const showNewPromptRow =
    Boolean(directory) &&
    emptyState !== "load-failure" &&
    emptyState !== "empty-library";
  const showEnhanceHistoryRow = showNewPromptRow;
  const studioRowIds = [
    ...(showEnhanceRow ? [ENHANCE_PROMPT_ITEM_ID] : []),
    ...(showCaptureRow ? [CAPTURE_INBOX_ITEM_ID] : []),
    ...(showNewPromptRow ? [NEW_PROMPT_ITEM_ID] : []),
    ...(showEnhanceHistoryRow ? [ENHANCE_HISTORY_ITEM_ID] : []),
  ];
  const selectedItemId = selectedLibraryItemId(
    selectedPromptId,
    arrangedIds,
    studioRowIds,
  );

  return (
    <List
      isLoading={loading || semanticSearching}
      isShowingDetail={
        visible.length + invalid.length > 0 || studioRowIds.length > 0
      }
      filtering={false}
      {...(selectedItemId ? { selectedItemId } : {})}
      onSelectionChange={(nextId) =>
        setSelectedPromptId((currentId) =>
          retainPromptSelectionWhileLoading(currentId, nextId, loading),
        )
      }
      onSearchTextChange={setSearchText}
      searchText={searchText}
      throttle
      searchBarPlaceholder="Search prompts… · ⌘N saves without AI"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Prompts"
          value={filter}
          onChange={(value) => {
            if (value.startsWith("group:")) {
              persistGroupMode(
                parseLibraryGroupMode(value.slice("group:".length)),
              );
              return;
            }
            if (value.startsWith("sort:")) {
              persistSortMode(
                parseLibrarySortMode(value.slice("sort:".length)),
              );
              return;
            }
            setFilter(value as LibraryFilter);
          }}
        >
          <List.Dropdown.Item title="Active Prompts" value="current" />
          <List.Dropdown.Item title="Favorites" value="favorites" />
          <List.Dropdown.Item title="All Prompts" value="all" />
          <List.Dropdown.Section title="Target">
            <List.Dropdown.Item title="Generic" value="target:generic" />
            <List.Dropdown.Item title="Codex" value="target:codex" />
            <List.Dropdown.Item
              title="Claude Code"
              value="target:claude-code"
            />
          </List.Dropdown.Section>
          {projects.length > 0 ? (
            <List.Dropdown.Section title="Project">
              {projects.map((project) => (
                <List.Dropdown.Item
                  key={project.path}
                  title={project.name}
                  value={`project:${project.path}`}
                />
              ))}
            </List.Dropdown.Section>
          ) : null}
          {taskTypes.length > 0 ? (
            <List.Dropdown.Section title="Task Type or Tag">
              {taskTypes.map((tag) => (
                <List.Dropdown.Item
                  key={tag}
                  title={tag}
                  value={`tag:${tag}`}
                />
              ))}
            </List.Dropdown.Section>
          ) : null}
          <List.Dropdown.Section title="Group">
            <List.Dropdown.Item title="Purpose" value="group:purpose" />
            <List.Dropdown.Item title="Content" value="group:content" />
            <List.Dropdown.Item title="No Groups" value="group:none" />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Sort">
            <List.Dropdown.Item title="Most Used" value="sort:used" />
            <List.Dropdown.Item title="Recently Updated" value="sort:updated" />
            <List.Dropdown.Item title="Title" value="sort:title" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {emptyState && studioRowIds.length === 0 ? (
        <List.EmptyView
          icon={Icon.TextDocument}
          title={
            emptyState === "load-failure"
              ? "Prompt Library Unavailable"
              : emptyState === "empty-library"
                ? "No Prompts Yet"
                : emptyState === "no-results"
                  ? "No Matching Prompt"
                  : "No Prompts in This View"
          }
          description={
            emptyState === "load-failure"
              ? (error ?? "Reload the prompt library or review its directory.")
              : emptyState === "empty-library"
                ? "Save your first reusable prompt here."
                : emptyState === "no-results"
                  ? `Nothing matches “${searchText.trim()}”. Keep searching, enhance it, or capture it as an idea.`
                  : "Choose another filter to see the rest of your prompt library."
          }
          actions={
            <ActionPanel>
              {emptyState === "load-failure" ? (
                <>
                  <Action
                    title="Reload Prompt Library"
                    icon={Icon.ArrowClockwise}
                    onAction={load}
                  />
                  <Action
                    title="Open Extension Preferences"
                    icon={Icon.Gear}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
                    onAction={openExtensionPreferences}
                  />
                </>
              ) : emptyState === "empty-library" ? (
                <>
                  <NewPromptAction directory={directory} onCreate={load} />
                  <StudioScreenActions
                    searchText={searchText}
                    fallbackText={fallbackText}
                    enhancementEnabled={enhancementEnabled}
                    directory={directory}
                    onCreate={load}
                  />
                </>
              ) : emptyState === "no-results" ? (
                <>
                  <StudioScreenActions
                    searchText={searchText}
                    fallbackText={fallbackText}
                    enhancementEnabled={enhancementEnabled}
                    directory={directory}
                    onCreate={load}
                  />
                  <Action
                    title="Clear Search"
                    icon={Icon.XMarkCircle}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
                    onAction={() => setSearchText("")}
                  />
                </>
              ) : (
                <>
                  <Action
                    title="Show All Prompts"
                    icon={Icon.List}
                    onAction={() => setFilter("all")}
                  />
                  <StudioScreenActions
                    searchText={searchText}
                    fallbackText={fallbackText}
                    enhancementEnabled={enhancementEnabled}
                    directory={directory}
                    onCreate={load}
                  />
                </>
              )}
              <Action.Push
                title="Prompt Studio Status"
                icon={Icon.Gauge}
                shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
                target={<FeatureStatus />}
              />
            </ActionPanel>
          }
        />
      ) : null}
      {studioRowIds.length > 0 ? (
        <List.Section>
          {showEnhanceRow ? (
            <EnhancePromptListItem
              searchText={searchText}
              fallbackText={fallbackText}
              emptyState={emptyState}
              directory={directory}
              onCreate={load}
              onClearSearch={() => setSearchText("")}
              onShowAll={() => setFilter("all")}
              arrangementActions={arrangementActions}
            />
          ) : null}
          {showCaptureRow ? (
            <CaptureInboxListItem
              searchText={searchText}
              emptyState={emptyState}
              directory={directory}
              onCreate={load}
              onClearSearch={() => setSearchText("")}
              onShowAll={() => setFilter("all")}
              arrangementActions={arrangementActions}
            />
          ) : null}
          {showNewPromptRow && directory ? (
            <NewPromptListItem
              directory={directory}
              emptyState={emptyState}
              onCreate={load}
              onClearSearch={() => setSearchText("")}
              onShowAll={() => setFilter("all")}
              arrangementActions={arrangementActions}
            />
          ) : null}
          {showEnhanceHistoryRow && directory ? (
            <EnhanceHistoryStudioListItem
              directory={directory}
              emptyState={emptyState}
              enhancementEnabled={enhancementEnabled}
              onCreate={load}
              onClearSearch={() => setSearchText("")}
              onShowAll={() => setFilter("all")}
              arrangementActions={arrangementActions}
            />
          ) : null}
        </List.Section>
      ) : null}
      {sections.map((section) => (
        <List.Section
          key={section.title}
          title={section.title}
          subtitle={`${section.records.length}`}
        >
          {section.records.map((record) => (
            <PromptItem
              key={record.id}
              record={record}
              searchText={searchText}
              fallbackText={fallbackText}
              enhancementEnabled={enhancementEnabled}
              matchReason={
                searchText.trim() ? matchesById.get(record.id) : undefined
              }
              trackUsage={shouldTrackPromptUsage(sqliteActive)}
              feedbackState={feedbackState}
              currentProjectCommit={
                record.project
                  ? projectCommits.get(record.project.path)
                  : undefined
              }
              onReload={load}
              arrangementActions={arrangementActions}
            />
          ))}
        </List.Section>
      ))}
      {invalid.length > 0 ? (
        <List.Section title="Needs Repair" subtitle={`${invalid.length}`}>
          {invalid.map((item) => (
            <List.Item
              key={item.filePath}
              icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
              title={item.filePath.split("/").at(-1) ?? item.filePath}
              subtitle={item.error}
              detail={
                <List.Item.Detail
                  markdown={`# Invalid Prompt File\n\n${item.error}\n\n\`${item.filePath}\``}
                />
              }
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function LibraryArrangementActions({
  groupMode,
  sortMode,
  onGroupModeChange,
  onSortModeChange,
}: {
  groupMode: LibraryGroupMode;
  sortMode: LibrarySortMode;
  onGroupModeChange: (mode: LibraryGroupMode) => void;
  onSortModeChange: (mode: LibrarySortMode) => void;
}) {
  return (
    <>
      <Action
        title="Group by Purpose"
        icon={groupMode === "purpose" ? Icon.CheckCircle : Icon.Circle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "g" }}
        onAction={() => onGroupModeChange("purpose")}
      />
      <Action
        title="Group by Content"
        icon={groupMode === "content" ? Icon.CheckCircle : Icon.Circle}
        onAction={() => onGroupModeChange("content")}
      />
      <Action
        title="No Groups"
        icon={groupMode === "none" ? Icon.CheckCircle : Icon.Circle}
        onAction={() => onGroupModeChange("none")}
      />
      <Action
        title="Sort by Most Used"
        icon={sortMode === "used" ? Icon.CheckCircle : Icon.Circle}
        onAction={() => onSortModeChange("used")}
      />
      <Action
        title="Sort by Recently Updated"
        icon={sortMode === "updated" ? Icon.CheckCircle : Icon.Circle}
        onAction={() => onSortModeChange("updated")}
      />
      <Action
        title="Sort by Title"
        icon={sortMode === "title" ? Icon.CheckCircle : Icon.Circle}
        onAction={() => onSortModeChange("title")}
      />
    </>
  );
}

function EnhancePromptListItem({
  searchText,
  fallbackText,
  emptyState,
  directory,
  onCreate,
  onClearSearch,
  onShowAll,
  arrangementActions,
}: {
  searchText: string;
  fallbackText?: string | undefined;
  emptyState: BrowseEmptyState | undefined;
  directory: string | undefined;
  onCreate: () => Promise<void>;
  onClearSearch: () => void;
  onShowAll: () => void;
  arrangementActions: ReactNode;
}) {
  const { push } = useNavigation();
  const thoughts = searchText.trim();
  return (
    <List.Item
      id={ENHANCE_PROMPT_ITEM_ID}
      icon={Icon.Wand}
      title="Enhance Prompt"
      detail={<List.Item.Detail markdown="# Enhance Prompt" />}
      actions={
        <ActionPanel>
          <Action
            title="Enhance Prompt"
            icon={Icon.Wand}
            onAction={() =>
              void pushEnhancePrompt(
                push,
                thoughts
                  ? {
                      launchContext: enhancePromptLibraryLaunchContext(
                        thoughts,
                        fallbackText,
                      ),
                    }
                  : {},
              )
            }
          />
          <NewPromptAction directory={directory} onCreate={onCreate} />
          {arrangementActions}
          <StudioRowExtraActions
            emptyState={emptyState}
            onClearSearch={onClearSearch}
            onShowAll={onShowAll}
          />
        </ActionPanel>
      }
    />
  );
}

function CaptureInboxListItem({
  searchText,
  emptyState,
  directory,
  onCreate,
  onClearSearch,
  onShowAll,
  arrangementActions,
}: {
  searchText: string;
  emptyState: BrowseEmptyState | undefined;
  directory: string | undefined;
  onCreate: () => Promise<void>;
  onClearSearch: () => void;
  onShowAll: () => void;
  arrangementActions: ReactNode;
}) {
  const { push } = useNavigation();
  const thoughts = searchText.trim();
  return (
    <List.Item
      id={CAPTURE_INBOX_ITEM_ID}
      icon={Icon.LightBulb}
      title="Capture Inbox"
      detail={<List.Item.Detail markdown="# Capture Inbox" />}
      actions={
        <ActionPanel>
          <Action
            title="Capture Inbox"
            icon={Icon.LightBulb}
            shortcut={{ modifiers: ["cmd"], key: "i" }}
            onAction={() =>
              void pushCaptureInbox(
                push,
                thoughts
                  ? { launchContext: ideaStudioLaunchContext(thoughts) }
                  : {},
              )
            }
          />
          <NewPromptAction directory={directory} onCreate={onCreate} />
          {arrangementActions}
          <StudioRowExtraActions
            emptyState={emptyState}
            onClearSearch={onClearSearch}
            onShowAll={onShowAll}
          />
        </ActionPanel>
      }
    />
  );
}

function NewPromptListItem({
  directory,
  emptyState,
  onCreate,
  onClearSearch,
  onShowAll,
  arrangementActions,
}: {
  directory: string;
  emptyState: BrowseEmptyState | undefined;
  onCreate: () => Promise<void>;
  onClearSearch: () => void;
  onShowAll: () => void;
  arrangementActions: ReactNode;
}) {
  return (
    <List.Item
      id={NEW_PROMPT_ITEM_ID}
      icon={Icon.Plus}
      title="New Prompt"
      detail={<List.Item.Detail markdown="# New Prompt" />}
      actions={
        <ActionPanel>
          <NewPromptAction directory={directory} onCreate={onCreate} />
          {arrangementActions}
          <StudioRowExtraActions
            emptyState={emptyState}
            onClearSearch={onClearSearch}
            onShowAll={onShowAll}
          />
        </ActionPanel>
      }
    />
  );
}

function EnhanceHistoryStudioListItem({
  directory,
  emptyState,
  enhancementEnabled,
  onCreate,
  onClearSearch,
  onShowAll,
  arrangementActions,
}: {
  directory: string;
  emptyState: BrowseEmptyState | undefined;
  enhancementEnabled: boolean;
  onCreate: () => Promise<void>;
  onClearSearch: () => void;
  onShowAll: () => void;
  arrangementActions: ReactNode;
}) {
  return (
    <List.Item
      id={ENHANCE_HISTORY_ITEM_ID}
      icon={Icon.Clock}
      title="Enhance History"
      detail={<List.Item.Detail markdown="# Enhance History" />}
      actions={
        <ActionPanel>
          <Action.Push
            title="Enhance History"
            icon={Icon.Clock}
            target={
              <EnhanceHistoryScreen
                directory={directory}
                enhancementEnabled={enhancementEnabled}
                onLibraryChange={onCreate}
              />
            }
          />
          <NewPromptAction directory={directory} onCreate={onCreate} />
          {arrangementActions}
          <StudioRowExtraActions
            emptyState={emptyState}
            onClearSearch={onClearSearch}
            onShowAll={onShowAll}
          />
        </ActionPanel>
      }
    />
  );
}

function EnhanceHistoryListItem({
  record,
  directory,
  savedToLibrary,
  linkedPromptId,
  usage,
  enhancementEnabled,
  onReload,
}: {
  record: PromptRecord;
  directory: string;
  savedToLibrary: boolean;
  linkedPromptId?: string;
  usage: LibraryPromptUsage | undefined;
  enhancementEnabled: boolean;
  onReload: () => Promise<void>;
}) {
  const { push } = useNavigation();
  const quality = record.enhancement?.quality;
  const used = Boolean(usage);
  const rowOptions = {
    savedToLibrary,
    used,
    ...(usage ? { useCount: usage.useCount } : {}),
  };
  const accessories: List.Item.Accessory[] = [];
  if (quality) {
    accessories.push({
      tag: {
        value: `${quality.score}/10`,
        color: quality.score < 7 ? Color.Orange : Color.Green,
      },
      tooltip: quality.rationale,
    });
  }
  accessories.push({ date: enhancementHistoryTimestamp(record) });

  async function enhanceAgain() {
    try {
      await pushEnhancePrompt(push, {
        launchContext: enhancePromptFromHistoryLaunchContext(
          record,
          linkedPromptId,
        ),
      });
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Open Enhance",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function scoreThisPrompt() {
    const statuses = await loadFeatureStatuses();
    if (
      getFeatureStatus(statuses, "google-provider").effectiveState ===
      "disabled"
    ) {
      await showToast(
        Toast.Style.Failure,
        "Google Provider Is Disabled",
        "Enable Google in Feature Status before scoring.",
      );
      return;
    }
    const apiKey = resolveProviderApiKey(
      getPromptStudioPreferences(),
      "googleApiKey",
    );
    if (!apiKey) {
      await showToast(
        Toast.Style.Failure,
        "Google API Key Required",
        "Add a Google API key in Prompt Studio preferences.",
      );
      await openExtensionPreferences();
      return;
    }
    const thoughts = record.seed?.thoughts?.trim() || record.body;
    const toast = await showToast(
      Toast.Style.Animated,
      "Scoring Prompt",
      "Gemini 3.7 Flash 1-10",
    );
    try {
      const rated = await ratePromptQuality(
        {
          roughThoughts: thoughts,
          enhancedPrompt: record.body,
          target: record.target,
        },
        { apiKey },
      );
      await updatePrompt(
        enhancementHistoryDirectory(directory),
        record.id,
        {
          ...promptRecordToDraft(record),
          enhancement: withHistoryQuality(record.enhancement, rated),
        },
        { syncSearchIndex: false },
      );
      toast.style = Toast.Style.Success;
      toast.title = `Quality ${rated.score}/10`;
      toast.message = rated.rationale;
      await onReload();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could Not Score Prompt";
      toast.message = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveToLibrary() {
    try {
      await saveEnhancementHistoryToLibrary(
        directory,
        record.id,
        enhancementHistoryDigest(record),
      );
      await showToast(Toast.Style.Success, "Saved to Prompt Library");
      await onReload();
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Prompt",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function pasteHistory() {
    await closeMainWindow();
    await Clipboard.paste(record.body);
    await showHUD("Enhanced Prompt Pasted");
  }

  return (
    <List.Item
      id={record.id}
      icon={Icon.Clock}
      title={record.title}
      subtitle={enhancementHistoryRowSummary(record, rowOptions)}
      accessories={accessories}
      detail={
        <List.Item.Detail
          markdown={enhancementHistoryMarkdown(record, rowOptions)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Saved"
                text={savedToLibrary ? "Yes" : "No"}
              />
              <List.Item.Detail.Metadata.Label
                title="Used"
                text={
                  used
                    ? usage
                      ? `Yes (${usage.useCount})`
                      : "Yes"
                    : "No"
                }
              />
              <List.Item.Detail.Metadata.Label
                title="Score"
                text={quality ? `${quality.score}/10` : "None"}
              />
              {quality?.rationale ? (
                <List.Item.Detail.Metadata.Label
                  title="Quality reason"
                  text={quality.rationale}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label
                title="Model"
                text={record.enhancement?.model ?? "Unknown"}
              />
              <List.Item.Detail.Metadata.Label
                title="Cost"
                text={
                  record.enhancement?.estimatedCostUsd === undefined
                    ? "Unknown"
                    : `$${record.enhancement.estimatedCostUsd.toFixed(4)}`
                }
              />
              <List.Item.Detail.Metadata.Label
                title="Generated"
                text={enhancementHistoryTimestamp(record).toLocaleString()}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          {enhancementEnabled ? (
            <Action
              title="Enhance Again"
              icon={Icon.Wand}
              shortcut={Keyboard.Shortcut.Common.Edit}
              onAction={() => void enhanceAgain()}
            />
          ) : null}
          <Action
            title={quality ? "Re-Score This Prompt" : "Score This Prompt"}
            icon={Icon.Star}
            shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
            onAction={() => void scoreThisPrompt()}
          />
          <Action
            title="Paste in Active App"
            icon={Icon.ArrowRightCircle}
            onAction={() => void pasteHistory()}
          />
          <Action.CopyToClipboard title="Copy Prompt" content={record.body} />
          {savedToLibrary ? null : (
            <Action
              title="Save to Prompt Library"
              icon={Icon.CheckCircle}
              onAction={() => void saveToLibrary()}
            />
          )}
        </ActionPanel>
      }
    />
  );
}

function StudioRowExtraActions({
  emptyState,
  onClearSearch,
  onShowAll,
}: {
  emptyState: BrowseEmptyState | undefined;
  onClearSearch: () => void;
  onShowAll: () => void;
}) {
  return (
    <>
      {emptyState === "no-results" ? (
        <Action
          title="Clear Search"
          icon={Icon.XMarkCircle}
          shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
          onAction={onClearSearch}
        />
      ) : null}
      {emptyState === "filtered-empty" ? (
        <Action
          title="Show All Prompts"
          icon={Icon.List}
          onAction={onShowAll}
        />
      ) : null}
    </>
  );
}

function NewPromptAction({
  directory,
  onCreate,
}: {
  directory: string | undefined;
  onCreate: () => Promise<void>;
}) {
  if (!directory) {
    return (
      <Action.Push
        title="Review Prompt Directory"
        icon={Icon.ExclamationMark}
        target={
          <Detail
            navigationTitle="Prompt Directory"
            markdown="# Prompt Directory Is Invalid\n\nUse an absolute path or a path beginning with ~/ in Prompt Studio preferences."
          />
        }
      />
    );
  }
  return (
    <Action.Push
      title="New Prompt"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<CreateFromLibrary directory={directory} onCreate={onCreate} />}
    />
  );
}

function CreateFromLibrary({
  directory,
  onCreate,
}: {
  directory: string;
  onCreate: () => Promise<void>;
}) {
  const { pop } = useNavigation();
  return (
    <PromptForm
      navigationTitle="New Prompt"
      submitTitle="Save Unchanged"
      onSubmit={async (values) => {
        await createPrompt(directory, {
          title: values.title,
          summary: values.summary,
          body: values.body,
          target: values.target,
          tags: commaSeparated(values.tags),
          aliases: commaSeparated(values.aliases),
          searchTerms: commaSeparated(values.searchTerms),
        });
        await onCreate();
        await showToast(Toast.Style.Success, "Prompt Saved Unchanged");
        pop();
      }}
    />
  );
}

function EnhanceHistoryScreen({
  directory,
  enhancementEnabled,
  onLibraryChange,
}: {
  directory: string;
  enhancementEnabled: boolean;
  onLibraryChange: () => Promise<void>;
}) {
  const [history, setHistory] = useState<PromptRecord[]>([]);
  const [library, setLibrary] = useState<PromptRecord[]>([]);
  const [usage, setUsage] = useState<Map<string, LibraryPromptUsage>>(
    () => new Map(),
  );
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let listedRecords: PromptRecord[] = [];
    try {
      listedRecords = (await listPromptsReadOnly(directory)).records;
    } catch {
      listedRecords = [];
    }
    let historyRecords: PromptRecord[] = [];
    try {
      historyRecords = (
        await listPromptsReadOnly(enhancementHistoryDirectory(directory))
      ).records;
    } catch {
      historyRecords = [];
    }
    setLibrary(listedRecords);
    setHistory(historyRecords);
    try {
      setUsage(loadPromptUsage());
    } catch {
      setUsage(new Map());
    }
    setLoading(false);
  }, [directory]);

  useEffect(() => {
    void load();
  }, [load]);

  const libraryByHistoryId = useMemo(() => {
    const map = new Map<string, PromptRecord>();
    for (const record of library) {
      if (record.enhancementHistory) {
        map.set(record.enhancementHistory.id, record);
      }
    }
    return map;
  }, [library]);
  const visibleHistory = useMemo(
    () =>
      history.filter((record) =>
        enhancementHistoryMatches(record, searchText),
      ),
    [history, searchText],
  );

  async function reloadAll() {
    await load();
    await onLibraryChange();
  }

  return (
    <List
      isLoading={loading}
      isShowingDetail={visibleHistory.length > 0}
      filtering={false}
      navigationTitle="Enhance History"
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      searchBarPlaceholder="Search enhance history…"
    >
      {!loading && visibleHistory.length === 0 ? (
        <List.EmptyView
          icon={Icon.Clock}
          title={
            searchText.trim()
              ? "No Matching History"
              : "No Enhance History"
          }
        />
      ) : null}
      {visibleHistory.map((record) => {
        const linked = libraryByHistoryId.get(record.id);
        return (
          <EnhanceHistoryListItem
            key={record.id}
            record={record}
            directory={directory}
            savedToLibrary={Boolean(linked)}
            {...(linked ? { linkedPromptId: linked.id } : {})}
            usage={linked ? usage.get(linked.id) : undefined}
            enhancementEnabled={enhancementEnabled}
            onReload={reloadAll}
          />
        );
      })}
    </List>
  );
}

function StudioScreenActions({
  searchText,
  fallbackText,
  enhancementEnabled,
  directory,
  onCreate,
}: {
  searchText: string;
  fallbackText?: string | undefined;
  enhancementEnabled: boolean;
  directory: string | undefined;
  onCreate: () => Promise<void>;
}) {
  const { push } = useNavigation();
  const thoughts = searchText.trim();
  return (
    <>
      {STUDIO_SCREENS_AVAILABLE && enhancementEnabled ? (
        <Action
          title="Enhance Prompt"
          icon={Icon.Wand}
          onAction={() =>
            void pushEnhancePrompt(
              push,
              thoughts
                ? {
                    launchContext: enhancePromptLibraryLaunchContext(
                      thoughts,
                      fallbackText,
                    ),
                  }
                : {},
            )
          }
        />
      ) : null}
      {STUDIO_SCREENS_AVAILABLE ? (
        <Action
          title="Open Capture Inbox"
          icon={Icon.LightBulb}
          shortcut={{ modifiers: ["cmd"], key: "i" }}
          onAction={() =>
            void pushCaptureInbox(
              push,
              thoughts
                ? { launchContext: ideaStudioLaunchContext(thoughts) }
                : {},
            )
          }
        />
      ) : null}
      <NewPromptAction directory={directory} onCreate={onCreate} />
    </>
  );
}

function PromptItem({
  record,
  searchText,
  fallbackText,
  enhancementEnabled,
  matchReason,
  trackUsage,
  feedbackState,
  currentProjectCommit,
  onReload,
  arrangementActions,
}: {
  record: PromptRecord;
  searchText: string;
  fallbackText?: string | undefined;
  enhancementEnabled: boolean;
  matchReason: string | undefined;
  trackUsage: boolean;
  feedbackState: FeatureState;
  currentProjectCommit: string | undefined;
  onReload: () => Promise<void>;
  arrangementActions: ReactNode;
}) {
  const { push } = useNavigation();
  const directory = dirname(record.filePath);
  const keywords = [
    record.summary,
    record.body,
    record.target,
    ...record.tags,
    ...record.aliases,
    ...record.searchTerms,
    ...(record.project ? [record.project.name, record.project.path] : []),
  ];
  async function updateFlags(
    flags: Pick<PromptUpdate, "favorite" | "archived">,
  ) {
    await updatePrompt(directory, record.id, promptUpdate(record, flags));
    await onReload();
  }

  async function duplicate() {
    await duplicatePrompt(directory, record.id);
    await showToast(Toast.Style.Success, "Prompt Duplicated");
    await onReload();
  }

  async function improveFromFeedback() {
    try {
      const feedback = await listPromptUseFeedback(directory);
      const candidates = feedbackRevisionCandidates(
        feedback.records,
        record.id,
      );
      if (candidates.length === 0) {
        await showToast(
          Toast.Style.Failure,
          "No Usable Feedback",
          "Record a verdict, critique, correction, or outcome for this prompt first.",
        );
        return;
      }
      await pushEnhancePrompt(push, {
        launchContext: {
          thoughts: buildFeedbackRevisionThoughts(record, candidates),
          revisionOfPromptId: record.id,
        },
      });
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Start Feedback Revision",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Delete “${record.title}”?`,
      message: "This permanently removes the prompt and its saved versions.",
      primaryAction: {
        title: "Delete Prompt",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    await deletePrompt(directory, record.id);
    await showToast(Toast.Style.Success, "Prompt Deleted");
    await onReload();
  }

  const placeholders = extractPlaceholders(record.body);
  const feedbackEnabled = quickRatingEnabled(feedbackState);

  async function usePrompt(body: string, mode: "paste" | "copy") {
    await useLibraryPrompt(record, body, mode, trackUsage, feedbackState);
  }

  return (
    <List.Item
      id={record.id}
      icon={{
        source: record.favorite ? Icon.Star : Icon.TextDocument,
        tintColor: record.favorite ? Color.Yellow : Color.Purple,
      }}
      title={record.title}
      keywords={keywords}
      accessories={promptAccessories(record, currentProjectCommit)}
      detail={
        <PromptDetail
          record={record}
          currentProjectCommit={currentProjectCommit}
          matchReason={matchReason}
        />
      }
      actions={
        <ActionPanel>
          {placeholders.length > 0 ? (
            <Action.Push
              title="Fill Placeholders and Use"
              icon={Icon.TextInput}
              target={
                <PlaceholderForm
                  record={record}
                  placeholders={placeholders}
                  onUse={usePrompt}
                />
              }
            />
          ) : (
            <>
              <Action
                title="Paste in Active App"
                icon={Icon.ArrowRightCircle}
                onAction={() => usePrompt(record.body, "paste")}
              />
              <Action
                title="Copy Prompt"
                icon={Icon.Clipboard}
                onAction={() => usePrompt(record.body, "copy")}
              />
            </>
          )}
          <StudioScreenActions
            searchText={searchText}
            fallbackText={fallbackText}
            enhancementEnabled={enhancementEnabled}
            directory={directory}
            onCreate={onReload}
          />
          {arrangementActions}
          <Action.Push
            title="Edit Prompt"
            icon={Icon.Pencil}
            shortcut={Keyboard.Shortcut.Common.Edit}
            target={<EditPrompt record={record} onReload={onReload} />}
          />
          <Action
            title={
              record.favorite ? "Remove from Favorites" : "Add to Favorites"
            }
            icon={Icon.Star}
            shortcut={Keyboard.Shortcut.Common.Pin}
            onAction={() => updateFlags({ favorite: !record.favorite })}
          />
          <Action
            title={record.archivedAt ? "Unarchive Prompt" : "Archive Prompt"}
            icon={Icon.Tray}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
            onAction={() => updateFlags({ archived: !record.archivedAt })}
          />
          <Action
            title="Duplicate Prompt"
            icon={Icon.Duplicate}
            shortcut={Keyboard.Shortcut.Common.Duplicate}
            onAction={duplicate}
          />
          <Action.Push
            title="View Version History"
            icon={Icon.Clock}
            shortcut={{ modifiers: ["cmd"], key: "h" }}
            target={
              <VersionHistory
                directory={directory}
                record={record}
                onRestore={onReload}
              />
            }
          />
          {feedbackEnabled ? (
            <>
              <Action.Push
                title="Record Prompt Feedback"
                icon={Icon.Gauge}
                shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                target={
                  <CreateFeedback
                    directory={directory}
                    record={record}
                    currentProjectCommit={currentProjectCommit}
                  />
                }
              />
              <Action.Push
                title="Review Prompt Feedback"
                icon={Icon.Eye}
                shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
                target={<PromptFeedback />}
              />
              <Action
                title="Improve from Feedback"
                icon={Icon.Wand}
                shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
                onAction={improveFromFeedback}
              />
            </>
          ) : null}
          <Action.Push
            title="Prompt Studio Status"
            icon={Icon.Gauge}
            shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
            target={<FeatureStatus />}
          />
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            onAction={openExtensionPreferences}
          />
          <Action.ShowInFinder
            title="Show Prompt in Finder"
            path={record.filePath}
            shortcut={Keyboard.Shortcut.Common.OpenWith}
          />
          <Action
            title="Reload Prompt Library"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={onReload}
          />
          <Action
            title="Delete Prompt"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={Keyboard.Shortcut.Common.Remove}
            onAction={remove}
          />
        </ActionPanel>
      }
    />
  );
}

async function useLibraryPrompt(
  record: PromptRecord,
  body: string,
  mode: "paste" | "copy",
  trackUsage: boolean,
  feedbackState: FeatureState,
) {
  if (mode === "paste") {
    await closeMainWindow();
    await Clipboard.paste(body);
    await recordLastLibraryPaste(raycastLocalStorage, feedbackState, record);
  } else {
    await Clipboard.copy(body);
  }
  let useCount: number | undefined;
  if (trackUsage) {
    try {
      recordPromptUse(record.id);
      useCount = loadPromptUsage().get(record.id)?.useCount;
    } catch {
      // ponytail: a missing index only loses ranking, never the completed use.
    }
  }
  const nudge =
    quickRatingEnabled(feedbackState) &&
    useCount !== undefined &&
    useCount % 5 === 0
      ? ` · Used ${useCount} times — consider recording feedback`
      : "";
  if (mode === "paste") {
    await showHUD(`Prompt Pasted${nudge}`);
  } else {
    await showToast(Toast.Style.Success, "Prompt Copied", nudge || undefined);
  }
}

function CreateFeedback({
  directory,
  record,
  currentProjectCommit,
}: {
  directory: string;
  record: PromptRecord;
  currentProjectCommit: string | undefined;
}) {
  const { pop } = useNavigation();
  return (
    <FeedbackForm
      prompt={record}
      {...(currentProjectCommit ? { currentProjectCommit } : {})}
      submitTitle="Save Prompt Feedback"
      onSubmit={async (values) => {
        await createPromptUseFeedback(
          directory,
          feedbackDraftFromForm(record, values),
        );
        await showToast(Toast.Style.Success, "Feedback Saved");
        pop();
      }}
    />
  );
}

function searchFilters(
  filter: LibraryFilter,
  librarySize: number,
): SearchFilters {
  const limit = Math.max(librarySize, 1);
  if (filter === "all") return { includeArchived: true, limit };
  if (filter === "favorites") return { favorite: true, limit };
  if (filter.startsWith("target:")) {
    return {
      target: filter.slice("target:".length) as PromptRecord["target"],
      limit,
    };
  }
  if (filter.startsWith("project:")) {
    return {
      projectPath: filter.slice("project:".length),
      limit,
    };
  }
  if (filter.startsWith("tag:")) {
    return { tag: filter.slice("tag:".length), limit };
  }
  return { limit };
}

function recordMatchesFilter(
  record: PromptRecord,
  filter: LibraryFilter,
): boolean {
  if (filter === "all") return true;
  if (record.archivedAt) return false;
  if (filter === "current") return true;
  if (filter === "favorites") return record.favorite;
  if (filter.startsWith("target:")) {
    return record.target === filter.slice("target:".length);
  }
  if (filter.startsWith("project:")) {
    return record.project?.path === filter.slice("project:".length);
  }
  return record.tags.includes(filter.slice("tag:".length));
}

function PromptDetail({
  record,
  currentProjectCommit,
  matchReason,
}: {
  record: PromptRecord;
  currentProjectCommit?: string | undefined;
  matchReason?: string | undefined;
}) {
  const stale =
    Boolean(record.project?.commit) &&
    Boolean(currentProjectCommit) &&
    record.project?.commit !== currentProjectCommit;
  return (
    <List.Item.Detail
      markdown={promptMarkdown(
        record,
        stale,
        currentProjectCommit,
        matchReason,
      )}
    />
  );
}

function PlaceholderForm({
  record,
  placeholders,
  onUse,
}: {
  record: PromptRecord;
  placeholders: string[];
  onUse: (body: string, mode: "paste" | "copy") => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [values, setValues] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(false);
  const [hasSavedValues, setHasSavedValues] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadRememberedPlaceholderValues(raycastLocalStorage, record).then(
      (saved) => {
        if (cancelled || Object.keys(saved).length === 0) return;
        setValues(saved);
        setRemember(true);
        setHasSavedValues(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [record.body, record.id, record.updatedAt]);

  async function submit(mode: "paste" | "copy") {
    pop();
    await onUse(fillPlaceholders(record.body, values), mode);
    if (!remember) return;
    const result = await saveRememberedPlaceholderValues(
      raycastLocalStorage,
      record,
      values,
    );
    if (result === "failed") {
      await showToast(
        Toast.Style.Failure,
        "Prompt Used, Values Not Remembered",
        "Local storage was unavailable.",
      );
    }
  }

  async function forget() {
    const forgotten = await forgetRememberedPlaceholderValues(
      raycastLocalStorage,
      record.id,
    );
    if (!forgotten) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Forget Saved Values",
        "Local storage was unavailable.",
      );
      return;
    }
    setRemember(false);
    setHasSavedValues(false);
    await showToast(Toast.Style.Success, "Saved Values Forgotten");
  }

  return (
    <Form
      navigationTitle={`Fill ${record.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Paste in Active App"
            icon={Icon.ArrowRightCircle}
            onSubmit={() => submit("paste")}
          />
          <Action.SubmitForm
            title="Copy Prompt"
            icon={Icon.Clipboard}
            onSubmit={() => submit("copy")}
          />
          <Action
            title="Forget Saved Values"
            icon={Icon.Trash}
            shortcut={{ modifiers: ["cmd", "shift"], key: "backspace" }}
            onAction={forget}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Blank values keep their {{placeholder}} visible so nothing is silently lost." />
      {placeholders.map((name) => (
        <Form.TextField
          key={name}
          id={name}
          title={name}
          value={values[name] ?? ""}
          onChange={(value) =>
            setValues((current) => ({ ...current, [name]: value }))
          }
        />
      ))}
      <Form.Separator />
      <Form.Description
        title="Preview"
        text={fillPlaceholders(record.body, values)}
      />
      <Form.Checkbox
        id="rememberValues"
        title="Remember Values"
        label="Remember eligible non-sensitive values for this prompt"
        value={remember}
        onChange={setRemember}
      />
      {hasSavedValues ? (
        <Form.Description text="Saved values belong to this prompt version. Updating the prompt invalidates them." />
      ) : null}
    </Form>
  );
}

const raycastLocalStorage = {
  async getItem(key: string) {
    return await LocalStorage.getItem<string>(key);
  },
  async setItem(key: string, value: string) {
    await LocalStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await LocalStorage.removeItem(key);
  },
};

function EditPrompt({
  record,
  onReload,
}: {
  record: PromptRecord;
  onReload: () => Promise<void>;
}) {
  const { pop } = useNavigation();
  return (
    <PromptForm
      navigationTitle={`Edit ${record.title}`}
      submitTitle="Save Changes"
      initial={formValues(record)}
      onSubmit={async (values) => {
        await updatePrompt(dirname(record.filePath), record.id, {
          title: values.title,
          summary: values.summary,
          body: values.body,
          target: values.target,
          tags: commaSeparated(values.tags),
          aliases: commaSeparated(values.aliases),
          searchTerms: commaSeparated(values.searchTerms),
        });
        await onReload();
        await showToast(Toast.Style.Success, "Prompt Updated");
        pop();
      }}
    />
  );
}

function VersionHistory({
  directory,
  record,
  onRestore,
}: {
  directory: string;
  record: PromptRecord;
  onRestore: () => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [versions, setVersions] = useState<PromptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listPromptVersions(directory, record.id)
      .then(setVersions)
      .finally(() => setLoading(false));
  }, [directory, record.id]);

  async function restore(version: PromptRecord) {
    await restorePromptVersion(directory, record.id, version.filePath);
    await onRestore();
    await showToast(Toast.Style.Success, "Prompt Version Restored");
    pop();
  }

  return (
    <List
      isLoading={loading}
      isShowingDetail
      navigationTitle={`${record.title} History`}
    >
      {!loading && versions.length === 0 ? (
        <List.EmptyView
          icon={Icon.Clock}
          title="No Earlier Versions"
          description="A version is saved automatically before each change."
        />
      ) : null}
      {versions.map((version) => (
        <List.Item
          key={version.filePath}
          icon={Icon.Clock}
          title={new Date(version.updatedAt).toLocaleString()}
          subtitle={version.title}
          detail={<PromptDetail record={version} />}
          actions={
            <ActionPanel>
              <Action
                title="Restore This Version"
                icon={Icon.ArrowCounterClockwise}
                onAction={() => restore(version)}
              />
              <Action.CopyToClipboard
                title="Copy This Version"
                content={version.body}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function formValues(record: PromptRecord): PromptFormValues {
  return {
    title: record.title,
    summary: record.summary,
    body: record.body,
    target: record.target,
    tags: record.tags.join(", "),
    aliases: record.aliases.join(", "),
    searchTerms: record.searchTerms.join(", "),
  };
}

function promptMarkdown(
  record: PromptRecord,
  stale = false,
  currentCommit?: string,
  matchReason?: string,
): string {
  const overview = [
    `**Target:** ${targetTitle(record.target)}`,
    `**Updated:** ${new Date(record.updatedAt).toLocaleString()}`,
    ...(record.project
      ? [
          `**Project:** ${record.project.name}${record.project.branch ? ` (${record.project.branch})` : ""}`,
        ]
      : []),
    ...(matchReason ? [`**Matched by:** ${matchReason}`] : []),
  ].join("  \n");
  const sections = [
    `# ${record.title}`,
    `## What This Prompt Does\n\n${record.summary}`,
    overview,
  ];
  if (stale) {
    sections.push(
      `> Project context may be stale. Saved commit: \`${record.project?.commit}\`; current commit: \`${currentCommit}\`.`,
    );
  }
  sections.push(`## Full Prompt\n\n${record.body}`);
  return sections.join("\n\n");
}

function promptUpdate(
  record: PromptRecord,
  flags: Pick<PromptUpdate, "favorite" | "archived">,
): PromptUpdate {
  return {
    ...formValues(record),
    tags: record.tags,
    aliases: record.aliases,
    searchTerms: record.searchTerms,
    ...flags,
  };
}

function targetTitle(target: PromptRecord["target"]): string {
  if (target === "claude-code") return "Claude Code";
  return target.charAt(0).toUpperCase() + target.slice(1);
}
