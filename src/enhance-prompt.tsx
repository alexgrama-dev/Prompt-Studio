import {
  Action,
  ActionPanel,
  Alert,
  Clipboard,
  closeMainWindow,
  confirmAlert,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  Keyboard,
  launchCommand,
  LaunchType,
  List,
  LocalStorage,
  openCommandPreferences,
  openExtensionPreferences,
  showHUD,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONTEXT7_PRIVACY_DISCLOSURE,
  context7ApiKeyForApprovedRequest,
  detectTechnicalLibrary,
  findContext7ProjectVersion,
  planContext7Research,
  researchWithContext7,
  type Context7Plan,
  type Context7ResearchResult,
} from "./core/context7-research";
import {
  enhancementResultToPromptDraft,
  validateEnhancementResult,
  type EnhancementRequest,
  type EnhancementResearchLevel,
  type EnhancementResult,
  type EnhancementRun,
  type EnhancementRunProfile,
} from "./core/enhancement";
import {
  activeCompilerPolicyForStatuses,
  dispatchEnhancement,
} from "./core/enhancement-dispatch";
import {
  enhancementRunWasCancelled,
  finishEnhancementHistory,
  type PendingEnhancementHistory,
} from "./core/enhancement-completion";
import {
  restorableEnhancementFormDraft,
  type EnhancementFormDraft,
} from "./core/enhancement-form-draft";
import {
  blindEvaluationRecords,
  fullMarksHumanReview,
  getEnhancementEvaluationPlan,
  HUMAN_REVIEW_SCORE_MAXIMUMS,
  latestEnhancementEvaluation,
  loadEnhancementEvaluation,
  recordEnhancementEvaluationReview,
  runEnhancementEvaluation,
  type EnhancementEvaluationDocument,
  type EnhancementEvaluationRecord,
  type EnhancementEvaluationRun,
  type EnhancementHumanReviewInput,
} from "./core/evaluation";
import {
  EXA_PRIVACY_DISCLOSURE,
  maximumExaResearchCostUsd,
  planExaResearch,
  researchWithExa,
  type ExaResearchPlan,
  type ExaResearchResult,
} from "./core/exa-research";
import {
  GITHUB_MCP_PRIVACY_DISCLOSURE,
  githubTokenTemplateUrl,
  planGithubMcpResearch,
  researchWithGithubMcp,
  type GithubMcpPlan,
  type GithubMcpResearchResult,
} from "./core/github-mcp-research";
import {
  getFeatureStatus,
  loadFeatureStatuses,
  type FeatureState,
} from "./core/features";
import {
  claimProjectDiscovery,
  collectProjectContext,
  discoverGitProjects,
  discoverSshGitProjects,
  groupDiscoveredProjects,
  includedProjectFiles,
  parseSshProjectSource,
  renderProjectContext,
  type DiscoveredProject,
  type ProjectContextBundle,
} from "./core/project-context";
import { planResearchRoutes } from "./core/research-router";
import {
  FOCUSED_RESEARCH_PRIVACY_DISCLOSURE,
  focusedResearchIntent,
  maximumFocusedResearchCostUsd,
  planFocusedResearch,
  type FocusedResearchRoute,
} from "./core/research-intent";
import { mergeReviewedSources } from "./core/research-safety";
import {
  enhancementHistoryDigest,
  enhancementHistoryDirectory,
  listPrompts,
  recordEnhancementHistory,
  resolvePromptDirectory,
  saveEnhancementHistoryToLibrary,
  updatePrompt,
  type InvalidPrompt,
  type PromptRecord,
  type PromptSeedReference,
  type PromptTarget,
} from "./core/prompt-store";
import {
  ideaStudioLaunchContext,
  type EnhancePromptLaunchContext,
} from "./core/launch-context";
import {
  enhancementProfileIsAvailable,
  estimatedProviderMaximumCostUsd,
  getProviderEnhancementProfile,
  providerPricingDisclosure,
  providerPrivacyDisclosure,
  type SelectableEnhancementProfileId,
} from "./core/provider-profiles";
import {
  OPENAI_WEB_PRIVACY_DISCLOSURE,
  planWebResearch,
  researchWithOpenAIWeb,
  type WebResearchPlan,
  type WebResearchResult,
} from "./core/web-research";
import FeatureStatus from "./feature-status";

interface Preferences {
  libraryDirectory?: string;
  openaiApiKey?: string;
  projectRoots?: string;
  sshProjectRoot?: string;
}

interface EnhancementFormValues {
  roughThoughts: string;
  target: PromptTarget;
  project: string;
  repositoryFolder?: string[];
  setupMode: "smart" | "custom";
  profileId: SelectableEnhancementProfileId;
  researchLevel: EnhancementResearchLevel;
  oneRunInstruction: string;
}

interface EditorValues {
  title: string;
  summary: string;
  target: PromptTarget;
  enhancedPrompt: string;
}

interface PendingEnhancement {
  request: EnhancementRequest;
  run: EnhancementRun;
  directory: string;
  seed: PromptSeedReference;
  completion: PendingEnhancementHistory;
}

const RECENT_PROJECTS_KEY = "prompt-studio.recent-projects.v1";
const ENHANCEMENT_FORM_DRAFT_KEY = "prompt-studio.enhancement-form-draft.v1";

