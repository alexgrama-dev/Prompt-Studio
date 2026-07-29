import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Detail,
  Form,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getPromptStudioPreferences } from "./core/extension-preferences";
import { getFeatureStatus, loadFeatureStatuses } from "./core/features";
import { generateIdeaTitle, validateIdeaTitle } from "./core/idea-title";
import {
  enhancePromptLaunchContext,
  ideaStudioInitialIdea,
  type IdeaStudioLaunchContext,
} from "./core/launch-context";
import {
  consolidateExactIdeaDuplicates,
  deletePrompt,
  enhancementHistoryDirectory,
  findExactIdeaDuplicates,
  listPrompts,
  promptSeedDirectory,
  recordPromptSeed,
  resolvePromptDirectory,
  updatePromptSeed,
  type ExactIdeaDuplicateGroup,
  type IdeaTitleProvenance,
  type InvalidPrompt,
  type PromptRecord,
  type PromptTarget,
} from "./core/prompt-store";

export default function IdeaStudio(props: {
  arguments?: { idea?: string };
  fallbackText?: string;
  launchContext?: IdeaStudioLaunchContext;
}) {
  const initialIdea = ideaStudioInitialIdea(
    props.launchContext,
    props.arguments?.idea,
    props.fallbackText,
  );
  let directory: string;
  try {
    directory = resolvePromptDirectory(
      getPromptStudioPreferences().libraryDirectory,
    );
  } catch (error) {
    return (
      <Detail
        navigationTitle="Idea Studio"
        markdown={`# Idea Studio Cannot Open\n\n${error instanceof Error ? error.message : String(error)}`}
        actions={
          <ActionPanel>
            <Action
              title="Open Extension Preferences"
              icon={Icon.Gear}
              onAction={openExtensionPreferences}
            />
          </ActionPanel>
        }
      />
    );
  }

  return initialIdea ? (
    <CreateIdeaForm
      directory={directory}
      initialIdea={initialIdea}
      {...(props.launchContext?.target
        ? { initialTarget: props.launchContext.target }
        : {})}
    />
  ) : (
    <IdeaInbox directory={directory} />
  );
}

