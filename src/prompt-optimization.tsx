import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  List,
  openCommandPreferences,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  defaultCompilerStatePath,
  loadCompilerState,
  rollbackCompilerPolicy,
  type CompilerState,
} from "./core/compiler-state";
import { getFeatureStatus, loadFeatureStatuses } from "./core/features";
import {
  listPromptUseFeedback,
  type PromptUseFeedbackRecord,
} from "./core/feedback-store";
import {
  approveOptimizationCandidate,
  availableOptimizationEvaluationCases,
  createOptimizationProposal,
  defaultOptimizationDirectory,
  deleteOptimizationProposal,
  exportOptimizationProposal,
  listOptimizationProposals,
  optimizationCandidatePolicy,
  recordOptimizationScores,
  type OptimizationCaseScore,
  type OptimizationCriteria,
  type OptimizationProposal,
} from "./core/optimization";
import {
  generateOptimizationCandidates,
  planOptimizationCandidateGeneration,
  type OptimizationGenerationPlan,
} from "./core/optimization-generation";
import { resolvePromptDirectory } from "./core/prompt-store";

interface Preferences {
  libraryDirectory?: string;
  openaiApiKey?: string;
}

type ProposalFilter =
  | "all"
  | "awaiting-evaluation"
  | "blocked"
  | "ready-for-approval"
  | "accepted";