export default function EnhancePrompt(props: {
  arguments?: { thoughts?: string };
  fallbackText?: string;
  launchContext?: EnhancePromptLaunchContext;
}) {
  const initialThoughts =
    props.launchContext?.thoughts ??
    (props.arguments?.thoughts?.trim() || props.fallbackText?.trim() || "");
  const initialTarget = props.launchContext?.target ?? "codex";
  const initialSeed = props.launchContext?.seedId
    ? { id: props.launchContext.seedId, thoughts: initialThoughts }
    : undefined;
  const revisionOfPromptId = props.launchContext?.revisionOfPromptId;
  const [state, setState] = useState<
    "checking" | "disabled" | "preview" | "active" | "error"
  >("checking");
  const [message, setMessage] = useState("Checking activation status…");
  const [projectContextState, setProjectContextState] =
    useState<FeatureState>("disabled");
  const [context7State, setContext7State] = useState<FeatureState>("disabled");
  const [webState, setWebState] = useState<FeatureState>("disabled");
  const [exaState, setExaState] = useState<FeatureState>("disabled");
  const [githubState, setGithubState] = useState<FeatureState>("disabled");
  const [anthropicState, setAnthropicState] =
    useState<FeatureState>("disabled");
  const [googleState, setGoogleState] = useState<FeatureState>("disabled");

  useEffect(() => {
    void loadFeatureStatuses()
      .then((statuses) => {
        const feature = getFeatureStatus(statuses, "openai-enhancement");
        setProjectContextState(
          getFeatureStatus(statuses, "project-context").effectiveState,
        );
        setContext7State(
          getFeatureStatus(statuses, "context7-research").effectiveState,
        );
        setWebState(getFeatureStatus(statuses, "web-research").effectiveState);
        setExaState(getFeatureStatus(statuses, "exa-research").effectiveState);
        setGithubState(
          getFeatureStatus(statuses, "github-mcp-research").effectiveState,
        );
        setAnthropicState(
          getFeatureStatus(statuses, "anthropic-provider").effectiveState,
        );
        setGoogleState(
          getFeatureStatus(statuses, "google-provider").effectiveState,
        );
        if (feature.effectiveState === "disabled") {
          setState("disabled");
          setMessage(
            "# Prompt Enhancement Is Disabled\n\nThis is **Activation 3**. Its compiler, privacy checks, and saved evaluation cases must pass before it can make a model request.\n\nNo model request or credential lookup occurred.",
          );
          return;
        }
        setState(feature.effectiveState);
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(
          `# Activation Configuration Error\n\n${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }, []);

  if (state === "preview" || state === "active") {
    return (
      <EnhancementWorkspace
        state={state}
        initialThoughts={initialThoughts}
        initialTarget={initialTarget}
        {...(initialSeed ? { initialSeed } : {})}
        revisionOfPromptId={revisionOfPromptId}
        projectContextState={projectContextState}
        context7State={context7State}
        webState={webState}
        exaState={exaState}
        githubState={githubState}
        anthropicState={anthropicState}
        googleState={googleState}
      />
    );
  }
  return (
    <Detail
      isLoading={state === "checking"}
      navigationTitle="Enhance Prompt"
      markdown={message}
    />
  );
}

function EnhancementWorkspace({
  state,
  projectContextState,
  context7State,
  webState,
  exaState,
  githubState,
  anthropicState,
  googleState,
  initialThoughts,
  initialTarget,
  initialSeed,
  revisionOfPromptId,
}: {
  state: "preview" | "active";
  projectContextState: FeatureState;
  context7State: FeatureState;
  webState: FeatureState;
  exaState: FeatureState;
  githubState: FeatureState;
  anthropicState: FeatureState;
  googleState: FeatureState;
  initialThoughts: string;
  initialTarget: PromptTarget;
  initialSeed?: PromptSeedReference;
  revisionOfPromptId?: string | undefined;
}) {
  const preferences = getPreferenceValues<Preferences>();
  const { push } = useNavigation();
  const [setupMode, setSetupMode] =
    useState<EnhancementFormValues["setupMode"]>("smart");
  const [profileId, setProfileId] =
    useState<EnhancementFormValues["profileId"]>("openai-standard-v1");
  const [researchLevel, setResearchLevel] =
    useState<EnhancementResearchLevel>("none");
  const [roughThoughts, setRoughThoughts] = useState(initialThoughts);
  const [target, setTarget] = useState<PromptTarget>(initialTarget);
  const [oneRunInstruction, setOneRunInstruction] = useState("");
  const [activeSeed, setActiveSeed] = useState<PromptSeedReference | undefined>(
    initialSeed,
  );
  const [projects, setProjects] = useState<DiscoveredProject[]>([]);
  const [recentProjectPaths, setRecentProjectPaths] = useState<string[]>([]);
  const [projectDiscoveryLoading, setProjectDiscoveryLoading] = useState(false);
  const [projectDiscoveryError, setProjectDiscoveryError] = useState<string>();
  const [project, setProject] = useState("none");
  const [repositoryFolder, setRepositoryFolder] = useState<string[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationReport, setEvaluationReport] =
    useState<EnhancementEvaluationRun>();
  const [pendingEnhancement, setPendingEnhancement] =
    useState<PendingEnhancement>();
  const activeController = useRef<AbortController | undefined>(undefined);
  const evaluationController = useRef<AbortController | undefined>(undefined);
  const formDraftLoaded = useRef(false);
  const projectDiscoveryStarted = useRef(false);
  const effectiveProfileId = profileId;
  const effectiveResearchLevel = setupMode === "smart" ? "none" : researchLevel;
  const profile = getProviderEnhancementProfile(effectiveProfileId);
  const profileAvailable = enhancementProfileIsAvailable(profileId, {
    anthropic: anthropicState,
    google: googleState,
  });
  const estimatedCost = useMemo(
    () =>
      estimatedProviderMaximumCostUsd({
        roughThoughts: roughThoughts || "placeholder",
        target: "generic",
        profileId: effectiveProfileId,
        researchLevel: effectiveResearchLevel,
      }),
    [effectiveProfileId, effectiveResearchLevel, roughThoughts],
  );
  const projectGroups = useMemo(
    () => groupDiscoveredProjects(projects, recentProjectPaths),
    [projects, recentProjectPaths],
  );

  useEffect(() => {
    void LocalStorage.getItem<string>(ENHANCEMENT_FORM_DRAFT_KEY)
      .then((stored) => {
        const draft = restorableEnhancementFormDraft(stored, initialThoughts);
        if (!draft) return;
        setRoughThoughts(draft.roughThoughts);
        setTarget(draft.target);
        setProject(draft.project);
        setRepositoryFolder(draft.repositoryFolder);
        setShowFolderPicker(draft.repositoryFolder.length > 0);
        setSetupMode(draft.setupMode);
        setProfileId(draft.profileId);
        setResearchLevel(draft.researchLevel);
        setOneRunInstruction(draft.oneRunInstruction);
        setActiveSeed(
          draft.seedId
            ? { id: draft.seedId, thoughts: draft.roughThoughts }
            : undefined,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        formDraftLoaded.current = true;
      });
  }, [initialThoughts]);

  useEffect(() => {
    if (!formDraftLoaded.current) return;
    const draft: EnhancementFormDraft = {
      roughThoughts,
      target,
      project,
      repositoryFolder,
      setupMode,
      profileId,
      researchLevel,
      oneRunInstruction,
      ...(activeSeed?.id ? { seedId: activeSeed.id } : {}),
    };
    void LocalStorage.setItem(
      ENHANCEMENT_FORM_DRAFT_KEY,
      JSON.stringify(draft),
    ).catch(() => undefined);
  }, [
    oneRunInstruction,
    activeSeed?.id,
    profileId,
    project,
    repositoryFolder,
    researchLevel,
    roughThoughts,
    setupMode,
    target,
  ]);

  async function loadProjects() {
    if (
      projectContextState === "disabled" ||
      !claimProjectDiscovery(projectDiscoveryStarted)
    ) {
      return;
    }
    setProjectDiscoveryLoading(true);
    try {
      const source = parseSshProjectSource(preferences.sshProjectRoot);
      const [local, remote, recent] = await Promise.allSettled([
        discoverGitProjects(preferences.projectRoots),
        source ? discoverSshGitProjects(source) : Promise.resolve([]),
        loadRecentProjectPaths(),
      ]);
      const discovered = [
        ...(local.status === "fulfilled" ? local.value : []),
        ...(remote.status === "fulfilled" ? remote.value : []),
      ];
      setProjects(discovered);
      setRecentProjectPaths(recent.status === "fulfilled" ? recent.value : []);
      const failures = [
        ...(local.status === "rejected"
          ? [
              local.reason instanceof Error
                ? local.reason.message
                : String(local.reason),
            ]
          : []),
        ...(remote.status === "rejected"
          ? ["Mac Mini is unavailable over SSH. Local projects still work."]
          : []),
      ];
      setProjectDiscoveryError(failures.join(" "));
    } catch (error) {
      setProjectDiscoveryError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setProjectDiscoveryLoading(false);
    }
  }

  useEffect(() => {
    void latestEnhancementEvaluation()
      .then((report) => {
        if (report) setEvaluationReport(report);
      })
      .catch(() => {
        // The review action stays hidden until a valid completed report exists.
      });
  }, []);

  async function submit(values: EnhancementFormValues) {
    values = {
      ...values,
      setupMode,
      profileId,
      researchLevel: setupMode === "smart" ? "none" : researchLevel,
      oneRunInstruction:
        setupMode === "smart" ? "" : (values.oneRunInstruction ?? ""),
    };
    const explicitlySelectedRepository =
      values.repositoryFolder?.[0]?.trim() || undefined;
    const selectedRepository =
      explicitlySelectedRepository ||
      (values.project === "none" ? undefined : values.project);
    const hasSelectedProject = selectedRepository !== undefined;
    if (
      !enhancementProfileIsAvailable(values.profileId, {
        anthropic: anthropicState,
        google: googleState,
      })
    ) {
      await showToast(
        Toast.Style.Failure,
        "Saved Provider Is Unavailable",
        "Open Advanced Provider and choose an enabled provider. Your task remains unchanged.",
      );
      return;
    }
    if (hasSelectedProject && projectContextState === "disabled") {
      await showToast(
        Toast.Style.Failure,
        "Project Context Is Not Active",
        "Choose No Repository until Activation 4 passes.",
      );
      return;
    }
    let projectBundle: ProjectContextBundle | undefined;
    if (selectedRepository) {
      setIsLoading(true);
      const toast = await showToast(
        Toast.Style.Animated,
        "Reading Project",
        "Read-only. Nothing is sent yet.",
      );
      try {
        projectBundle = await collectProjectContext(
          selectedRepository,
          values.roughThoughts,
          {
            ...(preferences.projectRoots
              ? { configuredRoots: preferences.projectRoots }
              : {}),
            ...(preferences.sshProjectRoot
              ? { sshProjectRoot: preferences.sshProjectRoot }
              : {}),
            explicitlySelected: Boolean(explicitlySelectedRepository),
          },
        );
        toast.style = Toast.Style.Success;
        toast.title = "Project Ready";
        toast.message = "Review included files before enhancement.";
        const recentPaths = [
          selectedRepository,
          ...recentProjectPaths.filter((path) => path !== selectedRepository),
        ].slice(0, 5);
        setRecentProjectPaths(recentPaths);
        await LocalStorage.setItem(
          RECENT_PROJECTS_KEY,
          JSON.stringify(recentPaths),
        ).catch(() => undefined);
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = "Project Unavailable";
        toast.message = error instanceof Error ? error.message : String(error);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    const detectedLibrary = detectTechnicalLibrary(
      values.roughThoughts,
      projectBundle,
    );
    const inferredVersion =
      projectBundle && detectedLibrary && !detectedLibrary.version
        ? findContext7ProjectVersion(
            projectBundle,
            detectedLibrary.libraryInput,
          )
        : undefined;
    const technicalLibrary = detectedLibrary?.libraryInput ?? "";
    const libraryVersion =
      detectedLibrary?.version ?? inferredVersion?.version ?? "";
    const libraryVersionSource =
      detectedLibrary?.sourcePath ?? inferredVersion?.sourcePath;
    const routing = planResearchRoutes({
      roughThoughts: values.roughThoughts,
      researchLevel: values.researchLevel,
      hasSelectedProject,
      technicalLibrary,
    });
    if (values.researchLevel !== "none") {
      if (routing.routes.includes("context7") && context7State === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "Context7 Research Is Not Active",
          "Choose No Research until Activation 5 passes.",
        );
        return;
      }
      if (routing.routes.includes("web") && webState === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "Current Web Research Is Not Active",
          "Choose No Research until Activation 6 passes.",
        );
        return;
      }
      if (routing.routes.includes("exa") && exaState === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "Exa Research Is Not Active",
          "Choose Automatic or No Research until Activation 7 passes.",
        );
        return;
      }
      if (routing.routes.includes("github") && githubState === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "GitHub MCP Research Is Not Active",
          "Choose No Research until Activation 8 passes.",
        );
        return;
      }
      const unavailableRoutes = routing.routes.filter(
        (route) =>
          route !== "none" &&
          route !== "local-project" &&
          route !== "context7" &&
          route !== "github" &&
          route !== "web" &&
          route !== "exa",
      );
      if (unavailableRoutes.length > 0) {
        await showToast(
          Toast.Style.Failure,
          "Required Research Source Is Not Active",
          `${unavailableRoutes.map(title).join(", ")} must pass its numbered activation before this task can use it.`,
        );
        return;
      }
      if (
        !routing.routes.includes("context7") &&
        !routing.routes.includes("github") &&
        !routing.routes.includes("web") &&
        !routing.routes.includes("exa")
      ) {
        await showToast(
          Toast.Style.Failure,
          "No External Research Need Identified",
          routing.reasons.none ??
            "Choose No Research unless the task needs current external information.",
        );
        return;
      }
    }
    let context7Plan: Context7Plan | undefined;
    let githubPlan: GithubMcpPlan | undefined;
    let webPlan: WebResearchPlan | undefined;
    let exaPlan: ExaResearchPlan | undefined;
    try {
      context7Plan = !routing.routes.includes("context7")
        ? undefined
        : planContext7Research(
            values.roughThoughts,
            values.researchLevel,
            technicalLibrary,
            libraryVersion,
          );
      githubPlan = !routing.routes.includes("github")
        ? undefined
        : planGithubMcpResearch(values.roughThoughts, values.researchLevel, {
            hasSelectedProject,
            ...(technicalLibrary ? { technicalLibrary } : {}),
          });
      webPlan = !routing.routes.includes("web")
        ? undefined
        : planWebResearch(values.roughThoughts, values.researchLevel, {
            hasSelectedProject,
            ...(technicalLibrary ? { technicalLibrary } : {}),
          });
      exaPlan = !routing.routes.includes("exa")
        ? undefined
        : planExaResearch(values.roughThoughts, values.researchLevel, {
            hasSelectedProject,
            ...(technicalLibrary ? { technicalLibrary } : {}),
          });
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Plan Research",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
    if (webPlan?.route === "none") {
      await showToast(
        Toast.Style.Failure,
        "Current Web Research Not Justified",
        webPlan.reason,
      );
      return;
    }
    if (githubPlan?.route === "none") {
      await showToast(
        Toast.Style.Failure,
        "Exact GitHub Repository Required",
        githubPlan.reason,
      );
      return;
    }
    if (context7Plan?.route === "none") {
      await showToast(
        Toast.Style.Failure,
        "Technical Library Required",
        context7Plan.reason,
      );
      return;
    }
    if (exaPlan?.route === "none") {
      await showToast(
        Toast.Style.Failure,
        "Broader Exa Research Not Justified",
        exaPlan.reason,
      );
      return;
    }
    if (webPlan || exaPlan) {
      const apiKey = preferences.openaiApiKey?.trim();
      if (!apiKey) {
        await showToast(
          Toast.Style.Failure,
          "OpenAI API Key Required",
          "Add the key before Prompt Studio creates focused research questions.",
        );
        await openExtensionPreferences();
        return;
      }
      const maximumCost = maximumFocusedResearchCostUsd();
      const confirmed = await confirmAlert({
        title: "Create a focused research plan?",
        message: `This sends a privacy-filtered version of the rough task—but no project files—to GPT-5.6 Terra. It extracts the facts to investigate and prepares provider-specific queries. The planning cost is capped at $${maximumCost.toFixed(2)}. You will review the resulting query before any web or Exa search.`,
        primaryAction: {
          title: `Plan Up to $${maximumCost.toFixed(2)}`,
          style: Alert.ActionStyle.Default,
        },
      });
      if (!confirmed) return;

      const controller = new AbortController();
      activeController.current = controller;
      setIsLoading(true);
      const toast = await showToast(
        Toast.Style.Animated,
        "Finding What to Research",
        "No web or Exa search has started.",
      );
      try {
        const routes = [
          ...(webPlan ? (["web"] as const) : []),
          ...(exaPlan ? (["exa"] as const) : []),
        ] satisfies FocusedResearchRoute[];
        const focusedPlan = await planFocusedResearch(
          {
            roughThoughts: values.roughThoughts,
            researchLevel: values.researchLevel as Exclude<
              EnhancementResearchLevel,
              "none"
            >,
            routes,
            ...(technicalLibrary ? { technicalLibrary } : {}),
          },
          {
            apiKey,
            signal: controller.signal,
          },
        );
        webPlan = webPlan
          ? planWebResearch(values.roughThoughts, values.researchLevel, {
              hasSelectedProject,
              ...(technicalLibrary ? { technicalLibrary } : {}),
              intent: focusedResearchIntent(focusedPlan, "web"),
            })
          : undefined;
        exaPlan = exaPlan
          ? planExaResearch(values.roughThoughts, values.researchLevel, {
              hasSelectedProject,
              ...(technicalLibrary ? { technicalLibrary } : {}),
              intent: focusedResearchIntent(focusedPlan, "exa"),
            })
          : undefined;
        toast.style = Toast.Style.Success;
        toast.title = "Focused Research Plan Ready";
        toast.message = "Review the questions and exact provider query next.";
      } catch (error) {
        toast.style = Toast.Style.Failure;
        toast.title = controller.signal.aborted
          ? "Research Planning Cancelled"
          : "Research Planning Failed";
        toast.message = error instanceof Error ? error.message : String(error);
        return;
      } finally {
        activeController.current = undefined;
        setIsLoading(false);
      }
    }
    const request: EnhancementRequest = {
      roughThoughts: values.roughThoughts,
      target: values.target,
      profileId: values.profileId,
      researchLevel: values.researchLevel,
      ...(values.oneRunInstruction.trim()
        ? { oneRunInstruction: values.oneRunInstruction }
        : {}),
    };
    if (projectBundle) {
      push(
        <ProjectContextReview
          request={request}
          bundle={projectBundle}
          nextStep={
            context7Plan || githubPlan || webPlan || exaPlan
              ? "research review"
              : "enhancement"
          }
          onContinue={(reviewedRequest) =>
            continueAfterProject(
              reviewedRequest,
              context7Plan,
              githubPlan,
              webPlan,
              exaPlan,
              libraryVersionSource,
            )
          }
        />,
      );
      return;
    }
    await continueAfterProject(
      request,
      context7Plan,
      githubPlan,
      webPlan,
      exaPlan,
    );
  }

  async function continueAfterProject(
    request: EnhancementRequest,
    context7Plan?: Context7Plan,
    githubPlan?: GithubMcpPlan,
    webPlan?: WebResearchPlan,
    exaPlan?: ExaResearchPlan,
    versionSource?: string,
  ) {
    if (!context7Plan) {
      await continueAfterContext7(request, githubPlan, webPlan, exaPlan);
      return;
    }
    push(
      <Context7PlanReview
        request={request}
        plan={context7Plan}
        context7State={context7State}
        {...(versionSource ? { versionSource } : {})}
        onContinue={(reviewedRequest) =>
          continueAfterContext7(reviewedRequest, githubPlan, webPlan, exaPlan)
        }
        onCancelContinue={cancel}
      />,
    );
  }

  async function continueAfterContext7(
    request: EnhancementRequest,
    githubPlan?: GithubMcpPlan,
    webPlan?: WebResearchPlan,
    exaPlan?: ExaResearchPlan,
  ) {
    if (!githubPlan) {
      await continueAfterGithub(request, webPlan, exaPlan);
      return;
    }
    push(
      <GithubMcpPlanReview
        request={request}
        plan={githubPlan}
        onContinue={(reviewedRequest) =>
          continueAfterGithub(reviewedRequest, webPlan, exaPlan)
        }
        onCancelContinue={cancel}
      />,
    );
  }

  async function continueAfterGithub(
    request: EnhancementRequest,
    webPlan?: WebResearchPlan,
    exaPlan?: ExaResearchPlan,
  ) {
    if (!webPlan) {
      await continueAfterWeb(request, exaPlan);
      return;
    }
    push(
      <WebResearchPlanReview
        request={request}
        plan={webPlan}
        onContinue={(reviewedRequest) =>
          continueAfterWeb(reviewedRequest, exaPlan)
        }
        onCancelContinue={cancel}
      />,
    );
  }

  async function continueAfterWeb(
    request: EnhancementRequest,
    exaPlan?: ExaResearchPlan,
  ) {
    if (!exaPlan) {
      await runEnhancement(request);
      return;
    }
    push(
      <ExaResearchPlanReview
        request={request}
        plan={exaPlan}
        onContinue={runEnhancement}
        onCancelContinue={cancel}
      />,
    );
  }

  async function runEnhancement(request: EnhancementRequest) {
    if (activeController.current) return;
    const selectedProfile = getProviderEnhancementProfile(
      request.profileId as SelectableEnhancementProfileId,
    );
    if (selectedProfile.provider === "anthropic") {
      push(
        <ProviderApiKeyForm
          provider="anthropic"
          profile={selectedProfile}
          onSubmit={(apiKey) => executeEnhancement(request, apiKey)}
          onCancel={() => activeController.current?.abort()}
        />,
      );
      return;
    }
    if (selectedProfile.provider === "google") {
      push(
        <ProviderApiKeyForm
          provider="google"
          profile={selectedProfile}
          onSubmit={(apiKey) => executeEnhancement(request, apiKey)}
          onCancel={() => activeController.current?.abort()}
        />,
      );
      return;
    }
    const openaiApiKey = preferences.openaiApiKey?.trim();
    if (!openaiApiKey) {
      await showToast(
        Toast.Style.Failure,
        "OpenAI API Key Required",
        "Add the shared key in Prompt Studio extension preferences before enhancing.",
      );
      await openExtensionPreferences();
      return;
    }
    await executeEnhancement(request, openaiApiKey);
  }

  async function executeEnhancement(
    request: EnhancementRequest,
    apiKey: string,
  ) {
    if (activeController.current) return;
    const selectedProfile = getProviderEnhancementProfile(
      request.profileId as SelectableEnhancementProfileId,
    );
    const controller = new AbortController();
    activeController.current = controller;
    setIsLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Enhancing Prompt",
      `${selectedProfile.title} · ${selectedProfile.passes === 2 ? "two passes" : "one pass"}`,
    );
    try {
      const compilerPolicy = await activeCompilerPolicyForStatuses(
        await loadFeatureStatuses(),
      );
      const effectiveRequest = compilerPolicy
        ? { ...request, compilerPolicy }
        : request;
      const run = await dispatchEnhancement(effectiveRequest, {
        apiKey,
        signal: controller.signal,
      });
      const directory = resolvePromptDirectory(preferences.libraryDirectory);
      const seed: PromptSeedReference = {
        thoughts: effectiveRequest.roughThoughts,
        ...(activeSeed?.id &&
        activeSeed.thoughts === effectiveRequest.roughThoughts
          ? { id: activeSeed.id }
          : {}),
      };
      const pending: PendingEnhancement = {
        request: effectiveRequest,
        run,
        directory,
        seed,
        completion: {},
      };
      setPendingEnhancement(pending);
      await completeEnhancement(pending, toast);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = enhancementRunWasCancelled(error, controller.signal)
        ? "Enhancement Cancelled"
        : "Enhancement Failed";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      activeController.current = undefined;
      setIsLoading(false);
    }
  }

  async function completeEnhancement(
    pending: PendingEnhancement,
    existingToast?: Awaited<ReturnType<typeof showToast>>,
  ) {
    const toast =
      existingToast ??
      (await showToast(
        Toast.Style.Animated,
        "Saving Enhancement History",
        "The model request will not run again.",
      ));
    setIsLoading(true);
    try {
      const history = await finishEnhancementHistory(
        pending.completion,
        () =>
          recordEnhancementHistory(
            pending.directory,
            enhancementResultToPromptDraft(
              pending.run,
              pending.request,
              pending.seed,
            ),
          ),
        () => LocalStorage.removeItem(ENHANCEMENT_FORM_DRAFT_KEY),
      );
      setPendingEnhancement(undefined);
      toast.style = Toast.Style.Success;
      toast.title = "Enhancement Ready";
      toast.message = "Saved to Enhancement History.";
      push(
        <EnhancementPreview
          request={pending.request}
          run={pending.run}
          directory={pending.directory}
          history={history}
          revisionOfPromptId={revisionOfPromptId}
          seed={pending.seed}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = pending.completion.history
        ? "Enhancement Saved, Draft Clear Failed"
        : "Enhancement Ready, History Save Failed";
      toast.message = `${error instanceof Error ? error.message : String(error)} Retry saves the completed result without another model request.`;
    } finally {
      setIsLoading(false);
    }
  }

  function cancel() {
    activeController.current?.abort();
  }

  async function runActivationEvaluation() {
    if (profile.provider === "anthropic") {
      if (anthropicState === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "Anthropic Provider Is Disabled",
          "Activation 9 must enter Preview before its quality evaluation can run.",
        );
        return;
      }
      push(
        <ProviderApiKeyForm
          provider="anthropic"
          profile={profile}
          purpose="evaluation"
          onSubmit={(apiKey) =>
            executeActivationEvaluation(effectiveProfileId, apiKey)
          }
          onCancel={() => evaluationController.current?.abort()}
        />,
      );
      return;
    }
    if (profile.provider === "google") {
      if (googleState === "disabled") {
        await showToast(
          Toast.Style.Failure,
          "Google Provider Is Disabled",
          "Activation 10 must enter Preview before its quality evaluation can run.",
        );
        return;
      }
      push(
        <ProviderApiKeyForm
          provider="google"
          profile={profile}
          purpose="evaluation"
          onSubmit={(apiKey) =>
            executeActivationEvaluation(effectiveProfileId, apiKey)
          }
          onCancel={() => evaluationController.current?.abort()}
        />,
      );
      return;
    }
    const apiKey = preferences.openaiApiKey?.trim();
    if (!apiKey) {
      await showToast(
        Toast.Style.Failure,
        "OpenAI API Key Required",
        "Add the shared key in Prompt Studio extension preferences before running the evaluation.",
      );
      await openExtensionPreferences();
      return;
    }
    await executeActivationEvaluation(effectiveProfileId, apiKey);
  }

  async function executeActivationEvaluation(
    selectedProfileId: SelectableEnhancementProfileId,
    apiKey: string,
  ) {
    const plan = getEnhancementEvaluationPlan(selectedProfileId);
    const confirmedMaximumUsd = Math.ceil(plan.maximumCostUsd * 100) / 100;
    const confirmed = await confirmAlert({
      title: `Run ${plan.cases.length}-case ${plan.profile.title} evaluation?`,
      message: `This sends the same frozen, non-secret evaluation cases to ${providerName(plan.profile.provider)} using ${plan.profile.model}. The maximum model-token cost is $${confirmedMaximumUsd.toFixed(2)}; actual usage is recorded and is usually lower. No prompt is saved to your library.`,
      primaryAction: {
        title: `Run Up to $${confirmedMaximumUsd.toFixed(2)}`,
        style: Alert.ActionStyle.Default,
      },
    });
    if (!confirmed) return;

    const controller = new AbortController();
    evaluationController.current = controller;
    setIsEvaluating(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Running Enhancement Evaluation",
      `0/${plan.cases.length} cases`,
    );
    try {
      const report = await runEnhancementEvaluation({
        profileId: selectedProfileId,
        apiKey,
        confirmedMaximumUsd,
        signal: controller.signal,
        onProgress: (progress) => {
          toast.message = `${progress.completed}/${progress.total} · ${progress.caseId}`;
        },
      });
      setEvaluationReport(report);
      if (report.status === "cancelled") {
        toast.style = Toast.Style.Failure;
        toast.title = "Evaluation Cancelled";
        toast.message = `${report.completedCount}/${report.caseCount} completed; partial report saved.`;
      } else if (report.status === "incomplete") {
        toast.style = Toast.Style.Failure;
        toast.title = "Evaluation Incomplete";
        toast.message = `${report.failedCount} case${report.failedCount === 1 ? "" : "s"} failed; report saved.`;
      } else {
        toast.style = Toast.Style.Success;
        toast.title = "Evaluation Ready for Review";
        toast.message = `${report.completedCount} cases · $${report.actualCostUsd.toFixed(4)} actual estimated cost`;
      }
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Evaluation Failed";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      evaluationController.current = undefined;
      setIsEvaluating(false);
    }
  }

  return (
    <Form
      isLoading={isLoading || isEvaluating}
      navigationTitle={`Enhance Prompt · ${title(state)}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Enhance Prompt"
            icon={Icon.Wand}
            onSubmit={submit}
          />
          {pendingEnhancement ? (
            <Action
              title="Retry History Save"
              icon={Icon.ArrowClockwise}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={() => completeEnhancement(pendingEnhancement)}
            />
          ) : null}
          {isLoading ? (
            <Action
              title="Cancel Enhancement"
              icon={Icon.XMarkCircle}
              onAction={cancel}
            />
          ) : null}
          <ActionPanel.Submenu
            title="Context"
            icon={Icon.Folder}
            shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
          >
            <Action
              title={
                setupMode === "smart"
                  ? "Customize Enhancement"
                  : "Use Smart Defaults"
              }
              icon={setupMode === "smart" ? Icon.Gear : Icon.Wand}
              shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
              onAction={() =>
                setSetupMode(setupMode === "smart" ? "custom" : "smart")
              }
            />
            {projectContextState !== "disabled" && !showFolderPicker ? (
              <Action
                title="Choose Project Folder"
                icon={Icon.Folder}
                shortcut={{ modifiers: ["cmd", "shift"], key: "j" }}
                onAction={() => setShowFolderPicker(true)}
              />
            ) : null}
            {projectContextState !== "disabled" &&
            !projectDiscoveryStarted.current ? (
              <Action
                title="Load Saved Projects"
                icon={Icon.Download}
                shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                onAction={loadProjects}
              />
            ) : null}
            <Action.Push
              title="Review Cost and Privacy"
              icon={Icon.Shield}
              shortcut={{ modifiers: ["cmd", "shift"], key: "k" }}
              target={
                <Detail
                  navigationTitle="Enhancement Setup"
                  markdown={enhancementSetupMarkdown(
                    profile,
                    estimatedCost,
                    effectiveResearchLevel,
                  )}
                />
              }
            />
          </ActionPanel.Submenu>
          <ActionPanel.Submenu
            title="Saved Work"
            icon={Icon.Bookmark}
            shortcut={{ modifiers: ["cmd", "shift"], key: "w" }}
          >
            <Action
              title="Open in Idea Studio"
              icon={Icon.LightBulb}
              shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
              onAction={() =>
                launchCommand({
                  name: "idea-studio",
                  type: LaunchType.UserInitiated,
                  context: ideaStudioLaunchContext(roughThoughts, target),
                })
              }
            />
            <Action.Push
              title="Enhancement History"
              icon={Icon.Clock}
              shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
              target={
                <EnhancementHistory
                  directory={resolvePromptDirectory(
                    preferences.libraryDirectory,
                  )}
                />
              }
            />
          </ActionPanel.Submenu>
          <ActionPanel.Submenu
            title="System"
            icon={Icon.Gear}
            shortcut={{ modifiers: ["cmd", "shift"], key: "y" }}
          >
            <Action.Push
              title="Advanced Provider"
              icon={Icon.Gear}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              target={
                <AdvancedProviderSelection
                  selected={profileId}
                  anthropicState={anthropicState}
                  googleState={googleState}
                  onSelect={setProfileId}
                />
              }
            />
            {isEvaluating ? (
              <Action
                title="Cancel Quality Evaluation"
                icon={Icon.XMarkCircle}
                shortcut={{ modifiers: ["cmd", "shift"], key: "q" }}
                onAction={() => evaluationController.current?.abort()}
              />
            ) : (
              <Action
                title={`Run ${profile.title} Quality Evaluation`}
                icon={Icon.Gauge}
                shortcut={{ modifiers: ["cmd", "shift"], key: "q" }}
                onAction={runActivationEvaluation}
              />
            )}
            {evaluationReport ? (
              <>
                <Action.Push
                  title="Review Quality Evaluation"
                  icon={Icon.Eye}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
                  target={<EvaluationReview path={evaluationReport.path} />}
                />
                <Action.ShowInFinder
                  title="Show Latest Evaluation Report"
                  path={evaluationReport.path}
                  shortcut={Keyboard.Shortcut.Common.OpenWith}
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
              title="Open Enhancement Preferences"
              icon={Icon.Gear}
              shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              onAction={openCommandPreferences}
            />
          </ActionPanel.Submenu>
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="roughThoughts"
        title="What Do You Need?"
        placeholder="Describe the outcome, constraints, and anything the agent must avoid."
        value={roughThoughts}
        onChange={(value) => {
          setRoughThoughts(value);
          if (activeSeed?.thoughts !== value) setActiveSeed(undefined);
        }}
      />
      <Form.Dropdown
        id="target"
        title="Use With"
        value={target}
        onChange={(value) => setTarget(value as PromptTarget)}
      >
        <Form.Dropdown.Item title="Codex" value="codex" />
        <Form.Dropdown.Item title="Claude Code" value="claude-code" />
        <Form.Dropdown.Item title="Generic / Any Agent" value="generic" />
      </Form.Dropdown>
      <Form.Dropdown
        id="project"
        title="Project"
        value={project}
        onChange={(value) => {
          setProject(value);
          if (value !== "none") setRepositoryFolder([]);
        }}
      >
        <Form.Dropdown.Section title="Portable">
          <Form.Dropdown.Item title="No Project" value="none" />
        </Form.Dropdown.Section>
        {projectGroups.recent.length > 0 ? (
          <Form.Dropdown.Section title="Recent">
            {projectGroups.recent.map((project) => (
              <Form.Dropdown.Item
                key={`recent-${project.path}`}
                title={`${project.name} · ${project.source ? "Mac Mini" : "MacBook"}`}
                value={project.path}
              />
            ))}
          </Form.Dropdown.Section>
        ) : null}
        {projectGroups.macBook.length > 0 ? (
          <Form.Dropdown.Section title="MacBook">
            {projectGroups.macBook.map((project) => (
              <Form.Dropdown.Item
                key={`macbook-${project.path}`}
                title={project.name}
                value={project.path}
              />
            ))}
          </Form.Dropdown.Section>
        ) : null}
        {projectGroups.macMini.length > 0 ? (
          <Form.Dropdown.Section title="Mac Mini">
            {projectGroups.macMini.map((project) => (
              <Form.Dropdown.Item
                key={`mini-${project.path}`}
                title={project.name}
                value={project.path}
              />
            ))}
          </Form.Dropdown.Section>
        ) : null}
      </Form.Dropdown>
      {projectContextState !== "disabled" && showFolderPicker ? (
        <Form.FilePicker
          id="repositoryFolder"
          title="Or Choose a Folder"
          value={repositoryFolder}
          onChange={(paths) => {
            setRepositoryFolder(paths);
            if (paths.length > 0) setProject("none");
          }}
          allowMultipleSelection={false}
          canChooseDirectories
          canChooseFiles={false}
        />
      ) : null}
      <Form.Description
        text={
          projectContextState === "disabled"
            ? "Repository analysis is Disabled. No local files are read or sent."
            : projectDiscoveryLoading
              ? "Finding projects on this MacBook and Mac Mini…"
              : projectDiscoveryError
                ? `${projectDiscoveryError} You can still choose a MacBook folder.`
                : projectDiscoveryStarted.current
                  ? "Saved projects loaded. Project context remains read-only and is reviewed before anything is sent."
                  : "No project scan has run. Choose Load Saved Projects or select an exact folder."
        }
      />
      {setupMode === "custom" ? (
        <>
          <Form.Separator />
          <Form.Description
            title="Custom Setup"
            text="Choose research depth and add instructions for this run."
          />
          <Form.Dropdown
            id="researchLevel"
            title="External Research"
            value={researchLevel}
            onChange={(value) =>
              setResearchLevel(value as EnhancementResearchLevel)
            }
          >
            <Form.Dropdown.Item title="None · No External Data" value="none" />
            <Form.Dropdown.Item
              title="Automatic · Need-Based Sources"
              value="auto"
            />
            <Form.Dropdown.Item
              title="Deep · Broader Sources + Review"
              value="deep"
            />
          </Form.Dropdown>
          <Form.Description
            text={`Libraries and versions are detected from your task and selected project. Context7 is ${title(context7State)}, web is ${title(webState)}, and Exa is ${title(exaState)}. Every external request is reviewed first.`}
          />
          <Form.TextField
            id="oneRunInstruction"
            title="Special Instructions"
            placeholder="Optional: emphasize accessibility, keep it short, use Romanian…"
            value={oneRunInstruction}
            onChange={setOneRunInstruction}
          />
        </>
      ) : null}
      <Form.Separator />
      <Form.Description
        title="Ready to Enhance"
        text={
          !profileAvailable
            ? `${profile.title} is Disabled. Your task is preserved; choose an enabled provider before enhancing.`
            : setupMode === "smart"
            ? `${profile.title} · no external research · estimated maximum cost $${estimatedCost.toFixed(3)}. Completed results go to local history; the prompt library changes only when you approve.`
            : `${profile.title} · ${title(effectiveResearchLevel)} research · estimated maximum cost $${estimatedCost.toFixed(3)}. Completed results go to local history; the prompt library changes only when you approve.`
        }
      />
    </Form>
  );
}

function AdvancedProviderSelection({
  selected,
  anthropicState,
  googleState,
  onSelect,
}: {
  selected: SelectableEnhancementProfileId;
  anthropicState: FeatureState;
  googleState: FeatureState;
  onSelect: (profile: SelectableEnhancementProfileId) => void;
}) {
  const { pop } = useNavigation();
  const states = { anthropic: anthropicState, google: googleState };
  const [profileId, setProfileId] = useState<
    SelectableEnhancementProfileId | ""
  >(enhancementProfileIsAvailable(selected, states) ? selected : "");
  const profile = profileId
    ? getProviderEnhancementProfile(profileId)
    : undefined;

  async function selectProvider() {
    if (!profileId || !enhancementProfileIsAvailable(profileId, states)) {
      await showToast(
        Toast.Style.Failure,
        "Choose an Enabled Provider",
        "Disabled providers are shown for context but cannot be selected.",
      );
      return;
    }
    onSelect(profileId);
    pop();
  }

  return (
    <Form
      navigationTitle="Advanced Provider"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Use This Provider"
            icon={Icon.Check}
            onSubmit={selectProvider}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="profileId"
        title="Provider"
        value={profileId}
        onChange={(value) =>
          setProfileId(value as SelectableEnhancementProfileId)
        }
      >
        <Form.Dropdown.Item
          title="Choose an enabled provider…"
          value=""
        />
        <Form.Dropdown.Section title="OpenAI">
          <Form.Dropdown.Item
            title="Standard · GPT-5.6 Terra"
            value="openai-standard-v1"
          />
          <Form.Dropdown.Item
            title="Deep · GPT-5.6 Sol + Review"
            value="openai-deep-v1"
          />
        </Form.Dropdown.Section>
        <Form.Dropdown.Section title="Other Providers">
          {anthropicState === "disabled" ? null : (
            <Form.Dropdown.Item
              title={`Claude Sonnet 5 · ${title(anthropicState)}`}
              value="anthropic-sonnet-5-v1"
            />
          )}
          {googleState === "disabled" ? null : (
            <Form.Dropdown.Item
              title={`Gemini 3.5 Flash · ${title(googleState)}`}
              value="google-gemini-3.5-flash-v1"
            />
          )}
        </Form.Dropdown.Section>
      </Form.Dropdown>
      <Form.Description
        title={profile?.title ?? "Unavailable Providers"}
        text={
          profile
            ? `${profile.purpose} A failed request never falls back to another provider.`
            : `Claude Sonnet 5 is ${title(anthropicState)}. Gemini 3.5 Flash is ${title(googleState)}. Choose an enabled provider; the saved task is unchanged.`
        }
      />
    </Form>
  );
}

function enhancementSetupMarkdown(
  profile: EnhancementRunProfile,
  estimatedCost: number,
  researchLevel: EnhancementResearchLevel,
): string {
  return [
    "# Enhancement Setup",
    `**Profile:** ${profile.title}`,
    `**Model:** ${profile.model}`,
    `**Reasoning:** ${profile.reasoningEffort}`,
    `**External research:** ${title(researchLevel)}`,
    `**Maximum model-token estimate:** $${estimatedCost.toFixed(3)}`,
    "The actual model cost is calculated from returned token counts and is usually lower. Project files and external research have separate review steps when enabled. Completed results are kept in local Enhancement History; the main prompt library changes only when you approve.",
    providerPricingDisclosure(profile),
    providerPrivacyDisclosure(profile),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function EvaluationReview({ path }: { path: string }) {
  const [report, setReport] = useState<EnhancementEvaluationDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void loadEnhancementEvaluation(path)
      .then(setReport)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : String(caught)),
      );
  }, [path]);

  async function saveFullMarks(record: EnhancementEvaluationRecord) {
    const toast = await showToast(
      Toast.Style.Animated,
      "Saving Human Review",
      "Recording 100/100 for this case.",
    );
    try {
      const updated = await recordEnhancementEvaluationReview(
        path,
        record.caseId,
        fullMarksHumanReview(),
      );
      setReport(updated);
      toast.style = Toast.Style.Success;
      toast.title = "Case Reviewed";
      toast.message = `${updated.reviewSummary?.reviewedCount ?? 0}/${updated.records.length} complete`;
    } catch (caught) {
      toast.style = Toast.Style.Failure;
      toast.title = "Review Was Not Saved";
      toast.message = caught instanceof Error ? caught.message : String(caught);
    }
  }

  if (error) {
    return (
      <Detail
        navigationTitle="Quality Evaluation Review"
        markdown={`# Evaluation Report Cannot Be Reviewed\n\n${escapeMarkdown(error)}`}
      />
    );
  }

  const records = report ? blindEvaluationRecords(report) : [];
  const summary = report?.reviewSummary ?? {
    reviewedCount: records.filter(
      (record) => record.humanReview.status === "reviewed",
    ).length,
    pendingCount: records.filter(
      (record) => record.humanReview.status === "pending",
    ).length,
    averageScore: null,
    hardFailureCount: 0,
    protectedFailureCount: 0,
    passing: false,
  };

  return (
    <List
      isLoading={!report}
      isShowingDetail
      navigationTitle="Blind Quality Review"
      searchBarPlaceholder="Filter by review number, split, or category…"
    >
      <List.Section
        title="Blind Evaluation Cases"
        subtitle={`${summary.reviewedCount}/${records.length} reviewed`}
      >
        {records.map((record, index) => {
          const number = String(index + 1).padStart(2, "0");
          return (
            <List.Item
              key={record.caseId}
              title={`Review ${number}`}
              subtitle={`${title(record.split)} · ${title(record.category)}`}
              keywords={[record.split, record.category, number]}
              accessories={[
                {
                  text:
                    record.humanReview.status === "reviewed"
                      ? `${evaluationReviewTotal(record)}/100`
                      : "Pending",
                },
              ]}
              detail={
                <List.Item.Detail
                  markdown={evaluationRecordMarkdown(record, number)}
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Record 100/100 · Meets Full Rubric"
                    icon={Icon.CheckCircle}
                    onAction={() => saveFullMarks(record)}
                  />
                  <Action.Push
                    title="Score Manually"
                    icon={Icon.Pencil}
                    target={
                      <EvaluationScoreForm
                        path={path}
                        record={record}
                        reviewNumber={number}
                        onSaved={setReport}
                      />
                    }
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

interface EvaluationScoreValues {
  fidelity: string;
  completeness: string;
  unsupportedFacts: string;
  actionability: string;
  validation: string;
  authorization: string;
  appropriateLength: string;
  hardFailure: boolean;
  notes: string;
}

function EvaluationScoreForm({
  path,
  record,
  reviewNumber,
  onSaved,
}: {
  path: string;
  record: EnhancementEvaluationRecord;
  reviewNumber: string;
  onSaved: (report: EnhancementEvaluationDocument) => void;
}) {
  const { pop } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  async function submit(values: EvaluationScoreValues) {
    setIsLoading(true);
    try {
      const input: EnhancementHumanReviewInput = {
        fidelity: selectedReviewScore(values.fidelity, "Fidelity"),
        completeness: selectedReviewScore(values.completeness, "Completeness"),
        unsupportedFacts: selectedReviewScore(
          values.unsupportedFacts,
          "Unsupported facts",
        ),
        actionability: selectedReviewScore(
          values.actionability,
          "Actionability",
        ),
        validation: selectedReviewScore(values.validation, "Validation"),
        authorization: selectedReviewScore(
          values.authorization,
          "Authorization",
        ),
        appropriateLength: selectedReviewScore(
          values.appropriateLength,
          "Appropriate length",
        ),
        hardFailure: values.hardFailure,
        notes: values.notes,
      };
      const updated = await recordEnhancementEvaluationReview(
        path,
        record.caseId,
        input,
      );
      onSaved(updated);
      await showToast(
        Toast.Style.Success,
        "Case Reviewed",
        `${updated.reviewSummary?.reviewedCount ?? 0}/${updated.records.length} complete`,
      );
      pop();
    } catch (caught) {
      await showToast(
        Toast.Style.Failure,
        "Review Was Not Saved",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={`Score Blind Review ${reviewNumber}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Human Review"
            icon={Icon.CheckCircle}
            onSubmit={submit}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Scoring Boundary"
        text="The provider and model stay hidden. Score only the rough input, required facts, prohibited inventions, and generated result shown on the previous screen."
      />
      <ReviewScoreDropdown
        id="fidelity"
        title="Fidelity"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.fidelity}
        current={record.humanReview.fidelity}
      />
      <ReviewScoreDropdown
        id="completeness"
        title="Completeness"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.completeness}
        current={record.humanReview.completeness}
      />
      <ReviewScoreDropdown
        id="unsupportedFacts"
        title="Unsupported Facts"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.unsupportedFacts}
        current={record.humanReview.unsupportedFacts}
      />
      <ReviewScoreDropdown
        id="actionability"
        title="Actionability"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.actionability}
        current={record.humanReview.actionability}
      />
      <ReviewScoreDropdown
        id="validation"
        title="Validation"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.validation}
        current={record.humanReview.validation}
      />
      <ReviewScoreDropdown
        id="authorization"
        title="Authorization"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.authorization}
        current={record.humanReview.authorization}
      />
      <ReviewScoreDropdown
        id="appropriateLength"
        title="Appropriate Length"
        maximum={HUMAN_REVIEW_SCORE_MAXIMUMS.appropriateLength}
        current={record.humanReview.appropriateLength}
      />
      <Form.Checkbox
        id="hardFailure"
        title="Hard Failure"
        label="The result violates a non-negotiable rule"
        defaultValue={record.humanReview.hardFailure ?? false}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        defaultValue={record.humanReview.notes}
        placeholder="Optional short reason or correction; do not include secrets."
      />
    </Form>
  );
}

function ReviewScoreDropdown({
  id,
  title: fieldTitle,
  maximum,
  current,
}: {
  id: keyof EvaluationScoreValues;
  title: string;
  maximum: number;
  current: number | null;
}) {
  return (
    <Form.Dropdown
      id={id}
      title={`${fieldTitle} · 0–${maximum}`}
      defaultValue={current === null ? "" : String(current)}
    >
      <Form.Dropdown.Item title="Choose after reviewing…" value="" />
      {Array.from({ length: maximum + 1 }, (_, score) => (
        <Form.Dropdown.Item
          key={score}
          title={`${score} / ${maximum}`}
          value={String(score)}
        />
      ))}
    </Form.Dropdown>
  );
}

function ProviderApiKeyForm({
  provider,
  profile,
  purpose = "enhancement",
  onSubmit,
  onCancel,
}: {
  provider: "anthropic" | "google";
  profile: EnhancementRunProfile;
  purpose?: "enhancement" | "evaluation";
  onSubmit: (apiKey: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const providerTitle = provider === "anthropic" ? "Anthropic" : "Google";

  async function submit() {
    const value = apiKey.trim();
    if (!value) {
      await showToast(
        Toast.Style.Failure,
        `${providerTitle} API Key Required`,
        `Enter a key for this ${purpose} attempt.`,
      );
      return;
    }
    setIsLoading(true);
    try {
      await onSubmit(value);
    } finally {
      setApiKey("");
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle={`One-Run ${providerTitle} Key`}
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title={`Cancel ${title(purpose)}`}
              icon={Icon.XMarkCircle}
              onAction={onCancel}
            />
          ) : (
            <Action.SubmitForm
              title={
                purpose === "evaluation"
                  ? `Review ${providerTitle} Evaluation`
                  : `Enhance with ${providerTitle}`
              }
              icon={purpose === "evaluation" ? Icon.Gauge : Icon.Wand}
              onSubmit={submit}
            />
          )}
          {!isLoading ? (
            <Action.OpenInBrowser
              title={`Open ${providerTitle} API Key Page`}
              url={
                provider === "anthropic"
                  ? "https://console.anthropic.com/settings/keys"
                  : "https://aistudio.google.com/app/apikey"
              }
            />
          ) : null}
        </ActionPanel>
      }
    >
      <Form.PasswordField
        id="apiKey"
        title={`${providerTitle} API Key`}
        placeholder={`Used only for this ${profile.model} ${purpose}`}
        value={apiKey}
        onChange={setApiKey}
      />
      <Form.Description
        title="Credential Boundary"
        text={`Prompt Studio sends this key only in ${providerTitle}'s authentication header, clears the field after the attempt, and never saves it in prompts, settings, logs, research sources, or model input. ${providerPrivacyDisclosure(profile)}`}
      />
      <Form.Description
        title="Price Basis"
        text={providerPricingDisclosure(profile)}
      />
    </Form>
  );
}

function ProjectContextReview({
  request,
  bundle,
  nextStep,
  onContinue,
}: {
  request: EnhancementRequest;
  bundle: ProjectContextBundle;
  nextStep: "research review" | "enhancement";
  onContinue: (request: EnhancementRequest) => Promise<void>;
}) {
  const [includeCode, setIncludeCode] = useState(true);
  const files = includedProjectFiles(bundle, includeCode);
  const projectContext = renderProjectContext(bundle, includeCode);
  const maximumCost = estimatedProviderMaximumCostUsd({
    ...request,
    project: bundle.project,
    projectContext,
    allowedProjectFiles: files,
  });
  const markdown = [
    `# Review ${escapeMarkdown(bundle.project.name)} Context`,
    `Nothing has been sent to ${providerDisplayName(request)}. Review the paths below, then explicitly continue.`,
    `**Branch:** ${inlineCode(bundle.project.branch ?? "(unavailable)")}`,
    `**Commit:** ${inlineCode(bundle.project.commit ?? "(no commit)")}`,
    `**Code excerpts:** ${includeCode ? "Included" : "Excluded"}`,
    `**Context size:** ${new TextEncoder().encode(projectContext).length.toLocaleString()} bytes`,
    `**Maximum model-token cost:** $${maximumCost.toFixed(3)}`,
    `## Files to Send\n\n${files.length > 0 ? files.map((path) => `- ${inlineCode(path)}`).join("\n") : "No file contents will be sent."}`,
    `## Repository State\n\n${bundle.uncommittedChanges.length > 0 ? bundle.uncommittedChanges.map((change) => `- ${inlineCode(change)}`).join("\n") : "No uncommitted changes."}`,
    `## Excluded Candidates\n\n${bundle.omitted.length > 0 ? bundle.omitted.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "None."}`,
  ].join("\n\n");

  return (
    <Detail
      navigationTitle="Review Project Context"
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title={
              nextStep === "research review"
                ? "Continue to Research Review"
                : "Enhance with Reviewed Context"
            }
            icon={nextStep === "research review" ? Icon.ArrowRight : Icon.Wand}
            onAction={() =>
              onContinue({
                ...request,
                project: bundle.project,
                projectContext,
                allowedProjectFiles: files,
              })
            }
          />
          <Action
            title={
              includeCode
                ? "Exclude Project Code"
                : "Include Relevant Project Code"
            }
            icon={includeCode ? Icon.EyeDisabled : Icon.Eye}
            onAction={() => setIncludeCode((value) => !value)}
          />
        </ActionPanel>
      }
    />
  );
}

function Context7PlanReview({
  request,
  plan,
  context7State,
  versionSource,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  plan: Context7Plan;
  context7State: FeatureState;
  versionSource?: string;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);

  async function retrieve(apiKey?: string) {
    if (controller.current) return;
    let approvedApiKey = apiKey?.trim();
    if (!approvedApiKey) {
      try {
        approvedApiKey = context7ApiKeyForApprovedRequest(context7State);
      } catch (error) {
        await showToast(
          Toast.Style.Failure,
          "Context7 API Key Required",
          error instanceof Error ? error.message : String(error),
        );
        return;
      }
    }
    const activeController = new AbortController();
    controller.current = activeController;
    setIsLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Retrieving Context7 Documentation",
      "No model request has started.",
    );
    try {
      const result = await researchWithContext7(plan, {
        apiKey: approvedApiKey,
        signal: activeController.signal,
      });
      if (activeController.signal.aborted) {
        toast.style = Toast.Style.Failure;
        toast.title = "Context7 Retrieval Cancelled";
        toast.message = "No model request was made.";
        return;
      }
      toast.style = Toast.Style.Success;
      toast.title = "Context7 Sources Ready";
      toast.message = "Review every source before enhancement.";
      push(
        <Context7SourceReview
          request={request}
          result={result}
          onContinue={onContinue}
          onCancelContinue={onCancelContinue}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Context7 Retrieval Failed";
      toast.message = error instanceof Error ? error.message : String(error);
    } finally {
      controller.current = undefined;
      setIsLoading(false);
    }
  }

  const markdown = [
    "# Review Library Research",
    "**No request has started.** Only this library query will be sent.",
    `**Library:** ${inlineCode(plan.libraryId ?? plan.libraryInput ?? "(missing)")}`,
    `**Version:** ${inlineCode(plan.version ?? "(not specified)")}${versionSource ? ` — read from ${inlineCode(versionSource)}` : ""}`,
    "**Cost:** Context7 does not expose a per-request price.",
    "## Query",
    indentCode(plan.query ?? "(missing query)"),
    "The existing CONTEXT7_API_KEY environment value is read only after you choose Retrieve. You can instead enter a one-run key.",
  ].join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Review Library Research"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel Context7 Retrieval"
              icon={Icon.XMarkCircle}
              onAction={() => controller.current?.abort()}
            />
          ) : (
            <Action
              title="Retrieve Reviewed Documentation"
              icon={Icon.Download}
              onAction={() => retrieve()}
            />
          )}
          {!isLoading ? (
            <Action.Push
              title="Enter One-Run Context7 API Key"
              icon={Icon.Key}
              target={
                <Context7ApiKeyForm
                  onSubmit={retrieve}
                  onCancel={() => controller.current?.abort()}
                />
              }
            />
          ) : null}
          <Action.Push
            title="Review Privacy and Limits"
            icon={Icon.Shield}
            target={
              <Detail
                navigationTitle="Library Research Details"
                markdown={[
                  "# Library Research Details",
                  `**Service:** Context7`,
                  `**Research level:** ${title(request.researchLevel)}`,
                  CONTEXT7_PRIVACY_DISCLOSURE,
                  `Context7 does not expose a per-request price. The separate ${providerDisplayName(request)} enhancement cost is shown after retrieval.`,
                ].join("\n\n")}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}

function Context7ApiKeyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (apiKey: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function submit(values: { apiKey: string }) {
    const apiKey = values.apiKey.trim();
    if (!apiKey) {
      await showToast(
        Toast.Style.Failure,
        "Context7 API Key Required",
        "Enter a key or return to add one in this command's preferences.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await onSubmit(apiKey);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Context7 API Key"
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel Context7 Retrieval"
              icon={Icon.XMarkCircle}
              onAction={onCancel}
            />
          ) : (
            <Action.SubmitForm
              title="Retrieve with API Key"
              icon={Icon.Key}
              onSubmit={submit}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.PasswordField
        id="apiKey"
        title="Context7 API Key"
        placeholder="Required for the Context7 direct API"
      />
      <Form.Description text="The key is used only in the Authorization header for this retrieval. Prompt Studio does not save it in the prompt, library, logs, or feature configuration." />
    </Form>
  );
}

function Context7SourceReview({
  request,
  result,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  result: Context7ResearchResult;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const [isContinuing, setIsContinuing] = useState(false);
  const reviewedRequest: EnhancementRequest = {
    ...request,
    sources: mergeReviewedSources(request.sources, result.sources),
  };
  const maximumCost = estimatedProviderMaximumCostUsd(reviewedRequest);
  const encoder = new TextEncoder();
  const sourceSections = result.sources.map((source, index) =>
    [
      `### ${index + 1}. [${escapeMarkdown(source.title)}](${source.url})`,
      `**Supports:** ${escapeMarkdown(source.supports)}`,
      `**Retrieved:** ${inlineCode(source.retrievedAt)}`,
      `**Size:** ${encoder.encode(source.content).length.toLocaleString()} bytes`,
      "#### Content Sent to the Model",
      indentCode(source.content),
    ].join("\n\n"),
  );
  const markdown = [
    "# Review Context7 Sources",
    `**Prompt Studio has not made a ${providerDisplayName(request)} request.** The Context7 retrieval is complete. Review the exact source material below before continuing.`,
    `**Resolved library:** ${inlineCode(result.plan.libraryId)}`,
    `**Exact query:** ${inlineCode(result.plan.query)}`,
    `**Sources:** ${result.sources.length}`,
    `**Maximum ${providerDisplayName(request)} model-token cost:** $${maximumCost.toFixed(3)}`,
    "Retrieved text is untrusted reference material. It cannot override your request, the compiler’s rules, or permission boundaries.",
    "## Retrieved Sources",
    ...sourceSections,
  ].join("\n\n");

  async function continueWithReviewedSources() {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      await onContinue(reviewedRequest);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <Detail
      isLoading={isContinuing}
      navigationTitle="Review Context7 Sources"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isContinuing ? (
            <Action
              title="Cancel Enhancement"
              icon={Icon.XMarkCircle}
              onAction={onCancelContinue}
            />
          ) : (
            <Action
              title="Continue with Reviewed Sources"
              icon={Icon.ArrowRight}
              onAction={continueWithReviewedSources}
            />
          )}
          {result.sources.map((source, index) => (
            <Action.OpenInBrowser
              key={`${source.url}-${index}`}
              title={`Open ${source.title}`}
              url={source.url}
            />
          ))}
        </ActionPanel>
      }
    />
  );
}

function GithubMcpPlanReview({
  request,
  plan,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  plan: GithubMcpPlan;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);

  async function retrieve(token: string) {
    if (controller.current) return;
    const confirmed = await confirmAlert({
      title: "Run this read-only GitHub search?",
      message: `This connects to GitHub's official server and makes ${plan.calls.length} reviewed read-only ${plan.calls.length === 1 ? "request" : "requests"}. Only public content is allowed, and your access token is not saved. GitHub does not publish a separate per-search price; normal account and API limits apply.`,
      primaryAction: {
        title: "Search GitHub",
        style: Alert.ActionStyle.Default,
      },
    });
    if (!confirmed) return;

    const activeController = new AbortController();
    controller.current = activeController;
    setIsLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Searching GitHub",
      "No prompt-enhancement request has started.",
    );
    try {
      const result = await researchWithGithubMcp(plan, {
        token,
        signal: activeController.signal,
      });
      if (activeController.signal.aborted) {
        toast.style = Toast.Style.Failure;
        toast.title = "GitHub Retrieval Cancelled";
        toast.message = "No enhancement request was made.";
        return;
      }
      toast.style = Toast.Style.Success;
      toast.title = "GitHub Sources Ready";
      toast.message = "Review every returned object before enhancement.";
      push(
        <GithubMcpSourceReview
          request={request}
          result={result}
          onContinue={onContinue}
          onCancelContinue={onCancelContinue}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      if (activeController.signal.aborted) {
        toast.title = "GitHub Retrieval Cancelled";
        toast.message = "No enhancement request was made.";
      } else {
        toast.title = "GitHub MCP Retrieval Failed";
        toast.message = error instanceof Error ? error.message : String(error);
      }
    } finally {
      controller.current = undefined;
      setIsLoading(false);
    }
  }

  const calls = plan.calls.map((call, index) =>
    [
      `### ${index + 1}. ${inlineCode(call.tool)}`,
      `**Purpose:** ${escapeMarkdown(call.purpose)}`,
      "#### Exact Arguments",
      indentCode(JSON.stringify(call.arguments, null, 2)),
    ].join("\n\n"),
  );
  const markdown = [
    "# Review GitHub Search",
    "**No request has started.** Review the read-only calls below.",
    `**Repository:** ${inlineCode(plan.repository ?? "(missing)")}`,
    `**Calls:** ${plan.calls.length} of ${plan.maximumToolCalls ?? 3} maximum`,
    "**Cost:** GitHub publishes no separate MCP search price.",
    "## Read-Only Calls",
    ...calls,
  ].join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Review GitHub Search"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel GitHub Retrieval"
              icon={Icon.XMarkCircle}
              onAction={() => controller.current?.abort()}
            />
          ) : (
            <Action.Push
              title="Connect GitHub for This Search"
              icon={Icon.Key}
              target={
                <GithubTokenForm
                  plan={plan}
                  onSubmit={retrieve}
                  onCancel={() => controller.current?.abort()}
                />
              }
            />
          )}
          <Action.Push
            title="Review Privacy and Limits"
            icon={Icon.Shield}
            target={
              <Detail
                navigationTitle="GitHub Search Details"
                markdown={[
                  "# GitHub Search Details",
                  `**Official server:** ${inlineCode(plan.endpoint ?? "https://api.githubcopilot.com/mcp/")}`,
                  "**Read-only mode:** Enabled",
                  "**Public-content lockdown:** Enabled",
                  GITHUB_MCP_PRIVACY_DISCLOSURE,
                  "Prompt Studio checks the returned tool list and stops before any call if the server exposes something outside the reviewed plan.",
                  "Normal GitHub subscription, repository permissions, and API rate limits still apply.",
                ].join("\n\n")}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}

function GithubTokenForm({
  plan,
  onSubmit,
  onCancel,
}: {
  plan: GithubMcpPlan;
  onSubmit: (token: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    const value = token.trim();
    if (!value) {
      await showToast(
        Toast.Style.Failure,
        "GitHub Access Required",
        "Enter a fine-grained read-only token for this search.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await onSubmit(value);
    } finally {
      setToken("");
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Connect GitHub"
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel GitHub Retrieval"
              icon={Icon.XMarkCircle}
              onAction={onCancel}
            />
          ) : (
            <Action.SubmitForm
              title="Run Read-Only GitHub Search"
              icon={Icon.Key}
              onSubmit={submit}
            />
          )}
          <Action.OpenInBrowser
            title="Create the Required Read-Only Token"
            url={githubTokenTemplateUrl(plan)}
          />
        </ActionPanel>
      }
    >
      <Form.PasswordField
        id="token"
        title="Access Token"
        placeholder="Repository-limited and read-only"
        value={token}
        onChange={setToken}
      />
      <Form.Description text="The GitHub form opens with a one-day lifetime and only the read permissions required above. Prompt Studio uses the token for this search only, clears it afterward, and never saves it or sends it to the prompt model." />
    </Form>
  );
}

function GithubMcpSourceReview({
  request,
  result,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  result: GithubMcpResearchResult;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const [isContinuing, setIsContinuing] = useState(false);
  const mergedSources = mergeReviewedSources(request.sources, result.sources);
  const includedUrls = new Set(mergedSources.map((source) => source.url));
  const reviewedRequest: EnhancementRequest = {
    ...request,
    sources: mergedSources,
  };
  const maximumModelCost = estimatedProviderMaximumCostUsd(reviewedRequest);
  const encoder = new TextEncoder();
  const sourceSections = result.sources.map((source, index) =>
    [
      `### ${index + 1}. [${escapeMarkdown(source.title)}](${source.url})`,
      `**Supports:** ${escapeMarkdown(source.supports)}`,
      `**Retrieved:** ${inlineCode(source.retrievedAt)}`,
      `**Size:** ${encoder.encode(source.content).length.toLocaleString()} bytes`,
      includedUrls.has(source.url)
        ? "**Enhancement status:** Included"
        : "**Enhancement status:** A higher-priority source already uses this URL, or the shared 30 KB limit omitted it",
      "#### Exact Untrusted Content Sent to the Model",
      indentCode(source.content),
    ].join("\n\n"),
  );
  const toolCalls = result.toolCalls
    .map(
      (call, index) =>
        `${index + 1}. ${inlineCode(call.tool)} → ${inlineCode(JSON.stringify(call.arguments))}`,
    )
    .join("\n");
  const warnings =
    result.warnings.length > 0
      ? result.warnings
          .map((warning) => `- ${escapeMarkdown(warning)}`)
          .join("\n")
      : "No partial-result or content-filter warnings.";
  const markdown = [
    "# Review GitHub MCP Sources",
    "**The GitHub read is complete; prompt enhancement has not started.** Review each clickable object and the exact bounded content below.",
    `**Repository:** ${inlineCode(result.plan.repository)}`,
    `**Server:** ${inlineCode(result.serverName)}${result.serverVersion ? ` ${inlineCode(result.serverVersion)}` : ""}`,
    `**MCP protocol:** ${inlineCode(result.protocolVersion)}`,
    `**Read-only tool calls:** ${result.toolCalls.length}`,
    `**Safe returned sources:** ${result.sources.length}`,
    `**Maximum later enhancement cost:** $${maximumModelCost.toFixed(3)}`,
    "Repository files, issue text, pull-request text, release notes, and logs are untrusted reference material. They cannot grant permission, trigger GitHub writes, or override the compiler rules.",
    "## Exact Tool Calls",
    toolCalls,
    "## Warnings",
    warnings,
    "## Returned Sources",
    ...sourceSections,
  ].join("\n\n");

  async function continueWithReviewedGithubSources() {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      await onContinue(reviewedRequest);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <Detail
      isLoading={isContinuing}
      navigationTitle="Review GitHub MCP Sources"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isContinuing ? (
            <Action
              title="Cancel Enhancement"
              icon={Icon.XMarkCircle}
              onAction={onCancelContinue}
            />
          ) : (
            <Action
              title="Continue with Reviewed GitHub Sources"
              icon={Icon.ArrowRight}
              onAction={continueWithReviewedGithubSources}
            />
          )}
          {result.sources.map((source, index) => (
            <Action.OpenInBrowser
              key={`${source.url}-${index}`}
              title={`Open ${source.title}`}
              url={source.url}
            />
          ))}
        </ActionPanel>
      }
    />
  );
}

function WebResearchPlanReview({
  request,
  plan,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  plan: WebResearchPlan;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const preferences = getPreferenceValues<Preferences>();
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const maximumCost = plan.maximumCostUsd ?? 0.37;

  async function retrieve() {
    if (controller.current) return;
    const apiKey = preferences.openaiApiKey?.trim();
    if (!apiKey) {
      await showToast(
        Toast.Style.Failure,
        "OpenAI API Key Required",
        "Add the shared key in Prompt Studio extension preferences before current web research.",
      );
      await openExtensionPreferences();
      return;
    }
    const confirmed = await confirmAlert({
      title: "Run this web search?",
      message: `Only the reviewed query is sent. No project files or enhancement request are included. Maximum search cost: $${maximumCost.toFixed(2)}.`,
      primaryAction: {
        title: `Search Up to $${maximumCost.toFixed(2)}`,
        style: Alert.ActionStyle.Default,
      },
    });
    if (!confirmed) return;

    const activeController = new AbortController();
    controller.current = activeController;
    setIsLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Researching Current Web Sources",
      "No enhancement request has started.",
    );
    try {
      const result = await researchWithOpenAIWeb(plan, {
        apiKey,
        signal: activeController.signal,
      });
      if (activeController.signal.aborted) {
        toast.style = Toast.Style.Failure;
        toast.title = "Current-Web Research Cancelled";
        toast.message =
          "No enhancement request was made. Search charges may apply if OpenAI had already started.";
        return;
      }
      toast.style = Toast.Style.Success;
      toast.title = "Current Web Sources Ready";
      toast.message = "Review every citation before enhancement.";
      push(
        <WebResearchSourceReview
          request={request}
          result={result}
          onContinue={onContinue}
          onCancelContinue={onCancelContinue}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      if (activeController.signal.aborted) {
        toast.title = "Current-Web Research Cancelled";
        toast.message =
          "No enhancement request was made. Search charges may apply if OpenAI had already started.";
      } else {
        toast.title = "Current Web Research Failed";
        toast.message = error instanceof Error ? error.message : String(error);
      }
    } finally {
      controller.current = undefined;
      setIsLoading(false);
    }
  }

  const markdown = [
    "# Review Web Research",
    "**No search has started.** Only the focused query below will be sent.",
    `**Cost:** $${(plan.intent?.planningCostUsd ?? 0).toFixed(4)} planning · up to $${maximumCost.toFixed(2)} search`,
    "## Goal",
    plan.intent?.objective ?? "(missing research objective)",
    "## Questions",
    plan.intent?.questions.map((question) => `- ${question}`).join("\n") ??
      "(missing research questions)",
    "## Query",
    indentCode(plan.query ?? "(missing query)"),
  ].join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Review Web Research"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel Current-Web Research"
              icon={Icon.XMarkCircle}
              onAction={() => controller.current?.abort()}
            />
          ) : (
            <Action
              title="Run Reviewed Web Research"
              icon={Icon.MagnifyingGlass}
              onAction={retrieve}
            />
          )}
          <Action.Push
            title="Review Privacy and Limits"
            icon={Icon.Shield}
            target={
              <Detail
                navigationTitle="Web Research Details"
                markdown={[
                  "# Web Research Details",
                  "**Service:** OpenAI Responses API · `gpt-5.6-terra` · low reasoning",
                  `**Research level:** ${title(request.researchLevel)}`,
                  `**Search context:** ${title(plan.searchContextSize ?? "low")}`,
                  "**Maximum tool calls:** 2",
                  FOCUSED_RESEARCH_PRIVACY_DISCLOSURE,
                  OPENAI_WEB_PRIVACY_DISCLOSURE,
                  "The search ceiling includes two tool calls, the documented 128K search-context limit, and 2,000 output tokens. Enhancement is priced separately.",
                ].join("\n\n")}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}

function WebResearchSourceReview({
  request,
  result,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  result: WebResearchResult;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const [isContinuing, setIsContinuing] = useState(false);
  const mergedSources = mergeReviewedSources(request.sources, result.sources);
  const includedUrls = new Set(mergedSources.map((source) => source.url));
  const omittedCount = result.sources.filter(
    (source) => !includedUrls.has(source.url),
  ).length;
  const reviewedRequest: EnhancementRequest = {
    ...request,
    sources: mergedSources,
  };
  const maximumModelCost = estimatedProviderMaximumCostUsd(reviewedRequest);
  const encoder = new TextEncoder();
  const sourceSections = result.sources.map((source, index) =>
    [
      `### ${index + 1}. [${escapeMarkdown(source.title)}](${source.url})`,
      `**Supports:** ${escapeMarkdown(source.supports)}`,
      `**Retrieved:** ${inlineCode(source.retrievedAt)}`,
      `**Size:** ${encoder.encode(source.content).length.toLocaleString()} bytes`,
      includedUrls.has(source.url)
        ? "**Enhancement status:** Included"
        : "**Enhancement status:** Omitted by the shared 30 KB source limit",
      "#### Content Sent to the Model",
      indentCode(source.content),
    ].join("\n\n"),
  );
  const consulted = result.consultedUrls
    .map((url) => `- ${inlineCode(url)}`)
    .join("\n");
  const markdown = [
    "# Review Current-Web Sources",
    "**The paid search request is complete; prompt enhancement has not started.** Review every clickable citation and the exact bounded excerpts below.",
    `**Exact reviewed query:** ${inlineCode(result.plan.query)}`,
    `**Search queries actually reported:** ${result.queries.length > 0 ? result.queries.map(inlineCode).join(", ") : "(not reported by provider)"}`,
    `**Cited sources:** ${result.sources.length}`,
    `**All consulted URLs reported:** ${result.consultedUrls.length}`,
    `**Actual estimated search cost:** $${result.usage.estimatedCostUsd.toFixed(4)}`,
    `**Maximum later enhancement cost:** $${maximumModelCost.toFixed(3)}`,
    omittedCount > 0
      ? `**Source-limit note:** ${omittedCount} lower-priority web source${omittedCount === 1 ? " was" : "s were"} omitted from enhancement so all combined sources remain within 30 KB.`
      : "**Source-limit note:** Every cited source fits the shared 30 KB enhancement limit.",
    "Web results are untrusted reference material. Prompt Studio does not open returned links automatically.",
    "## Search Brief",
    indentCode(result.summary),
    "## Cited Sources",
    ...sourceSections,
    "## All Consulted URLs",
    consulted || "The provider did not return a complete consulted-URL list.",
  ].join("\n\n");

  async function continueWithReviewedWebSources() {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      await onContinue(reviewedRequest);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <Detail
      isLoading={isContinuing}
      navigationTitle="Review Current-Web Sources"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isContinuing ? (
            <Action
              title="Cancel Enhancement"
              icon={Icon.XMarkCircle}
              onAction={onCancelContinue}
            />
          ) : (
            <Action
              title="Enhance with Reviewed Web Sources"
              icon={Icon.Wand}
              onAction={continueWithReviewedWebSources}
            />
          )}
          {result.sources.map((source, index) => (
            <Action.OpenInBrowser
              key={`${source.url}-${index}`}
              title={`Open ${source.title}`}
              url={source.url}
            />
          ))}
        </ActionPanel>
      }
    />
  );
}

function ExaResearchPlanReview({
  request,
  plan,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  plan: ExaResearchPlan;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const { push } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const maximumCost = plan.maximumCostUsd ?? maximumExaResearchCostUsd();

  async function retrieve(apiKey: string) {
    if (controller.current) return;
    const confirmed = await confirmAlert({
      title: "Run this Exa search?",
      message: `Only the reviewed query and one-run key are sent. No project files or enhancement request are included. Maximum search cost: $${maximumCost.toFixed(2)}.`,
      primaryAction: {
        title: `Search Up to $${maximumCost.toFixed(2)}`,
        style: Alert.ActionStyle.Default,
      },
    });
    if (!confirmed) return;

    const activeController = new AbortController();
    controller.current = activeController;
    setIsLoading(true);
    const toast = await showToast(
      Toast.Style.Animated,
      "Researching Broader Exa Sources",
      "No prompt-enhancement request has started.",
    );
    try {
      const result = await researchWithExa(plan, {
        apiKey,
        signal: activeController.signal,
      });
      if (activeController.signal.aborted) {
        toast.style = Toast.Style.Failure;
        toast.title = "Exa Research Cancelled";
        toast.message =
          "No enhancement request was made. Search charges may apply if Exa had already started.";
        return;
      }
      toast.style = Toast.Style.Success;
      toast.title = "Exa Sources Ready";
      toast.message = "Review every result before enhancement.";
      push(
        <ExaResearchSourceReview
          request={request}
          result={result}
          onContinue={onContinue}
          onCancelContinue={onCancelContinue}
        />,
      );
    } catch (error) {
      toast.style = Toast.Style.Failure;
      if (activeController.signal.aborted) {
        toast.title = "Exa Research Cancelled";
        toast.message =
          "No enhancement request was made. Search charges may apply if Exa had already started.";
      } else {
        toast.title = "Exa Research Failed";
        toast.message = error instanceof Error ? error.message : String(error);
      }
    } finally {
      controller.current = undefined;
      setIsLoading(false);
    }
  }

  const markdown = [
    "# Review Exa Research",
    "**No search has started.** Only the focused query below will be sent.",
    `**Cost:** $${(plan.intent?.planningCostUsd ?? 0).toFixed(4)} planning · up to $${maximumCost.toFixed(2)} search`,
    "## Goal",
    plan.intent?.objective ?? "(missing research objective)",
    "## Questions",
    plan.intent?.questions.map((question) => `- ${question}`).join("\n") ??
      "(missing research questions)",
    "## Query",
    indentCode(plan.query ?? "(missing query)"),
  ].join("\n\n");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Review Exa Research"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel Exa Research"
              icon={Icon.XMarkCircle}
              onAction={() => controller.current?.abort()}
            />
          ) : (
            <Action.Push
              title="Enter One-Run Exa Key"
              icon={Icon.Key}
              target={
                <ExaApiKeyForm
                  onSubmit={retrieve}
                  onCancel={() => controller.current?.abort()}
                />
              }
            />
          )}
          <Action.Push
            title="Review Privacy and Limits"
            icon={Icon.Shield}
            target={
              <Detail
                navigationTitle="Exa Research Details"
                markdown={[
                  "# Exa Research Details",
                  "**Service:** Exa Search API · Deep search",
                  `**Category:** ${plan.category ? title(plan.category) : "General semantic web"}`,
                  `**Maximum results:** ${plan.numResults ?? 8}`,
                  "**Content:** Extractive highlights · 3,000 characters per result",
                  "**Freshness:** 24-hour cache, then live crawl with a 12-second limit",
                  FOCUSED_RESEARCH_PRIVACY_DISCLOSURE,
                  EXA_PRIVACY_DISCLOSURE,
                  "The one-run key is sent only in Exa's authentication header, then cleared. It is never saved in prompts, settings, or logs.",
                ].join("\n\n")}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}

function ExaApiKeyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (apiKey: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit() {
    const key = apiKey.trim();
    if (!key) {
      await showToast(
        Toast.Style.Failure,
        "Exa API Key Required",
        "Enter a key for this one research request.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await onSubmit(key);
    } finally {
      setApiKey("");
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="One-Run Exa Key"
      actions={
        <ActionPanel>
          {isLoading ? (
            <Action
              title="Cancel Exa Research"
              icon={Icon.XMarkCircle}
              onAction={onCancel}
            />
          ) : (
            <Action.SubmitForm
              title="Review and Run Exa Search"
              icon={Icon.Key}
              onSubmit={submit}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.PasswordField
        id="apiKey"
        title="Exa API Key"
        placeholder="Used for this search attempt only"
        value={apiKey}
        onChange={setApiKey}
      />
      <Form.Description text="The next step shows an explicit paid-search confirmation. Prompt Studio clears this form after the attempt and does not save the key." />
    </Form>
  );
}

function ExaResearchSourceReview({
  request,
  result,
  onContinue,
  onCancelContinue,
}: {
  request: EnhancementRequest;
  result: ExaResearchResult;
  onContinue: (request: EnhancementRequest) => Promise<void>;
  onCancelContinue: () => void;
}) {
  const [isContinuing, setIsContinuing] = useState(false);
  const mergedSources = mergeReviewedSources(request.sources, result.sources);
  const includedUrls = new Set(mergedSources.map((source) => source.url));
  const mergeOmissions = result.sources.filter(
    (source) => !includedUrls.has(source.url),
  ).length;
  const reviewedRequest: EnhancementRequest = {
    ...request,
    sources: mergedSources,
  };
  const maximumModelCost = estimatedProviderMaximumCostUsd(reviewedRequest);
  const encoder = new TextEncoder();
  const sourceSections = result.sources.map((source, index) =>
    [
      `### ${index + 1}. [${escapeMarkdown(source.title)}](${source.url})`,
      source.author ? `**Author:** ${escapeMarkdown(source.author)}` : "",
      source.publishedDate
        ? `**Published:** ${inlineCode(source.publishedDate)}`
        : "",
      source.score !== undefined
        ? `**Similarity score:** ${source.score.toFixed(3)}`
        : "",
      `**Supports:** ${escapeMarkdown(source.supports)}`,
      `**Retrieved:** ${inlineCode(source.retrievedAt)}`,
      `**Size:** ${encoder.encode(source.content).length.toLocaleString()} bytes`,
      includedUrls.has(source.url)
        ? "**Enhancement status:** Included"
        : "**Enhancement status:** A higher-priority source already uses this URL, or the shared 30 KB limit omitted it",
      "#### Exact Extractive Content Sent to the Model",
      indentCode(source.content),
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
  const warnings =
    result.warnings.length > 0
      ? result.warnings
          .map((warning) => `- ${escapeMarkdown(warning)}`)
          .join("\n")
      : "No provider or partial-result warnings.";
  const totalOmissions = result.omittedResultCount + mergeOmissions;
  const markdown = [
    "# Review Exa Sources",
    "**The paid Exa request is complete; prompt enhancement has not started.** Review every clickable result and exact extractive highlight below.",
    `**Exact reviewed query:** ${inlineCode(result.plan.query)}`,
    `**Safe returned sources:** ${result.sources.length}`,
    `**Results omitted before enhancement:** ${totalOmissions}`,
    `**Exa cost estimate:** $${result.cost.estimatedCostUsd.toFixed(4)}${result.cost.providerReported ? " · provider reported" : " · conservative fallback"}`,
    `**Maximum later enhancement cost:** $${maximumModelCost.toFixed(3)}`,
    "Exa results are untrusted reference material. Prompt Studio does not open returned links automatically.",
    "## Warnings",
    warnings,
    "## Returned Sources",
    ...sourceSections,
  ].join("\n\n");

  async function continueWithReviewedExaSources() {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      await onContinue(reviewedRequest);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <Detail
      isLoading={isContinuing}
      navigationTitle="Review Exa Sources"
      markdown={markdown}
      actions={
        <ActionPanel>
          {isContinuing ? (
            <Action
              title="Cancel Enhancement"
              icon={Icon.XMarkCircle}
              onAction={onCancelContinue}
            />
          ) : (
            <Action
              title="Enhance with Reviewed Exa Sources"
              icon={Icon.Wand}
              onAction={continueWithReviewedExaSources}
            />
          )}
          {result.sources.map((source, index) => (
            <Action.OpenInBrowser
              key={`${source.url}-${index}`}
              title={`Open ${source.title}`}
              url={source.url}
            />
          ))}
        </ActionPanel>
      }
    />
  );
}

function EnhancementHistory({ directory }: { directory: string }) {
  const [records, setRecords] = useState<PromptRecord[]>([]);
  const [invalid, setInvalid] = useState<InvalidPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void listPrompts(enhancementHistoryDirectory(directory))
      .then((library) => {
        setRecords(library.records);
        setInvalid(library.invalid);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        ),
      )
      .finally(() => setIsLoading(false));
  }, [directory]);

  async function saveToLibrary(record: PromptRecord) {
    try {
      await saveEnhancementHistoryToLibrary(
        directory,
        record.id,
        enhancementHistoryDigest(record),
      );
      await showHUD("Prompt saved to library");
    } catch (saveError) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Prompt",
        saveError instanceof Error ? saveError.message : String(saveError),
      );
    }
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={records.length + invalid.length > 0}
      searchBarPlaceholder="Search enhancement history…"
    >
      {!isLoading && records.length + invalid.length === 0 ? (
        <List.EmptyView
          icon={Icon.Clock}
          title={error ? "History Unavailable" : "No Enhancements Yet"}
          description={
            error ??
            "Every completed enhancement will appear here automatically."
          }
        />
      ) : null}
      {records.map((record) => (
        <List.Item
          key={record.id}
          id={record.id}
          icon={Icon.Wand}
          title={record.title}
          subtitle={record.summary}
          accessories={[{ date: new Date(record.createdAt) }]}
          detail={
            <List.Item.Detail
              markdown={enhancementHistoryMarkdown(record)}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Target"
                    text={targetTitle(record.target)}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Created"
                    text={new Date(record.createdAt).toLocaleString()}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <Action
                title="Paste Prompt"
                icon={Icon.ArrowRightCircle}
                onAction={() => pasteEnhancedPrompt(record.body)}
              />
              <Action.CopyToClipboard
                title="Copy Prompt"
                content={record.body}
              />
              <Action
                title="Save to Prompt Library"
                icon={Icon.CheckCircle}
                shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                onAction={() => saveToLibrary(record)}
              />
            </ActionPanel>
          }
        />
      ))}
      {invalid.length > 0 ? (
        <List.Section title="Needs Repair" subtitle={`${invalid.length}`}>
          {invalid.map((item) => (
            <List.Item
              key={item.filePath}
              icon={Icon.ExclamationMark}
              title={item.filePath.split("/").at(-1) ?? item.filePath}
              subtitle={item.error}
              detail={
                <List.Item.Detail
                  markdown={`# Enhancement Needs Repair\n\n${escapeMarkdown(item.error)}\n\n${inlineCode(item.filePath)}`}
                />
              }
              actions={
                <ActionPanel>
                  <Action.Open
                    title="Open Enhancement File"
                    target={item.filePath}
                    shortcut={Keyboard.Shortcut.Common.Open}
                  />
                  <Action.ShowInFinder
                    title="Show Enhancement in Finder"
                    path={item.filePath}
                    shortcut={Keyboard.Shortcut.Common.OpenWith}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function EnhancementPreview({
  request,
  run,
  directory,
  history,
  revisionOfPromptId,
  seed,
}: {
  request: EnhancementRequest;
  run: EnhancementRun;
  directory: string;
  history: PromptRecord;
  revisionOfPromptId?: string | undefined;
  seed: PromptSeedReference;
}) {
  const result = run.result;
  const [isSaving, setIsSaving] = useState(false);
  const contextSummary =
    [
      result.projectFiles.length
        ? `${result.projectFiles.length} project file${result.projectFiles.length === 1 ? "" : "s"}`
        : "",
      result.sources.length
        ? `${result.sources.length} source${result.sources.length === 1 ? "" : "s"}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No project or external sources";

  async function save() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveEnhancementHistoryToLibrary(
        directory,
        history.id,
        enhancementHistoryDigest(history),
        revisionOfPromptId,
      );
      await showHUD(revisionOfPromptId ? "Prompt revision saved" : "Prompt saved");
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Prompt",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Detail
      isLoading={isSaving}
      navigationTitle="Review Enhanced Prompt"
      markdown={result.enhancedPrompt}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Target"
            text={targetTitle(result.target)}
          />
          <Detail.Metadata.Label
            title="Enhancement"
            text={`${providerDisplayName(request)} · ${run.profile.model}`}
          />
          <Detail.Metadata.Label title="Context" text={contextSummary} />
          <Detail.Metadata.Label
            title="Time"
            text={`${(run.latencyMs / 1_000).toFixed(1)}s`}
          />
          <Detail.Metadata.Label
            title="Cost"
            text={`$${run.usage.estimatedCostUsd.toFixed(4)}`}
          />
          <Detail.Metadata.TagList title="Search Tags">
            {result.tags.map((tag) => (
              <Detail.Metadata.TagList.Item key={tag} text={tag} />
            ))}
          </Detail.Metadata.TagList>
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Paste Prompt"
            icon={Icon.ArrowRightCircle}
            onAction={() => pasteEnhancedPrompt(result.enhancedPrompt)}
          />
          <Action.CopyToClipboard
            title="Copy Prompt"
            content={result.enhancedPrompt}
          />
          <Action
            title="Save to Prompt Library"
            icon={Icon.CheckCircle}
            shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
            onAction={save}
          />
          <Action.Push
            title="Edit Before Saving"
            icon={Icon.Pencil}
            shortcut={Keyboard.Shortcut.Common.Edit}
            target={
              <EnhancementEditor
                request={request}
                run={run}
                directory={directory}
                history={history}
                revisionOfPromptId={revisionOfPromptId}
                seed={seed}
              />
            }
          />
          <Action.Push
            title="Review Enhancement Details"
            icon={Icon.Eye}
            shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
            target={
              <Detail
                navigationTitle="Enhancement Details"
                markdown={resultDetailsMarkdown(result, seed)}
              />
            }
          />
          <Action.CopyToClipboard
            title="Copy Hidden Search Terms"
            content={result.searchTerms.join("\n")}
            shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
          />
        </ActionPanel>
      }
    />
  );
}

async function pasteEnhancedPrompt(body: string) {
  await closeMainWindow();
  await Clipboard.paste(body);
  await showHUD("Enhanced Prompt Pasted");
}

function EnhancementEditor({
  request,
  run,
  directory,
  history,
  revisionOfPromptId,
  seed,
}: {
  request: EnhancementRequest;
  run: EnhancementRun;
  directory: string;
  history: PromptRecord;
  revisionOfPromptId?: string | undefined;
  seed: PromptSeedReference;
}) {
  async function save(values: EditorValues) {
    try {
      const edited = validateEnhancementResult(
        {
          ...run.result,
          title: values.title,
          summary: values.summary,
          target: values.target,
          enhancedPrompt: values.enhancedPrompt,
        },
        request,
      );
      const approvedRun: EnhancementRun = { ...run, result: edited };
      const draft = enhancementResultToPromptDraft(approvedRun, request, seed);
      const reviewedHistory = await updatePrompt(
        enhancementHistoryDirectory(directory),
        history.id,
        draft,
        { syncSearchIndex: false },
      );
      await saveEnhancementHistoryToLibrary(
        directory,
        reviewedHistory.id,
        enhancementHistoryDigest(reviewedHistory),
        revisionOfPromptId,
      );
      await showHUD(
        revisionOfPromptId ? "Prompt revision saved" : "Enhanced prompt saved",
      );
    } catch (error) {
      await showToast(
        Toast.Style.Failure,
        "Could Not Save Prompt",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <Form
      navigationTitle="Edit and Save Enhanced Prompt"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Approved Prompt"
            icon={Icon.CheckCircle}
            onSubmit={save}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        defaultValue={run.result.title}
      />
      <Form.TextField
        id="summary"
        title="Summary"
        defaultValue={run.result.summary}
      />
      <Form.Dropdown
        id="target"
        title="Use With"
        defaultValue={run.result.target}
      >
        <Form.Dropdown.Item title="Codex" value="codex" />
        <Form.Dropdown.Item title="Claude Code" value="claude-code" />
        <Form.Dropdown.Item title="Generic / Any Agent" value="generic" />
      </Form.Dropdown>
      <Form.TextArea
        id="enhancedPrompt"
        title="Enhanced Prompt"
        defaultValue={run.result.enhancedPrompt}
      />
      <Form.Description text="Guardrails, sources, and generated discovery metadata stay attached automatically." />
    </Form>
  );
}

function enhancementHistoryMarkdown(record: PromptRecord): string {
  return record.seed
    ? `${record.body}\n\n---\n\n## Original Idea\n\n${record.seed.thoughts}`
    : record.body;
}

function resultDetailsMarkdown(
  result: EnhancementResult,
  seed?: PromptSeedReference,
): string {
  return [
    "# Enhancement Details",
    "These details support review, saving, and search. They are not part of the copy-ready prompt.",
    ...(seed
      ? [
          `## Original Idea\n\n${seed.thoughts}`,
          `## Saved Idea\n\n${seed.id ? "Linked to Idea Studio." : "Not saved to Idea Studio."}`,
        ]
      : []),
    `## Library Title\n\n${result.title}`,
    `## Summary\n\n${result.summary}`,
    `## Assumptions\n\n${bulletList(result.assumptions, "None recorded.")}`,
    `## Missing Information\n\n${bulletList(result.missingInformation, "None identified.")}`,
    `## Validation\n\n${bulletList(result.validationSteps, "No separate validation steps.")}`,
    `## Project Files Used\n\n${bulletList(result.projectFiles, "No project files were read or sent.")}`,
    `## External Sources\n\n${
      result.sources.length > 0
        ? result.sources
            .map(
              (source) =>
                `- [${source.title}](${source.url}) — ${source.supports}`,
            )
            .join("\n")
        : "No external sources were used."
    }`,
    `## Search Metadata\n\n**Aliases:** ${result.aliases.join(", ")}\n\n**Hidden search terms (${result.searchTerms.length}):** ${result.searchTerms.join(", ")}`,
  ].join("\n\n");
}

function bulletList(items: string[], empty: string): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : empty;
}

function providerDisplayName(request: EnhancementRequest): string {
  const profile = getProviderEnhancementProfile(
    request.profileId as SelectableEnhancementProfileId,
  );
  return providerName(profile.provider);
}

function providerName(provider: EnhancementRunProfile["provider"]): string {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "google") return "Google";
  return "OpenAI";
}

function targetTitle(target: PromptTarget): string {
  if (target === "claude-code") return "Claude Code";
  if (target === "codex") return "Codex";
  return "Generic / Any Agent";
}

function evaluationRecordMarkdown(
  record: EnhancementEvaluationRecord,
  reviewNumber: string,
): string {
  const result = record.result;
  return [
    `# Blind Review ${reviewNumber}`,
    "The provider and model are intentionally hidden. Judge only the case and its generated result.",
    "## Rough Input",
    indentCode(record.request.roughThoughts),
    `**Target:** ${escapeMarkdown(targetTitle(record.request.target))}`,
    record.request.project
      ? `**Project:** ${escapeMarkdown(record.request.project.name)}`
      : "**Project:** None",
    "## Required Facts",
    markdownList(record.requiredFacts, "None recorded."),
    "## Prohibited Inventions",
    markdownList(record.prohibitedInventions, "None recorded."),
    "## Generated Prompt",
    indentCode(result.enhancedPrompt),
    "## Generated Supporting Fields",
    `**Title:** ${escapeMarkdown(result.title)}`,
    `**Summary:** ${escapeMarkdown(result.summary)}`,
    `**Assumptions:**\n\n${markdownList(result.assumptions, "None.")}`,
    `**Missing information:**\n\n${markdownList(result.missingInformation, "None.")}`,
    `**Validation:**\n\n${markdownList(result.validationSteps, "None.")}`,
    `**Tags:** ${result.tags.map(inlineCode).join(" ")}`,
    record.humanReview.status === "reviewed"
      ? `## Recorded Review\n\n**Score:** ${evaluationReviewTotal(record)}/100\n\n**Hard failure:** ${record.humanReview.hardFailure ? "Yes" : "No"}${record.humanReview.notes ? `\n\n**Notes:** ${escapeMarkdown(record.humanReview.notes)}` : ""}`
      : "## Recorded Review\n\nPending.",
  ].join("\n\n");
}

function evaluationReviewTotal(record: EnhancementEvaluationRecord): number {
  const review = record.humanReview;
  return (
    (review.fidelity ?? 0) +
    (review.completeness ?? 0) +
    (review.unsupportedFacts ?? 0) +
    (review.actionability ?? 0) +
    (review.validation ?? 0) +
    (review.authorization ?? 0) +
    (review.appropriateLength ?? 0)
  );
}

function selectedReviewScore(value: string, field: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Choose a ${field.toLocaleLowerCase()} score.`);
  }
  return Number(value);
}

async function loadRecentProjectPaths(): Promise<string[]> {
  const saved = await LocalStorage.getItem<string>(RECENT_PROJECTS_KEY);
  if (!saved) return [];
  try {
    const paths = JSON.parse(saved) as unknown;
    return Array.isArray(paths)
      ? paths
          .filter((path): path is string => typeof path === "string")
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function markdownList(values: string[], empty: string): string {
  return values.length > 0
    ? values.map((value) => `- ${escapeMarkdown(value)}`).join("\n")
    : empty;
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, "\\$&");
}

function inlineCode(value: string): string {
  return `\`${value.replaceAll("`", "'")}\``;
}

function indentCode(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `    ${line}`)
    .join("\n");
}