function IdeaInbox({ directory }: { directory: string }) {
  const [ideas, setIdeas] = useState<PromptRecord[]>([]);
  const [invalid, setInvalid] = useState<InvalidPrompt[]>([]);
  const [history, setHistory] = useState<PromptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [ideaError, setIdeaError] = useState<string>();
  const [historyError, setHistoryError] = useState<string>();
  const [searchText, setSearchText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ideaResult, historyResult] = await Promise.allSettled([
      listPrompts(promptSeedDirectory(directory)),
      listPrompts(enhancementHistoryDirectory(directory)),
    ]);
    if (ideaResult.status === "fulfilled") {
      setIdeas(ideaResult.value.records);
      setInvalid(ideaResult.value.invalid);
      setIdeaError(undefined);
    } else {
      setIdeas([]);
      setInvalid([]);
      setIdeaError(errorMessage(ideaResult.reason));
    }
    if (historyResult.status === "fulfilled") {
      setHistory(historyResult.value.records);
      setHistoryError(undefined);
    } else {
      setHistory([]);
      setHistoryError(errorMessage(historyResult.reason));
    }
    setLoading(false);
  }, [directory]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (historyError) return { ready: ideas, enhanced: [] };
    return {
      ready: ideas.filter((idea) => enhancementCount(idea, history) === 0),
      enhanced: ideas.filter((idea) => enhancementCount(idea, history) > 0),
    };
  }, [history, historyError, ideas]);
  const emptyTitle = ideaError
    ? "Idea Studio Unavailable"
    : searchText.trim()
      ? "No Matching Ideas"
      : "No Ideas Yet";
  const emptyDescription =
    ideaError ??
    (searchText.trim()
      ? `No saved idea matches “${searchText.trim()}”.`
      : "Capture a thought now; nothing is sent to a model until you choose Generate AI Title.");

  return (
    <List
      isLoading={loading}
      isShowingDetail={ideas.length + invalid.length > 0}
      filtering={{ keepSectionOrder: true }}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search ideas…"
    >
      {!loading && ideas.length + invalid.length === 0 ? (
        <List.EmptyView
          icon={ideaError ? Icon.ExclamationMark : Icon.LightBulb}
          title={emptyTitle}
          description={emptyDescription}
          actions={
            <ActionPanel>
              {ideaError ? (
                <>
                  <Action
                    title="Reload Idea Studio"
                    icon={Icon.ArrowClockwise}
                    onAction={load}
                  />
                  <Action
                    title="Open Extension Preferences"
                    icon={Icon.Gear}
                    onAction={openExtensionPreferences}
                  />
                </>
              ) : (
                <Action.Push
                  title="Create Idea"
                  icon={Icon.Plus}
                  shortcut={Keyboard.Shortcut.Common.New}
                  target={
                    <CreateIdeaForm directory={directory} onSaved={load} />
                  }
                />
              )}
            </ActionPanel>
          }
        />
      ) : null}
      <List.Section
        title={historyError ? "Ideas" : "Ready to Enhance"}
        subtitle={
          historyError
            ? `Enhancement status unavailable · ${ideas.length}`
            : `${grouped.ready.length}`
        }
      >
        {grouped.ready.map((idea) => (
          <IdeaItem
            key={idea.id}
            directory={directory}
            idea={idea}
            {...(historyError
              ? {}
              : { enhancementCount: enhancementCount(idea, history) })}
            onReload={load}
          />
        ))}
      </List.Section>
      {!historyError ? (
        <List.Section title="Enhanced" subtitle={`${grouped.enhanced.length}`}>
          {grouped.enhanced.map((idea) => (
            <IdeaItem
              key={idea.id}
              directory={directory}
              idea={idea}
              enhancementCount={enhancementCount(idea, history)}
              onReload={load}
            />
          ))}
        </List.Section>
      ) : null}
      {invalid.length > 0 ? (
        <List.Section title="Needs Repair" subtitle={`${invalid.length}`}>
          {invalid.map((item) => (
            <InvalidIdeaItem key={item.filePath} item={item} onReload={load} />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function IdeaItem({
  directory,
  idea,
  enhancementCount: count,
  onReload,
}: {
  directory: string;
  idea: PromptRecord;
  enhancementCount?: number;
  onReload: () => Promise<void>;
}) {
  return (
    <List.Item
      id={idea.id}
      icon={{
        source: count ? Icon.CheckCircle : Icon.LightBulb,
        tintColor: count ? Color.Green : Color.Yellow,
      }}
      title={idea.title}
      subtitle={oneLine(idea.body)}
      keywords={[idea.body, idea.target, ...idea.aliases]}
      accessories={[
        {
          text:
            count === undefined
              ? "Status unavailable"
              : targetTitle(idea.target),
        },
        ...(idea.ideaTitle ? [{ tag: "AI title" }] : []),
      ]}
      detail={
        <List.Item.Detail
          markdown={`# ${idea.title}\n\n${idea.body}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Target"
                text={targetTitle(idea.target)}
              />
              <List.Item.Detail.Metadata.Label
                title="Enhancements"
                text={
                  count === undefined ? "Unavailable" : `${count} completed`
                }
              />
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={idea.ideaTitle ? "Generated by AI" : "Manual or imported"}
              />
              <List.Item.Detail.Metadata.Label
                title="Saved"
                text={new Date(idea.createdAt).toLocaleString()}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <IdeaActions directory={directory} idea={idea} onReload={onReload} />
      }
    />
  );
}

function IdeaActions({
  directory,
  idea,
  onReload,
}: {
  directory: string;
  idea: PromptRecord;
  onReload: () => Promise<void>;
}) {
  const { push } = useNavigation();

  async function enhance() {
    await launchCommand({
      name: "enhance-prompt",
      type: LaunchType.UserInitiated,
      context: enhancePromptLaunchContext(idea),
    });
  }

  async function generateTitle() {
    try {
      const result = await generateReviewedTitle(idea.body, idea.target);
      push(
        <IdeaReviewForm
          directory={directory}
          idea={idea.body}
          target={idea.target}
          title={result.title}
          provenance={result.provenance}
          existing={idea}
          onSaved={onReload}
        />,
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Generate Title",
        `${errorMessage(error)} Edit the idea to use a manual title.`,
      );
    }
  }

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Delete “${idea.title}”?`,
      message:
        "This removes the idea file. Existing prompts and enhancement history remain unchanged.",
      primaryAction: {
        title: "Delete Idea",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    try {
      await deletePrompt(promptSeedDirectory(directory), idea.id, {
        syncSearchIndex: false,
      });
      await onReload();
      await showToast(Toast.Style.Success, "Idea Deleted");
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Delete Idea",
        errorMessage(error),
      );
    }
  }

  return (
    <ActionPanel>
      <Action title="Enhance Idea" icon={Icon.Wand} onAction={enhance} />
      <Action
        title={idea.ideaTitle ? "Regenerate AI Title" : "Generate AI Title"}
        icon={Icon.Stars}
        shortcut={{ modifiers: ["cmd"], key: "g" }}
        onAction={generateTitle}
      />
      <ActionPanel.Submenu
        title="Idea"
        icon={Icon.LightBulb}
        shortcut={{ modifiers: ["cmd"], key: "i" }}
      >
        <Action.Push
          title="Create Idea"
          icon={Icon.Plus}
          shortcut={Keyboard.Shortcut.Common.New}
          target={<CreateIdeaForm directory={directory} onSaved={onReload} />}
        />
        <Action.Push
          title="Edit Idea"
          icon={Icon.Pencil}
          shortcut={Keyboard.Shortcut.Common.Edit}
          target={
            <EditIdeaForm
              directory={directory}
              idea={idea}
              onSaved={onReload}
            />
          }
        />
        <Action.CopyToClipboard
          title="Copy Idea"
          content={idea.body}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
        />
      </ActionPanel.Submenu>
      <ActionPanel.Submenu
        title="Organize"
        icon={Icon.Folder}
        shortcut={{ modifiers: ["cmd", "shift"], key: "z" }}
      >
        <Action.Push
          title="Review Exact Duplicates"
          icon={Icon.MagnifyingGlass}
          shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
          target={
            <DuplicateReview directory={directory} onChanged={onReload} />
          }
        />
        <Action
          title="Delete Idea"
          icon={Icon.Trash}
          style={Action.Style.Destructive}
          shortcut={{ modifiers: ["ctrl"], key: "x" }}
          onAction={remove}
        />
      </ActionPanel.Submenu>
    </ActionPanel>
  );
}

function CreateIdeaForm({
  directory,
  initialIdea = "",
  initialTarget = "codex",
  onSaved,
}: {
  directory: string;
  initialIdea?: string;
  initialTarget?: PromptTarget;
  onSaved?: () => Promise<void>;
}) {
  const { push } = useNavigation();
  const [idea, setIdea] = useState(initialIdea);
  const [target, setTarget] = useState<PromptTarget>(initialTarget);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const result = await generateReviewedTitle(idea, target);
      push(
        <IdeaReviewForm
          directory={directory}
          idea={idea}
          target={target}
          title={result.title}
          provenance={result.provenance}
          {...(onSaved ? { onSaved } : {})}
        />,
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Generate Title",
        `${errorMessage(error)} Your draft is unchanged; choose Use Manual Title to continue.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Create Idea"
      actions={
        <ActionPanel>
          <Action
            title="Generate AI Title"
            icon={Icon.Stars}
            onAction={generate}
          />
          <Action.Push
            title="Use Manual Title"
            icon={Icon.Pencil}
            target={
              <IdeaReviewForm
                directory={directory}
                idea={idea}
                target={target}
                title=""
                {...(onSaved ? { onSaved } : {})}
              />
            }
          />
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="idea"
        title="Idea"
        placeholder="What do you want the future prompt to accomplish?"
        value={idea}
        onChange={setIdea}
      />
      <Form.Dropdown
        id="target"
        title="Target"
        value={target}
        onChange={(value) => setTarget(value as PromptTarget)}
      >
        <Form.Dropdown.Item value="generic" title="Generic" />
        <Form.Dropdown.Item value="codex" title="Codex" />
        <Form.Dropdown.Item value="claude-code" title="Claude Code" />
      </Form.Dropdown>
      <Form.Description
        title="AI Title Privacy"
        text="Generate AI Title sends this exact idea and selected target to OpenAI. Nothing is saved until you review the title and choose Save Idea."
      />
    </Form>
  );
}

function IdeaReviewForm({
  directory,
  idea,
  target,
  title: initialTitle,
  provenance,
  existing,
  onSaved,
}: {
  directory: string;
  idea: string;
  target: PromptTarget;
  title: string;
  provenance?: IdeaTitleProvenance;
  existing?: PromptRecord;
  onSaved?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const validatedTitle = provenance
        ? validateIdeaTitle(title)
        : validateManualIdeaTitle(title);
      const record = existing
        ? await updatePromptSeed(directory, existing.id, {
            title: validatedTitle,
            body: idea,
            target,
            ...(provenance ? { ideaTitle: provenance } : {}),
          })
        : await recordPromptSeed(directory, {
            title: validatedTitle,
            body: idea,
            target,
            ...(provenance ? { ideaTitle: provenance } : {}),
          });
      await onSaved?.();
      await showHUD(
        existing
          ? "Idea updated"
          : record.body === idea && record.title !== validatedTitle
            ? "Existing idea reused"
            : "Idea saved",
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Idea",
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Review Idea"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Idea"
            icon={Icon.Check}
            onSubmit={save}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="2 to 10 words"
        value={title}
        onChange={setTitle}
      />
      <Form.Description title="Idea" text={idea} />
      <Form.Description title="Target" text={targetTitle(target)} />
      <Form.Description
        title="Save"
        text="The title is editable. Save Idea writes the first Markdown record; going back writes nothing."
      />
    </Form>
  );
}

function EditIdeaForm({
  directory,
  idea: existing,
  onSaved,
}: {
  directory: string;
  idea: PromptRecord;
  onSaved: () => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [idea, setIdea] = useState(existing.body);
  const [title, setTitle] = useState(existing.title);
  const [target, setTarget] = useState<PromptTarget>(existing.target);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const validatedTitle = validateManualIdeaTitle(title);
      await updatePromptSeed(directory, existing.id, {
        title: validatedTitle,
        body: idea,
        target,
      });
      await onSaved();
      await showToast(Toast.Style.Success, "Idea Updated");
      pop();
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Update Idea",
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Edit Idea"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Changes"
            icon={Icon.Check}
            onSubmit={save}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        value={title}
        onChange={setTitle}
      />
      <Form.TextArea id="idea" title="Idea" value={idea} onChange={setIdea} />
      <Form.Dropdown
        id="target"
        title="Target"
        value={target}
        onChange={(value) => setTarget(value as PromptTarget)}
      >
        <Form.Dropdown.Item value="generic" title="Generic" />
        <Form.Dropdown.Item value="codex" title="Codex" />
        <Form.Dropdown.Item value="claude-code" title="Claude Code" />
      </Form.Dropdown>
    </Form>
  );
}

function DuplicateReview({
  directory,
  onChanged,
}: {
  directory: string;
  onChanged: () => Promise<void>;
}) {
  const [groups, setGroups] = useState<ExactIdeaDuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await findExactIdeaDuplicates(directory));
      setError(undefined);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [directory]);

  useEffect(() => {
    void load();
  }, [load]);

  async function consolidate(group: ExactIdeaDuplicateGroup) {
    const confirmed = await confirmAlert({
      title: `Keep “${group.retained.title}” and remove ${group.removed.length}?`,
      message: `${group.linkedEnhancementCount} enhancement-history and ${group.linkedPromptCount} prompt links will keep resolving through the retained idea. Those linked records are not rewritten or deleted.`,
      primaryAction: {
        title: "Consolidate Exact Duplicates",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    try {
      await consolidateExactIdeaDuplicates(
        directory,
        group.retained.id,
        group.removed.map((record) => record.id),
      );
      await Promise.all([load(), onChanged()]);
      await showToast(Toast.Style.Success, "Exact Duplicates Consolidated");
    } catch (consolidationError) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Consolidate Ideas",
        errorMessage(consolidationError),
      );
    }
  }

  return (
    <List
      isLoading={loading}
      isShowingDetail={groups.length > 0}
      navigationTitle="Review Exact Duplicates"
    >
      {!loading && groups.length === 0 ? (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.CheckCircle}
          title={error ? "Duplicate Review Unavailable" : "No Exact Duplicates"}
          description={
            error ??
            "Ideas match only when their normalized text and target are identical."
          }
          actions={
            <ActionPanel>
              <Action
                title="Reload Duplicate Review"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={load}
              />
            </ActionPanel>
          }
        />
      ) : null}
      {groups.map((group) => (
        <List.Item
          key={group.retained.id}
          title={group.retained.title}
          subtitle={`${group.removed.length} duplicate${group.removed.length === 1 ? "" : "s"} to remove`}
          accessories={[
            {
              text: `${group.linkedEnhancementCount + group.linkedPromptCount} linked`,
            },
          ]}
          detail={
            <List.Item.Detail
              markdown={[
                `# Keep ${group.retained.title}`,
                `**Retained ID:** \`${group.retained.id}\``,
                `**Remove:** ${group.removed.length}`,
                `**Linked enhancement-history records:** ${group.linkedEnhancementCount}`,
                `**Linked prompts:** ${group.linkedPromptCount}`,
                "## Exact Idea",
                group.retained.body,
                "## Removed Records",
                ...group.removed.map(
                  (record) => `- ${record.title} — \`${record.id}\``,
                ),
              ].join("\n\n")}
            />
          }
          actions={
            <ActionPanel>
              <Action
                title="Consolidate This Group"
                icon={Icon.Link}
                style={Action.Style.Destructive}
                onAction={() => consolidate(group)}
              />
              <Action
                title="Reload Duplicate Review"
                icon={Icon.ArrowClockwise}
                shortcut={Keyboard.Shortcut.Common.Refresh}
                onAction={load}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function InvalidIdeaItem({
  item,
  onReload,
}: {
  item: InvalidPrompt;
  onReload: () => Promise<void>;
}) {
  return (
    <List.Item
      icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
      title={item.filePath.split("/").at(-1) ?? item.filePath}
      subtitle={item.error}
      detail={
        <List.Item.Detail
          markdown={`# Idea Needs Repair\n\n${item.error}\n\n\`${item.filePath}\``}
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Submenu
            title="Repair"
            icon={Icon.WrenchScrewdriver}
            shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
          >
            <Action.Open
              title="Open Idea File"
              target={item.filePath}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
            <Action.ShowInFinder
              title="Show Idea in Finder"
              path={item.filePath}
              shortcut={Keyboard.Shortcut.Common.OpenWith}
            />
            <Action
              title="Reload Idea Studio"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={onReload}
            />
          </ActionPanel.Submenu>
        </ActionPanel>
      }
    />
  );
}

async function generateReviewedTitle(idea: string, target: PromptTarget) {
  const state = getFeatureStatus(
    await loadFeatureStatuses(),
    "openai-enhancement",
  ).effectiveState;
  if (state === "disabled") {
    throw new Error(
      "OpenAI enhancement is Disabled. Use a manual title instead.",
    );
  }
  const apiKey = getPromptStudioPreferences().openaiApiKey?.trim();
  return generateIdeaTitle(
    { idea, target },
    {
      apiKey: apiKey ?? "",
    },
  );
}

function enhancementCount(
  idea: PromptRecord,
  history: readonly PromptRecord[],
): number {
  const identifiers = new Set([idea.id, ...idea.aliases]);
  return history.filter(
    (record) => record.seed?.id && identifiers.has(record.seed.id),
  ).length;
}

function targetTitle(target: PromptTarget): string {
  if (target === "claude-code") return "Claude Code";
  if (target === "codex") return "Codex";
  return "Generic";
}

function oneLine(value: string): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length <= 120 ? compact : `${compact.slice(0, 117)}…`;
}

function validateManualIdeaTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error("Idea title is required.");
  if (/[\r\n]/u.test(title))
    throw new Error("Idea title must fit on one line.");
  if (title.length > 80)
    throw new Error("Idea title must be 80 characters or fewer.");
  return title;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
