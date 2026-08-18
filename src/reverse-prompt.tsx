import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  getSelectedFinderItems,
  useNavigation,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { getFeatureStatus, loadFeatureStatuses } from "./core/features";
import { enhancePromptThoughtsLaunchContext } from "./core/launch-context";
import type { PromptTarget } from "./core/prompt-store";
import {
  buildReversePromptThoughts,
  classifyReversePromptInput,
  initialReversePromptFields,
  reversePromptFormSource,
} from "./core/reverse-prompt";
import {
  pushEnhancePrompt,
  type ReversePromptViewProps,
} from "./open-studio-views";

export default function ReversePrompt(props: ReversePromptViewProps) {
  const [state, setState] = useState<"checking" | "disabled" | "ready" | "error">(
    "checking",
  );
  const [message, setMessage] = useState("Checking activation status…");

  useEffect(() => {
    void loadFeatureStatuses()
      .then((statuses) => {
        const feature = getFeatureStatus(statuses, "openai-enhancement");
        if (feature.effectiveState === "disabled") {
          setState("disabled");
          setMessage(
            "# Reverse Prompt Needs Enhancement\n\nReverse Prompt turns an image, URL, or video into a reusable prompt through the existing Enhance → Review → Save path.\n\n**Activation 3** is Disabled, so no model request or credential lookup occurred. Enable OpenAI Enhancement in Prompt Studio Status, then open Reverse Prompt again.",
          );
          return;
        }
        setState("ready");
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          `# Reverse Prompt Cannot Open\n\n${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }, []);

  if (state !== "ready") {
    return (
      <Detail
        isLoading={state === "checking"}
        navigationTitle="Reverse Prompt"
        markdown={message}
      />
    );
  }

  return (
    <ReversePromptForm
      argument={props.arguments?.source}
      fallbackText={props.fallbackText}
    />
  );
}

function ReversePromptForm({
  argument,
  fallbackText,
}: {
  argument?: string | undefined;
  fallbackText?: string | undefined;
}) {
  const { push } = useNavigation();
  const initial = initialReversePromptFields(argument, fallbackText);
  const [files, setFiles] = useState<string[]>(initial.files);
  const [url, setUrl] = useState(initial.url);
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<PromptTarget>("codex");
  const [error, setError] = useState<string>();
  const filesRef = useRef(files);
  const urlRef = useRef(url);
  filesRef.current = files;
  urlRef.current = url;

  useEffect(() => {
    if (files.length > 0 || url.trim()) return;
    let cancelled = false;
    void getSelectedFinderItems()
      .then((items) => {
        if (cancelled || filesRef.current.length > 0 || urlRef.current.trim()) {
          return;
        }
        const paths = items.map((item) => item.path).filter(Boolean);
        if (paths.length === 1) setFiles(paths);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [files.length, url]);

  async function submit() {
    try {
      const source = classifyReversePromptInput(
        reversePromptFormSource({ files, url }),
      );
      const thoughts = buildReversePromptThoughts({
        source,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        target,
      });
      setError(undefined);
      await pushEnhancePrompt(push, {
        launchContext: enhancePromptThoughtsLaunchContext(
          thoughts,
          target,
          source.kind === "url" ? "argument" : undefined,
        ),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Form
      navigationTitle="Reverse Prompt"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Continue to Enhance"
            icon={Icon.Wand}
            onSubmit={() => void submit()}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="One Source"
        text="Pick an image or video, or paste a URL. Reverse Prompt stays local on this screen: it only prepares a brief, then the existing Enhance form reviews cost and output before anything is saved."
      />
      <Form.FilePicker
        id="sourceFile"
        title="Image or Video"
        value={files}
        onChange={(paths) => {
          setFiles(paths);
          if (paths.length > 0) setUrl("");
        }}
        allowMultipleSelection={false}
        canChooseDirectories={false}
        canChooseFiles
      />
      <Form.TextField
        id="sourceUrl"
        title="URL"
        placeholder="https://example.com/design"
        value={url}
        onChange={(value) => {
          setUrl(value);
          if (value.trim()) setFiles([]);
        }}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        placeholder="Optional: what the reusable prompt should recreate or avoid."
        value={notes}
        onChange={setNotes}
      />
      <Form.Dropdown
        id="target"
        title="Target"
        value={target}
        onChange={(value) => setTarget(value as PromptTarget)}
      >
        <Form.Dropdown.Item title="Codex" value="codex" />
        <Form.Dropdown.Item title="Claude Code" value="claude-code" />
        <Form.Dropdown.Item title="Generic / Any Agent" value="generic" />
      </Form.Dropdown>
      <Form.Description
        text={
          error ??
          "No model request or credential lookup happens until you enhance. Review the compiled prompt before save or copy."
        }
      />
    </Form>
  );
}