export default function PromptOptimization() {
  const [proposals, setProposals] = useState<OptimizationProposal[]>([]);
  const [invalid, setInvalid] = useState<
    Array<{ filePath: string; error: string }>
  >([]);
  const [compilerState, setCompilerState] = useState<CompilerState>();
  const [featureDisabledReason, setFeatureDisabledReason] = useState<string>();
  const [featureState, setFeatureState] = useState<"preview" | "active">();
  const [filter, setFilter] = useState<ProposalFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const statuses = await loadFeatureStatuses();
      const feature = getFeatureStatus(statuses, "optimization");
      if (feature.effectiveState === "disabled") {
        setFeatureDisabledReason(
          feature.reason ??
            "Prompt Optimization is Disabled until Activation 15 reaches Preview.",
        );
        setFeatureState(undefined);
        setProposals([]);
        setInvalid([]);
        setCompilerState(undefined);
        return;
      }
      setFeatureDisabledReason(undefined);
      setFeatureState(feature.effectiveState);
      const [library, state] = await Promise.all([
        listOptimizationProposals(defaultOptimizationDirectory()),
        loadCompilerState(defaultCompilerStatePath()),
      ]);
      setProposals(library.proposals);
      setInvalid(library.invalid);
      setCompilerState(state);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptedProposalIds = useMemo(
    () =>
      new Set(
        compilerState?.policies
          .map((policy) => policy.proposalId)
          .filter((id): id is string => Boolean(id)) ?? [],
      ),
    [compilerState],
  );
  const visible = proposals.filter((proposal) => {
    if (filter === "all") return true;
    if (filter === "accepted") return acceptedProposalIds.has(proposal.id);
    return proposal.status === filter;
  });

  return (
    <List
      isLoading={loading}
      isShowingDetail={visible.length + invalid.length > 0}
      searchBarPlaceholder="Search proposals, evidence, candidates…"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter Proposals"
          value={filter}
          onChange={(value) => setFilter(value as ProposalFilter)}
        >
          <List.Dropdown.Item title="All Proposals" value="all" />
          <List.Dropdown.Item
            title="Awaiting Evaluation"
            value="awaiting-evaluation"
          />
          <List.Dropdown.Item title="Blocked" value="blocked" />
          <List.Dropdown.Item
            title="Ready for Approval"
            value="ready-for-approval"
          />
          <List.Dropdown.Item title="Accepted History" value="accepted" />
        </List.Dropdown>
      }
    >
      {!loading && featureDisabledReason ? (
        <List.EmptyView
          icon={Icon.CircleDisabled}
          title="Prompt Optimization Is Disabled"
          description={`${featureDisabledReason} No proposal, feedback, evaluation, or compiler-state files were read.`}
        />
      ) : null}
      {!loading && !featureDisabledReason && visible.length === 0 ? (
        <List.EmptyView
          icon={error ? Icon.ExclamationMark : Icon.BarChart}
          title={error ? "Optimization Unavailable" : "No Proposals Found"}
          description={
            error ??
            "Generate a proposal from explicitly selected feedback, then evaluate every candidate before approval."
          }
          actions={
            <ActionPanel>
              <Action.Push
                title="Generate New Proposal"
                icon={Icon.Plus}
                target={<NewOptimizationProposal onCreated={load} />}
              />
              <Action
                title="Reload Proposals"
                icon={Icon.ArrowClockwise}
                onAction={load}
              />
            </ActionPanel>
          }
        />
      ) : null}
      <List.Section
        title="Optimization Proposals"
        subtitle={`${visible.length}`}
      >
        {visible.map((proposal) => (
          <ProposalItem
            key={proposal.id}
            proposal={proposal}
            {...(compilerState ? { compilerState } : {})}
            {...(featureState ? { featureState } : {})}
            accepted={acceptedProposalIds.has(proposal.id)}
            onReload={load}
          />
        ))}
      </List.Section>
      {invalid.length > 0 ? (
        <List.Section title="Needs Repair" subtitle={`${invalid.length}`}>
          {invalid.map((item) => (
            <List.Item
              key={item.filePath}
              icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
              title={item.filePath.split("/").at(-1) ?? "Invalid proposal"}
              subtitle={item.error}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function ProposalItem({
  proposal,
  compilerState,
  featureState,
  accepted,
  onReload,
}: {
  proposal: OptimizationProposal;
  compilerState?: CompilerState;
  featureState?: "preview" | "active";
  accepted: boolean;
  onReload: () => Promise<void>;
}) {
  const winnerId = proposal.evaluation?.summary.winnerCandidateId;
  const winner = proposal.candidates.find(
    (candidate) => candidate.id === winnerId,
  );
  const isCurrent =
    compilerState?.policies.find(
      (policy) => policy.digest === compilerState.currentDigest,
    )?.proposalId === proposal.id;

  async function approve() {
    if (!winner || !compilerState) return;
    const policy = optimizationCandidatePolicy(proposal, winner.id);
    const confirmed = await confirmAlert({
      title: `Accept “${winner.title}”?`,
      message: [
        `Quality change: ${qualityChange(proposal)}.`,
        `Evaluation cost change: ${costChange(proposal)}.`,
        `Exact compiler digest: ${policy.digest}.`,
        featureState === "preview"
          ? "Preview acceptance records the policy and rollback version, but enhancement will not use it until Prompt Optimization becomes Active."
          : "The next enhancement will use this compiler policy. The previous version remains available for rollback.",
      ].join("\n\n"),
      primaryAction: { title: "Accept Evaluated Winner" },
    });
    if (!confirmed) return;
    await approveOptimizationCandidate(
      defaultOptimizationDirectory(),
      proposal.id,
      winner.id,
      policy.digest,
      defaultCompilerStatePath(),
      {
        expectedCurrentDigest: compilerState.currentDigest,
        confirmed: true,
      },
    );
    await showToast(
      Toast.Style.Success,
      featureState === "preview"
        ? "Compiler Policy Recorded for Preview"
        : "Compiler Policy Activated",
      "The prior version remains available for rollback.",
    );
    await onReload();
  }

  async function rollback() {
    if (!compilerState) return;
    const confirmed = await confirmAlert({
      title: `Roll back to ${proposal.baseline.version}?`,
      message:
        "The selected prior compiler becomes current. Later policies, proposals, scores, and feedback remain intact.",
      primaryAction: { title: "Roll Back Compiler" },
    });
    if (!confirmed) return;
    await rollbackCompilerPolicy(
      defaultCompilerStatePath(),
      proposal.baseline.digest,
      {
        expectedCurrentDigest: compilerState.currentDigest,
        confirmed: true,
      },
    );
    await showToast(Toast.Style.Success, "Compiler Rolled Back");
    await onReload();
  }

  async function remove() {
    const confirmed = await confirmAlert({
      title: `Delete “${proposal.title}”?`,
      message:
        "This deletes only an unaccepted proposal. Feedback, evaluations outside the proposal, prompts, and compiler state remain unchanged.",
      primaryAction: {
        title: "Delete Proposal",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (!confirmed) return;
    await deleteOptimizationProposal(
      defaultOptimizationDirectory(),
      proposal.id,
      new Set(
        compilerState?.policies
          .map((policy) => policy.proposalId)
          .filter((id): id is string => Boolean(id)) ?? [],
      ),
    );
    await showToast(Toast.Style.Success, "Proposal Deleted");
    await onReload();
  }

  return (
    <List.Item
      icon={proposalIcon(proposal, accepted, isCurrent)}
      title={proposal.title}
      subtitle={isCurrent ? "active compiler" : proposal.status}
      keywords={[
        proposal.id,
        proposal.title,
        proposal.status,
        ...proposal.candidates.flatMap((candidate) => [
          candidate.id,
          candidate.title,
          candidate.rationale,
          candidate.addendum,
        ]),
        ...proposal.evidence.feedback.flatMap((feedback) => [
          feedback.feedbackId,
          feedback.promptTitle,
          feedback.verdict,
          ...feedback.signals,
        ]),
      ]}
      accessories={[
        { text: `${proposal.evidence.feedback.length} feedback` },
        { text: `${proposal.evidence.evaluationCaseIds.length} cases` },
        ...(accepted ? [{ tag: isCurrent ? "active" : "accepted" }] : []),
      ]}
      detail={
        <List.Item.Detail
          markdown={proposalMarkdown(proposal, compilerState, isCurrent)}
        />
      }
      actions={
        <ActionPanel>
          {proposal.status === "ready-for-approval" && winner ? (
            <Action
              title="Review and Accept Winner"
              icon={Icon.CheckCircle}
              onAction={approve}
            />
          ) : null}
          <Action.Push
            title="Import Human-Reviewed Scores"
            icon={Icon.List}
            target={<ScoreImportForm proposal={proposal} onSaved={onReload} />}
          />
          <Action.Push
            title="Generate New Proposal"
            icon={Icon.Plus}
            target={<NewOptimizationProposal onCreated={onReload} />}
          />
          {accepted &&
          compilerState &&
          compilerState.currentDigest !== proposal.baseline.digest ? (
            <Action
              title="Roll Back to Proposal Baseline"
              icon={Icon.ArrowCounterClockwise}
              onAction={rollback}
            />
          ) : null}
          <Action.CopyToClipboard
            title="Copy Proposal as Markdown"
            content={exportOptimizationProposal(proposal, "markdown")}
          />
          <Action.CopyToClipboard
            title="Copy Proposal as JSON"
            content={exportOptimizationProposal(proposal, "json")}
          />
          <Action
            title="Reload Proposals"
            icon={Icon.ArrowClockwise}
            onAction={onReload}
          />
          {!accepted ? (
            <Action
              title="Delete Unaccepted Proposal"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={remove}
            />
          ) : null}
        </ActionPanel>
      }
    />
  );
}

interface NewProposalFormValues {
  title: string;
  feedbackIds: string[];
  evaluationCaseIds: string[];
  candidateCount: string;
  minimumDevelopmentGain: string;
  minimumValidationScore: string;
  maximumValidationRegression: string;
  maximumCostIncreasePercent: string;
}

function NewOptimizationProposal({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const { push } = useNavigation();
  const preferences = getPreferenceValues<Preferences>();
  const [feedback, setFeedback] = useState<PromptUseFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const cases = availableOptimizationEvaluationCases();

  useEffect(() => {
    let cancelled = false;
    void listPromptUseFeedback(
      resolvePromptDirectory(preferences.libraryDirectory),
    )
      .then((library) => {
        if (!cancelled) {
          setFeedback(library.records);
          if (library.invalid.length > 0) {
            setError(
              `${library.invalid.length} feedback record${library.invalid.length === 1 ? "" : "s"} need repair and were excluded.`,
            );
          }
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferences.libraryDirectory]);

  async function review(values: NewProposalFormValues) {
    try {
      const selectedFeedback = values.feedbackIds.map((id) => {
        const record = feedback.find((item) => item.id === id);
        if (!record) throw new Error(`Feedback ${id} is no longer available.`);
        return record;
      });
      const compilerState = await loadCompilerState(defaultCompilerStatePath());
      const currentCompiler = compilerState.policies.find(
        (policy) => policy.digest === compilerState.currentDigest,
      )!;
      const plan = planOptimizationCandidateGeneration({
        feedback: selectedFeedback,
        evaluationCaseIds: values.evaluationCaseIds,
        candidateCount: formNumber(
          values.candidateCount,
          "Candidate Count",
          2,
          4,
        ),
        currentCompiler,
      });
      const criteria: Partial<
        Omit<OptimizationCriteria, "protectedCasesMayRegress">
      > = {
        minimumDevelopmentGain: formNumber(
          values.minimumDevelopmentGain,
          "Minimum Development Gain",
          0,
          25,
        ),
        minimumValidationScore: formNumber(
          values.minimumValidationScore,
          "Minimum Validation Score",
          0,
          100,
        ),
        maximumValidationRegression: formNumber(
          values.maximumValidationRegression,
          "Maximum Validation Regression",
          0,
          10,
        ),
        maximumCostIncreasePercent: formNumber(
          values.maximumCostIncreasePercent,
          "Maximum Cost Increase",
          0,
          1_000,
        ),
      };
      push(
        <GenerationPlanReview
          title={values.title}
          feedback={selectedFeedback}
          evaluationCaseIds={values.evaluationCaseIds}
          criteria={criteria}
          currentCompilerDigest={compilerState.currentDigest}
          plan={plan}
          apiKey={preferences.openaiApiKey?.trim() ?? ""}
          onCreated={onCreated}
        />,
      );
    } catch (reviewError) {
      await showToast(
        Toast.Style.Failure,
        "Proposal Is Not Ready",
        reviewError instanceof Error
          ? reviewError.message
          : String(reviewError),
      );
    }
  }

  return (
    <Form
      isLoading={loading}
      navigationTitle="Generate Optimization Proposal"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Review Evidence and Cost"
            icon={Icon.Eye}
            onSubmit={review}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Safety Boundary"
        text="This creates alternatives only. Feedback does not change prompts or the compiler. A separate scored evaluation and exact-digest approval are required."
      />
      {error ? (
        <Form.Description title="Feedback Warning" text={error} />
      ) : null}
      <Form.TextField
        id="title"
        title="Proposal Title"
        placeholder="What should improve?"
      />
      <Form.TagPicker
        id="feedbackIds"
        title="Approved Feedback"
        placeholder="Select at least two records"
      >
        {feedback.map((record) => (
          <Form.TagPicker.Item
            key={record.id}
            value={record.id}
            title={`${record.prompt.title} · ${record.verdict}`}
            icon={
              record.verdict === "useful"
                ? Icon.CheckCircle
                : record.verdict === "not-useful"
                  ? Icon.XMarkCircle
                  : Icon.CircleDisabled
            }
          />
        ))}
      </Form.TagPicker>
      <Form.TagPicker
        id="evaluationCaseIds"
        title="Frozen Evaluation Cases"
        defaultValue={cases.map((item) => item.id)}
      >
        {cases.map((evaluationCase) => (
          <Form.TagPicker.Item
            key={evaluationCase.id}
            value={evaluationCase.id}
            title={`${evaluationCase.split} · ${evaluationCase.category}`}
          />
        ))}
      </Form.TagPicker>
      <Form.Dropdown
        id="candidateCount"
        title="Candidate Count"
        defaultValue="3"
      >
        <Form.Dropdown.Item title="2 Candidates" value="2" />
        <Form.Dropdown.Item title="3 Candidates" value="3" />
        <Form.Dropdown.Item title="4 Candidates" value="4" />
      </Form.Dropdown>
      <Form.Separator />
      <Form.TextField
        id="minimumDevelopmentGain"
        title="Minimum Development Gain"
        defaultValue="2"
        info="Required average-point gain on cases used while tuning."
      />
      <Form.TextField
        id="minimumValidationScore"
        title="Minimum Validation Score"
        defaultValue="85"
      />
      <Form.TextField
        id="maximumValidationRegression"
        title="Allowed Validation Regression"
        defaultValue="0"
      />
      <Form.TextField
        id="maximumCostIncreasePercent"
        title="Maximum Cost Increase %"
        defaultValue="25"
      />
      <Form.Description text="Protected cases may never regress. Candidate generation sends only the exact evidence shown on the next screen; prompt bodies, final prompts, private notes, and project paths are excluded." />
    </Form>
  );
}

function GenerationPlanReview({
  title,
  feedback,
  evaluationCaseIds,
  criteria,
  currentCompilerDigest,
  plan,
  apiKey,
  onCreated,
}: {
  title: string;
  feedback: PromptUseFeedbackRecord[];
  evaluationCaseIds: string[];
  criteria: Partial<Omit<OptimizationCriteria, "protectedCasesMayRegress">>;
  currentCompilerDigest: string;
  plan: OptimizationGenerationPlan;
  apiKey: string;
  onCreated: () => Promise<void>;
}) {
  const { pop } = useNavigation();
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!apiKey) {
      await showToast(
        Toast.Style.Failure,
        "OpenAI API Key Required",
        "Add a command-scoped key before candidate generation.",
      );
      await openCommandPreferences();
      return;
    }
    const confirmed = await confirmAlert({
      title: `Generate ${plan.candidateCount} candidates?`,
      message: `${plan.privacyDisclosure}\n\nConservative maximum: $${plan.maximumCostUsd.toFixed(6)}.\n\nRequest digest: ${plan.requestDigest}`,
      primaryAction: { title: "Send Reviewed Evidence" },
    });
    if (!confirmed) return;
    setLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Generating Compiler Candidates",
      `${plan.model} · one request`,
    );
    try {
      const compilerState = await loadCompilerState(defaultCompilerStatePath());
      if (compilerState.currentDigest !== currentCompilerDigest) {
        throw new Error(
          "The active compiler changed after review. Rebuild the proposal plan.",
        );
      }
      const generated = await generateOptimizationCandidates(plan, {
        apiKey,
        confirmedMaximumUsd: plan.maximumCostUsd,
      });
      const currentCompiler = compilerState.policies.find(
        (policy) => policy.digest === compilerState.currentDigest,
      )!;
      const proposal = await createOptimizationProposal(
        defaultOptimizationDirectory(),
        {
          title,
          feedback,
          approvedEvidence: true,
          evaluationCaseIds,
          candidates: generated.candidates,
          criteria,
          baseline: currentCompiler,
        },
      );
      toast.style = Toast.Style.Success;
      toast.title = "Proposal Ready for Evaluation";
      toast.message = `${proposal.candidates.length} candidates · no compiler change`;
      await onCreated();
      pop();
    } catch (generationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Candidate Generation Failed";
      toast.message =
        generationError instanceof Error
          ? generationError.message
          : String(generationError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Detail
      isLoading={loading}
      navigationTitle="Review Optimization Transmission"
      markdown={generationPlanMarkdown(plan)}
      actions={
        <ActionPanel>
          <Action
            title="Generate Candidates"
            icon={Icon.Wand}
            onAction={generate}
          />
          <Action.CopyToClipboard
            title="Copy Request Digest"
            content={plan.requestDigest}
          />
        </ActionPanel>
      }
    />
  );
}

function ScoreImportForm({
  proposal,
  onSaved,
}: {
  proposal: OptimizationProposal;
  onSaved: () => Promise<void>;
}) {
  const { pop } = useNavigation();

  async function save(values: { scoresJson: string }) {
    try {
      const parsed: unknown = JSON.parse(values.scoresJson);
      const scores = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            "scores" in parsed &&
            Array.isArray((parsed as { scores?: unknown }).scores)
          ? (parsed as { scores: unknown[] }).scores
          : undefined;
      if (!scores) {
        throw new Error("Paste a JSON score array or an object with scores.");
      }
      const updated = await recordOptimizationScores(
        defaultOptimizationDirectory(),
        proposal.id,
        scores as OptimizationCaseScore[],
      );
      await onSaved();
      await showToast(
        updated.status === "ready-for-approval"
          ? Toast.Style.Success
          : Toast.Style.Failure,
        updated.status === "ready-for-approval"
          ? "Proposal Passed Evaluation"
          : "Proposal Is Blocked",
        updated.evaluation?.summary.blockedReasons[0] ??
          "Review the full measured change.",
      );
      pop();
    } catch (saveError) {
      await showToast(
        Toast.Style.Failure,
        "Scores Were Not Saved",
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    }
  }

  return (
    <Form
      navigationTitle={`Scores · ${proposal.title}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Validate and Record Scores"
            icon={Icon.Check}
            onSubmit={save}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Required Coverage"
        text={`${proposal.candidates.length + 1} subjects × ${proposal.evidence.evaluationCaseIds.length} cases. Include baseline and every candidate, with completed human review for all scores.`}
      />
      <Form.TextArea
        id="scoresJson"
        title="Reviewed Score JSON"
        placeholder='{"scores":[...]}'
      />
      <Form.Description text="Development chooses the candidate. Validation checks that choice on separate cases. Any protected-case hard failure or regression blocks approval. Invalid or incomplete input leaves the existing proposal unchanged." />
    </Form>
  );
}

function proposalIcon(
  proposal: OptimizationProposal,
  accepted: boolean,
  current: boolean,
) {
  if (current) return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (accepted) return { source: Icon.Clock, tintColor: Color.Blue };
  if (proposal.status === "blocked") {
    return { source: Icon.XMarkCircle, tintColor: Color.Red };
  }
  if (proposal.status === "ready-for-approval") {
    return { source: Icon.CheckRosette, tintColor: Color.Orange };
  }
  return { source: Icon.Clock, tintColor: Color.SecondaryText };
}

function proposalMarkdown(
  proposal: OptimizationProposal,
  compilerState: CompilerState | undefined,
  current: boolean,
): string {
  const active = compilerState?.policies.find(
    (policy) => policy.digest === compilerState.currentDigest,
  );
  return [
    exportOptimizationProposal(proposal, "markdown").trim(),
    "## Current Compiler",
    current
      ? `This proposal supplies the current compiler policy: \`${active?.version}\`.`
      : `Current: \`${active?.version ?? "not loaded"}\`  \nDigest: \`${active?.digest ?? "not loaded"}\``,
    "## Approval Boundary",
    "Candidates remain proposals until the winning candidate passes development, validation, and protected cases and you accept its exact digest. Feedback never changes the compiler by itself.",
  ].join("\n\n");
}

function qualityChange(proposal: OptimizationProposal): string {
  const change = proposal.evaluation?.summary.qualityChange;
  if (!change) return "not evaluated";
  return `development ${signed(change.development)}, validation ${signed(change.validation)}, protected ${signed(change.protected)}`;
}

function costChange(proposal: OptimizationProposal): string {
  const percent = proposal.evaluation?.summary.costChange.percent;
  return percent === undefined ? "not evaluated" : `${signed(percent)}%`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formNumber(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function generationPlanMarkdown(plan: OptimizationGenerationPlan): string {
  const feedback = plan.payload.selectedFeedback
    .map((item) => {
      const fields = [
        `- **${item.promptTitle}** · ${item.verdict}${item.rating ? ` · ${item.rating}/5` : ""}`,
        `  - Feedback ID: \`${item.id}\``,
        ...(item.critique ? [`  - Critique: ${item.critique}`] : []),
        ...(item.correction ? [`  - Correction: ${item.correction}`] : []),
        ...(item.outcome
          ? [
              `  - Outcome: ${item.outcome.status}${item.outcome.summary ? ` — ${item.outcome.summary}` : ""}`,
            ]
          : []),
      ];
      return fields.join("\n");
    })
    .join("\n");
  const cases = plan.payload.evaluationCases
    .map(
      (evaluationCase) =>
        `- \`${evaluationCase.id}\` · ${evaluationCase.split} · ${evaluationCase.category}`,
    )
    .join("\n");
  return [
    "# Review Optimization Transmission",
    "One OpenAI request will propose addenda only. It cannot change the active compiler.",
    "## Exact Feedback Evidence",
    feedback,
    "## Frozen Evaluation Contract",
    cases,
    "## Excluded",
    "- Prompt bodies",
    "- Final edited prompts",
    "- Private notes",
    "- Project paths and source files",
    "- Provider credentials",
    "- Existing evaluation outputs",
    "## Provider and Cost",
    `- Model: \`${plan.model}\``,
    `- Reasoning: ${plan.reasoningEffort}`,
    `- Candidates: ${plan.candidateCount}`,
    `- Conservative maximum: $${plan.maximumCostUsd.toFixed(6)}`,
    `- Request digest: \`${plan.requestDigest}\``,
    "## Privacy",
    plan.privacyDisclosure,
    "Generation does not claim improvement. Every candidate must still be scored on development, validation, and protected cases before exact-digest approval.",
  ].join("\n\n");
}
