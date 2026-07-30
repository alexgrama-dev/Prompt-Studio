import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
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
import { captureKindTitle } from "./core/capture-queue";
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
  promptCaptureKind,
  promptCaptureSection,
  promptSeedDirectory,
  recordPromptSeed,
  resolvePromptDirectory,
  savePromptSeedToLibrary,
  setPromptSeedCompleted,
  updatePromptSeed,
  type ExactIdeaDuplicateGroup,
  type IdeaTitleProvenance,
  type InvalidPrompt,
  type PromptRecord,
  type PromptCaptureKind,
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
        navigationTitle="Capture Inbox"
        markdown={`# Capture Inbox Cannot Open\n\n${error instanceof Error ? error.message : String(error)}`}
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
      initialKind="idea"
      {...(props.launchContext?.target
        ? { initialTarget: props.launchContext.target }
        : {})}
    />
  ) : (
    <IdeaInbox directory={directory} />
  );
}

function IdeaInbox({ directory }: { directory: string }) {
  const { push } = useNavigation();
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

  async function captureClipboard() {
    const text = await Clipboard.readText();
    if (!text?.trim()) {
      await showToast(
        Toast.Style.Failure,
        "Clipboard Has No Plain Text",
        "Copy text, then choose Capture Clipboard again.",
      );
      return;
    }
    push(
      <CreateIdeaForm
        directory={directory}
        initialIdea={text}
        initialKind="keep"
        onSaved={load}
      />,
    );
  }

  const grouped = useMemo(() => {
    return {
      upNext: ideas.filter(
        (idea) => promptCaptureSection(idea) === "up-next",
      ),
      savedForLater: ideas.filter(
        (idea) => promptCaptureSection(idea) === "saved-for-later",
      ),
      completed: ideas.filter(
        (idea) => promptCaptureSection(idea) === "completed",
      ),
    };
  }, [ideas]);
  const emptyTitle = ideaError
    ? "Capture Inbox Unavailable"
    : searchText.trim()
      ? "No Matching Captures"
      : "No Captured Items Yet";
  const emptyDescription =
    ideaError ??
    (searchText.trim()
      ? `No captured item matches “${searchText.trim()}”.`
      : "Capture a next prompt, something to keep, or an idea. Everything stays local until you choose an explicit action.");

  return (
    <List
      isLoading={loading}
      isShowingDetail={ideas.length + invalid.length > 0}
      filtering={{ keepSectionOrder: true }}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search captured items…"
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
                    title="Reload Capture Inbox"
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
                <>
                  <Action.Push
                    title="Capture Item"
                    icon={Icon.Plus}
                    shortcut={Keyboard.Shortcut.Common.New}
                    target={
                      <CreateIdeaForm directory={directory} onSaved={load} />
                    }
                  />
                  <Action
                    title="Capture Clipboard"
                    icon={Icon.Clipboard}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
                    onAction={captureClipboard}
                  />
                </>
              )}
            </ActionPanel>
          }
        />
      ) : null}
      <List.Section title="Up Next" subtitle={`${grouped.upNext.length}`}>
        {grouped.upNext.map((idea) => (
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
      <List.Section
        title="Saved for Later"
        subtitle={`${grouped.savedForLater.length}`}
      >
        {grouped.savedForLater.map((idea) => (
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
      <List.Section title="Completed" subtitle={`${grouped.completed.length}`}>
        {grouped.completed.map((idea) => (
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
  const kind = promptCaptureKind(idea);
  const completed = promptCaptureSection(idea) === "completed";
  return (
    <List.Item
      id={idea.id}
      icon={captureIcon(kind, completed)}
      title={idea.title}
      keywords={[
        idea.body,
        idea.target,
        captureKindTitle(kind),
        ...idea.aliases,
      ]}
      detail={
        <List.Item.Detail
          markdown={`# ${idea.title}\n\n${idea.body}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Type"
                text={captureKindTitle(kind)}
              />
              <List.Item.Detail.Metadata.Label
                title="Status"
                text={
                  completed && idea.capture?.completedAt
                    ? `Completed ${new Date(idea.capture.completedAt).toLocaleString()}`
                    : "Active"
                }
              />
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
  const completed = promptCaptureSection(idea) === "completed";

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
          kind={promptCaptureKind(idea)}
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

  async function toggleCompleted() {
    try {
      await setPromptSeedCompleted(directory, idea.id, !completed);
      await onReload();
      await showToast(
        Toast.Style.Success,
        completed ? "Item Restored" : "Item Completed",
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        completed ? "Could Not Restore Item" : "Could Not Complete Item",
        errorMessage(error),
      );
    }
  }

  async function captureClipboard() {
    const text = await Clipboard.readText();
    if (!text?.trim()) {
      await showToast(
        Toast.Style.Failure,
        "Clipboard Has No Plain Text",
        "Copy text, then choose Capture Clipboard again.",
      );
      return;
    }
    push(
      <CreateIdeaForm
        directory={directory}
        initialIdea={text}
        initialKind="keep"
        onSaved={onReload}
      />,
    );
  }

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Delete “${idea.title}”?`,
      message:
        "This removes the captured item file. Existing prompts and enhancement history remain unchanged.",
      primaryAction: {
        title: "Delete Item",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    try {
      await deletePrompt(promptSeedDirectory(directory), idea.id, {
        syncSearchIndex: false,
      });
      await onReload();
      await showToast(Toast.Style.Success, "Item Deleted");
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Delete Item",
        errorMessage(error),
      );
    }
  }

  return (
    <ActionPanel>
      <Action.Paste
        title="Paste in Active App"
        content={idea.body}
        icon={Icon.ArrowRightCircle}
      />
      <Action
        title={completed ? "Restore Item" : "Complete Item"}
        icon={completed ? Icon.ArrowClockwise : Icon.CheckCircle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
        onAction={toggleCompleted}
      />
      <Action.Push
        title="Edit Item"
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
      <ActionPanel.Submenu
        title="More Actions…"
        icon={Icon.Ellipsis}
        shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
      >
        <Action.CopyToClipboard
          title="Copy Item"
          content={idea.body}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
        <Action
          title="Enhance Item"
          icon={Icon.Wand}
          shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
          onAction={enhance}
        />
        <Action
          title={idea.ideaTitle ? "Regenerate AI Title" : "Generate AI Title"}
          icon={Icon.Stars}
          shortcut={{ modifiers: ["cmd"], key: "g" }}
          onAction={generateTitle}
        />
        <Action.Push
          title="Convert to Prompt"
          icon={Icon.Document}
          shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
          target={
            <ConvertToPromptForm
              directory={directory}
              item={idea}
              onSaved={onReload}
            />
          }
        />
        <Action.Push
          title="Capture Item"
          icon={Icon.Plus}
          shortcut={Keyboard.Shortcut.Common.New}
          target={<CreateIdeaForm directory={directory} onSaved={onReload} />}
        />
        <Action
          title="Capture Clipboard"
          icon={Icon.Clipboard}
          shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
          onAction={captureClipboard}
        />
        <Action.Push
          title="Review Exact Duplicates"
          icon={Icon.MagnifyingGlass}
          shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
          target={
            <DuplicateReview directory={directory} onChanged={onReload} />
          }
        />
      </ActionPanel.Submenu>
      <Action
        title="Delete Item"
        icon={Icon.Trash}
        style={Action.Style.Destructive}
        shortcut={{ modifiers: ["ctrl"], key: "x" }}
        onAction={remove}
      />
    </ActionPanel>
  );
}

function CreateIdeaForm({
  directory,
  initialIdea = "",
  initialKind = "idea",
  initialTarget = "codex",
  onSaved,
}: {
  directory: string;
  initialIdea?: string;
  initialKind?: PromptCaptureKind;
  initialTarget?: PromptTarget;
  onSaved?: () => Promise<void>;
}) {
  const { push } = useNavigation();
  const [idea, setIdea] = useState(initialIdea);
  const [kind, setKind] = useState<PromptCaptureKind>(initialKind);
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
          kind={kind}
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
      navigationTitle="Capture Item"
      actions={
        <ActionPanel>
          <Action
            title="Generate AI Title"
            icon={Icon.Stars}
            shortcut={{ modifiers: ["cmd"], key: "g" }}
            onAction={generate}
          />
          <Action.Push
            title="Use Manual Title"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
            target={
              <IdeaReviewForm
                directory={directory}
                idea={idea}
                target={target}
                title=""
                kind={kind}
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
        title="Content"
        placeholder="A next prompt, useful answer, link, or idea"
        value={idea}
        onChange={setIdea}
      />
      <CaptureKindDropdown value={kind} onChange={setKind} />
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
        text="Generate AI Title sends this exact content and selected target to OpenAI. Nothing is saved until you review the title and choose Save Item."
      />
    </Form>
  );
}

function IdeaReviewForm({
  directory,
  idea,
  target,
  title: initialTitle,
  kind,
  provenance,
  existing,
  onSaved,
}: {
  directory: string;
  idea: string;
  target: PromptTarget;
  title: string;
  kind: PromptCaptureKind;
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
            capture: {
              kind,
              ...(existing.capture?.completedAt
                ? { completedAt: existing.capture.completedAt }
                : {}),
            },
            ...(provenance ? { ideaTitle: provenance } : {}),
          })
        : await recordPromptSeed(directory, {
            title: validatedTitle,
            body: idea,
            target,
            capture: { kind },
            ...(provenance ? { ideaTitle: provenance } : {}),
          });
      await onSaved?.();
      await showHUD(
        existing
          ? "Item updated"
          : record.body === idea && record.title !== validatedTitle
            ? "Existing item reused"
            : "Item saved",
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Item",
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Review Capture"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Item"
            icon={Icon.Check}
            shortcut={Keyboard.Shortcut.Common.Save}
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
      <Form.Description title="Content" text={idea} />
      <Form.Description title="Type" text={captureKindTitle(kind)} />
      <Form.Description title="Target" text={targetTitle(target)} />
      <Form.Description
        title="Save"
        text="The title is editable. Save Item writes the first Markdown record; going back writes nothing."
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
  const [kind, setKind] = useState<PromptCaptureKind>(
    promptCaptureKind(existing),
  );
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
        capture: {
          kind,
          ...(existing.capture?.completedAt
            ? { completedAt: existing.capture.completedAt }
            : {}),
        },
      });
      await onSaved();
      await showToast(Toast.Style.Success, "Item Updated");
      pop();
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Update Item",
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Edit Item"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Changes"
            icon={Icon.Check}
            shortcut={Keyboard.Shortcut.Common.Save}
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
      <Form.TextArea
        id="idea"
        title="Content"
        value={idea}
        onChange={setIdea}
      />
      <CaptureKindDropdown value={kind} onChange={setKind} />
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

function CaptureKindDropdown({
  value,
  onChange,
}: {
  value: PromptCaptureKind;
  onChange: (value: PromptCaptureKind) => void;
}) {
  return (
    <Form.Dropdown
      id="kind"
      title="Type"
      value={value}
      onChange={(next) => onChange(next as PromptCaptureKind)}
    >
      <Form.Dropdown.Item
        value="next-prompt"
        title="Next Prompt"
        icon={Icon.ArrowRightCircle}
      />
      <Form.Dropdown.Item value="keep" title="Keep" icon={Icon.Bookmark} />
      <Form.Dropdown.Item value="idea" title="Idea" icon={Icon.LightBulb} />
    </Form.Dropdown>
  );
}

function ConvertToPromptForm({
  directory,
  item,
  onSaved,
}: {
  directory: string;
  item: PromptRecord;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [target, setTarget] = useState<PromptTarget>(item.target);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await savePromptSeedToLibrary(directory, item.id, {
        title: validateManualIdeaTitle(title),
        body,
        target,
      });
      await onSaved();
      await showHUD("Prompt available in library");
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Convert Item",
        errorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Convert to Prompt"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Prompt"
            icon={Icon.Check}
            shortcut={Keyboard.Shortcut.Common.Save}
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
      <Form.TextArea
        id="body"
        title="Prompt"
        value={body}
        onChange={setBody}
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
        title="Source"
        text={`This prompt will link to “${item.title}”. Repeating Save Prompt reuses the same library prompt.`}
      />
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
      message: `${group.linkedEnhancementCount} enhancement-history and ${group.linkedPromptCount} prompt links will keep resolving through the retained item. Those linked records are not rewritten or deleted.`,
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
        "Could Not Consolidate Items",
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
            "Items match only when their normalized text, target, and type are identical."
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
                shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
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
          markdown={`# Capture Needs Repair\n\n${item.error}\n\n\`${item.filePath}\``}
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
              title="Open Capture File"
              target={item.filePath}
              shortcut={Keyboard.Shortcut.Common.Open}
            />
            <Action.ShowInFinder
              title="Show Capture in Finder"
              path={item.filePath}
              shortcut={Keyboard.Shortcut.Common.OpenWith}
            />
            <Action
              title="Reload Capture Inbox"
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

function captureIcon(kind: PromptCaptureKind, completed: boolean) {
  if (completed) {
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  }
  if (kind === "next-prompt") {
    return { source: Icon.ArrowRightCircle, tintColor: Color.Blue };
  }
  if (kind === "keep") {
    return { source: Icon.Bookmark, tintColor: Color.Orange };
  }
  return { source: Icon.LightBulb, tintColor: Color.Yellow };
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
