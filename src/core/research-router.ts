export const RESEARCH_ROUTES = [
  "none",
  "local-project",
  "context7",
  "github",
  "web",
  "exa",
] as const;

export type ResearchRoute = (typeof RESEARCH_ROUTES)[number];
export type RoutedResearchLevel = "none" | "auto" | "deep";

export interface ResearchRouteInput {
  roughThoughts: string;
  researchLevel: RoutedResearchLevel;
  hasSelectedProject: boolean;
  technicalLibrary?: string;
}

export interface ResearchRouteDecision {
  routes: ResearchRoute[];
  reasons: Partial<Record<ResearchRoute, string>>;
  noExternalRequest: boolean;
}

export interface ResearchSourcePolicy {
  route: Exclude<ResearchRoute, "none">;
  priority: number;
  authority: string;
  freshness: string;
  failure: string;
}

export const RESEARCH_SOURCE_POLICY: readonly ResearchSourcePolicy[] = [
  {
    route: "local-project",
    priority: 1,
    authority: "The user-selected working repository and its instructions.",
    freshness: "Read the current working tree immediately before review.",
    failure:
      "Stop project personalization or continue only after the user removes the project.",
  },
  {
    route: "context7",
    priority: 2,
    authority: "Version-matching official library and API documentation.",
    freshness:
      "Resolve the explicitly supplied or exact project version; never silently fall back to another version.",
    failure:
      "Show a recoverable error and do not invent the missing library behavior.",
  },
  {
    route: "github",
    priority: 3,
    authority:
      "Read-only upstream repositories, releases, issues, and pull requests.",
    freshness:
      "Record the retrieved object URL and current revision or timestamp.",
    failure:
      "Continue only if upstream history is optional and label it missing.",
  },
  {
    route: "web",
    priority: 4,
    authority: "Official and primary current sources before secondary pages.",
    freshness:
      "Retrieve at run time and record publication or update dates when available.",
    failure: "Stop current-fact claims or label them unverified.",
  },
  {
    route: "exa",
    priority: 5,
    authority:
      "Broader semantic results, papers, code examples, and community pages.",
    freshness:
      "Record retrieval time and prefer newer results only when authority and version match.",
    failure:
      "Continue without Exa when stronger sources are sufficient; otherwise label the gap.",
  },
] as const;

export interface ResearchEvidence {
  route: Exclude<ResearchRoute, "none">;
  versionMatch: boolean;
  official: boolean;
  retrievedAt: string;
}

export function planResearchRoutes(
  input: ResearchRouteInput,
): ResearchRouteDecision {
  if (input.researchLevel === "none") {
    return {
      routes: ["none"],
      reasons: { none: "Research is Off, so no external source may run." },
      noExternalRequest: true,
    };
  }

  const routes: ResearchRoute[] = [];
  const reasons: Partial<Record<ResearchRoute, string>> = {};
  if (input.hasSelectedProject) {
    routes.push("local-project");
    reasons["local-project"] =
      "A selected project is the first source for project-specific facts.";
  }
  if (input.technicalLibrary?.trim()) {
    routes.push("context7");
    reasons.context7 =
      "A named technical library requires version-matching documentation.";
  }
  if (needsGithub(input.roughThoughts)) {
    routes.push("github");
    reasons.github =
      "The task explicitly refers to upstream GitHub code, history, or objects.";
  }
  if (needsCurrentWeb(input.roughThoughts, Boolean(input.technicalLibrary))) {
    routes.push("web");
    reasons.web =
      "The task depends on a current external fact outside named library documentation.";
  }
  if (
    input.researchLevel === "deep" &&
    needsBroadResearch(input.roughThoughts)
  ) {
    routes.push("exa");
    reasons.exa =
      "Deep research explicitly asks for broader examples, papers, or comparisons.";
  }

  if (routes.length === 0) {
    return {
      routes: ["none"],
      reasons: {
        none: "The task does not identify a justified external information need.",
      },
      noExternalRequest: true,
    };
  }
  return { routes, reasons, noExternalRequest: false };
}

export function preferResearchEvidence<T extends ResearchEvidence>(
  evidence: T[],
): T[] {
  const priority = new Map(
    RESEARCH_SOURCE_POLICY.map((policy) => [policy.route, policy.priority]),
  );
  return [...evidence].sort(
    (left, right) =>
      Number(right.versionMatch) - Number(left.versionMatch) ||
      (priority.get(left.route) ?? Number.MAX_SAFE_INTEGER) -
        (priority.get(right.route) ?? Number.MAX_SAFE_INTEGER) ||
      Number(right.official) - Number(left.official) ||
      Date.parse(right.retrievedAt) - Date.parse(left.retrievedAt),
  );
}

export function sanitizeResearchQuery(value: string, maximum = 500): string {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 2_000) {
    throw new Error("Research query limit must be between 1 and 2,000.");
  }
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/(?:^|\s)(?:~\/|\/Users\/|\/home\/|[A-Za-z]:\\)[^\s,;]+/g, " ")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum)
    .trim();
}

function needsGithub(value: string): boolean {
  return /(?:github\.com\/|upstream\s+(?:issue|pull request|pr|release|commit)|github\s+(?:issue|pull request|pr|release|commit)|\b(?:issue|pr)\s*#\d+)/i.test(
    value,
  );
}

function needsCurrentWeb(value: string, hasTechnicalLibrary: boolean): boolean {
  const current = /\b(?:current|latest|today|recent|as of|right now)\b/i.test(
    value,
  );
  if (!current) return false;
  if (
    hasTechnicalLibrary &&
    /\b(?:api|documentation|docs|method|function|hook|component|sdk|cli|library|framework)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  return true;
}

function needsBroadResearch(value: string): boolean {
  return /\b(?:paper|papers|research literature|survey|landscape|compare alternatives|community examples|case studies|best approaches)\b/i.test(
    value,
  );
}
