import type {
  EnhancementProvenance,
  PromptRecord,
} from "./prompt-store.ts";

export function enhancementHistoryHaystack(record: PromptRecord): string {
  const quality = record.enhancement?.quality;
  return [
    record.title,
    record.summary,
    record.body,
    record.seed?.thoughts ?? "",
    record.enhancement?.model ?? "",
    record.enhancement?.profileId ?? "",
    record.enhancement?.generationRole ?? "",
    quality ? String(quality.score) : "",
    quality ? `${quality.score}/10` : "",
    quality?.rationale ?? "",
  ]
    .join("\n")
    .toLowerCase();
}

export function enhancementHistoryMatches(
  record: PromptRecord,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return enhancementHistoryHaystack(record).includes(needle);
}

export function enhancementHistoryRowSummary(
  record: PromptRecord,
  options: {
    savedToLibrary: boolean;
    used: boolean;
    useCount?: number;
  },
): string {
  const enhancement = record.enhancement;
  const quality = enhancement?.quality;
  const parts: string[] = [];
  if (quality) parts.push(`${quality.score}/10`);
  parts.push(options.savedToLibrary ? "Saved" : "Unsaved");
  parts.push(
    options.used
      ? options.useCount
        ? `Used ${options.useCount}`
        : "Used"
      : "Unused",
  );
  const pass =
    enhancement?.generationPass && enhancement.generationPassCount
      ? `P${enhancement.generationPass}/${enhancement.generationPassCount}`
      : enhancement?.generationRole === "candidate"
        ? "Pass"
        : enhancement?.generationRole === "winner"
          ? "Winner"
          : undefined;
  if (pass) parts.push(pass);
  const model = shortEnhancementModel(enhancement?.model);
  if (model) parts.push(model);
  if (enhancement?.estimatedCostUsd !== undefined) {
    parts.push(`$${enhancement.estimatedCostUsd.toFixed(4)}`);
  }
  return parts.join(" · ");
}

export function shortEnhancementModel(model: string | undefined): string | undefined {
  if (!model) return;
  const lower = model.toLowerCase();
  if (lower.includes("gemini")) return "Gemini 3.7";
  if (lower.includes("terra")) return "Terra";
  if (lower.includes("sol")) return "Sol";
  if (lower.includes("claude") || lower.includes("sonnet")) return "Claude";
  if (lower.includes("deepseek")) return "DeepSeek";
  return model;
}

export function enhancementHistoryTimestamp(record: PromptRecord): Date {
  return new Date(record.enhancement?.generatedAt ?? record.createdAt);
}

export function withHistoryQuality(
  enhancement: EnhancementProvenance | undefined,
  quality: {
    score: number;
    rationale: string;
    model: string;
    estimatedCostUsd: number;
  },
): EnhancementProvenance {
  if (!enhancement) {
    throw new Error(
      "This history item has no enhancement provenance to attach a score to.",
    );
  }
  return {
    ...enhancement,
    quality: {
      score: quality.score,
      rationale: quality.rationale,
      model: quality.model,
      estimatedCostUsd: quality.estimatedCostUsd,
    },
  };
}

export function enhancementHistoryMarkdown(
  record: PromptRecord,
  options: {
    savedToLibrary: boolean;
    used: boolean;
    useCount?: number;
  },
): string {
  const enhancement = record.enhancement;
  const quality = enhancement?.quality;
  const role = enhancement?.generationRole;
  const pass =
    enhancement?.generationPass && enhancement.generationPassCount
      ? `Pass ${enhancement.generationPass} of ${enhancement.generationPassCount}`
      : role
        ? role
        : "unspecified";
  const usedLabel = options.used
    ? `Yes${options.useCount ? ` (${options.useCount})` : ""}`
    : "No";
  const lines = [
    `# ${record.title}`,
    "",
    `**Saved to library:** ${options.savedToLibrary ? "Yes" : "No"}`,
    `**Used:** ${usedLabel}`,
    `**Score:** ${quality ? `${quality.score}/10` : "none"}`,
    `**Role:** ${pass}`,
    `**Model:** ${enhancement?.model ?? "unknown"}`,
    `**Cost:** ${
      enhancement?.estimatedCostUsd === undefined
        ? "unknown"
        : `$${enhancement.estimatedCostUsd.toFixed(4)}`
    }`,
    `**Generated:** ${enhancement?.generatedAt ?? record.createdAt}`,
  ];
  if (quality?.rationale) {
    lines.push("", "## Quality reason", "", quality.rationale);
  }
  if (record.seed?.thoughts) {
    lines.push("", "## Rough thoughts", "", record.seed.thoughts);
  }
  if (record.missingInformation && record.missingInformation.length > 0) {
    lines.push(
      "",
      "## Missing information",
      "",
      record.missingInformation.map((item) => `- ${item}`).join("\n"),
    );
  }
  lines.push("", "## Compiled prompt", "", record.body);
  return lines.join("\n");
}
