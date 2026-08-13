import {
  fenceUntrustedEvidence,
  type UntrustedSurface,
} from "./anti-patterns.ts";
import { compilerRenderingAddendum } from "./rendering-profiles.ts";
import type { PromptTarget } from "./prompt-store.ts";

export const TASK_CLASSES = [
  "bugfix",
  "feature",
  "refactor",
  "migration",
  "performance",
  "test",
  "audit",
  "investigation",
  "infrastructure",
  "data",
  "design-ui",
  "documentation",
] as const;

export type TaskClass = (typeof TASK_CLASSES)[number];
export type TaskScope =
  | "line"
  | "file"
  | "multi-file"
  | "cross-cutting"
  | "greenfield";
export type TaskCertainty = "known-end-state" | "discovery-first";
export type TaskRisk = "reversible-local" | "destructive-or-shared";
export type TaskVerifiability = "test" | "build" | "browser" | "human-only";
export type GapBucket = "discoverable" | "inferable" | "blocking";
export type EvidenceTag =
  | "stack-trace"
  | "diff"
  | "code-block"
  | "file-path"
  | "url"
  | "prose";

export interface CaptureInput {
  text: string;
  surface?: UntrustedSurface;
}

export interface NormalizedInput {
  text: string;
  language: "en" | "und";
  evidenceTags: EvidenceTag[];
  surface?: UntrustedSurface;
}

export interface TaskLabel {
  class: TaskClass;
  scope: TaskScope;
  certainty: TaskCertainty;
  risk: TaskRisk;
  verifiability: TaskVerifiability;
  confidence: number;
}

export interface Gap {
  bucket: GapBucket;
  detail: string;
}

export interface ElicitationPlan {
  questions: string[];
  skipAssumptions: string[];
}

export interface CompilerStagePlan {
  capture: NormalizedInput;
  label: TaskLabel;
  gaps: Gap[];
  elicitation: ElicitationPlan;
  renderingAddendum: string;
  gapAddendum: string;
}

const CLASS_RULES: readonly { class: TaskClass; pattern: RegExp }[] = [
  { class: "investigation", pattern: /\b(why|diagnose|root cause|ci only|flake)\b/i },
  { class: "bugfix", pattern: /\b(bug|broken|crash|fail|error|fix|does nothing|noop)\b/i },
  { class: "test", pattern: /\b(test|coverage|spec|assert)\b/i },
  { class: "performance", pattern: /\b(slow|latency|perf|jank)\b/i },
  { class: "migration", pattern: /\b(migrat|move off|replace library)\b/i },
  { class: "refactor", pattern: /\b(refactor|clean up|this file is a mess)\b/i },
  { class: "audit", pattern: /\b(audit|review|security review)\b/i },
  { class: "infrastructure", pattern: /\b(infra|deploy|ci pipeline|kubernetes|terraform)\b/i },
  { class: "data", pattern: /\b(pipeline|etl|dataset|warehouse)\b/i },
  { class: "design-ui", pattern: /\b(ui|css|layout|ugly|dark mode|empty state)\b/i },
  { class: "documentation", pattern: /\b(docs|readme|changelog|summarize)\b/i },
  { class: "feature", pattern: /\b(add|implement|build|feature|wish)\b/i },
];

export function normalizeCapture(input: CaptureInput): NormalizedInput {
  const text = input.text.split("\0").join("").trimEnd();
  const evidenceTags = detectEvidenceTags(text);
  return {
    text,
    language: detectLanguage(text),
    evidenceTags,
    ...(input.surface ? { surface: input.surface } : {}),
  };
}

const FULLY_FENCED =
  /^<untrusted-evidence\b[^>]*>[\s\S]*<\/untrusted-evidence>\s*$/i;

export function applyCaptureFence(
  text: string,
  surface?: UntrustedSurface,
): string {
  const trimmed = text.trim();
  if (!trimmed || !surface) return text;
  if (FULLY_FENCED.test(trimmed)) return text;
  return fenceUntrustedEvidence(text, surface);
}

export function appendUntrustedEvidence(
  existing: string,
  evidence: string,
  surface: UntrustedSurface,
): string {
  const trimmed = evidence.trim();
  if (!trimmed) return existing;
  const fenced = fenceUntrustedEvidence(evidence, surface);
  const head = existing.trimEnd();
  return head ? `${head}\n\n${fenced}` : fenced;
}

export function classifyTask(text: string): TaskLabel {
  const matches = CLASS_RULES.filter((rule) => rule.pattern.test(text));
  const unique = [...new Set(matches.map((item) => item.class))];
  const className = unique[0] ?? "feature";
  const confidence = unique.length === 1 ? 0.8 : unique.length === 0 ? 0.35 : 0.45;
  const hasPath = FILE_PATH.test(text);
  const greenfield = /\b(build me|from scratch|greenfield|new (cli|app|service))\b/i.test(
    text,
  );
  return {
    class: className,
    scope: greenfield
      ? "greenfield"
      : hasPath
        ? "file"
        : /\b(repo|codebase|all files|cross)\b/i.test(text)
          ? "cross-cutting"
          : "file",
    certainty: /\b(why|investigate|diagnose|not sure)\b/i.test(text)
      ? "discovery-first"
      : "known-end-state",
    risk: /\b(prod|production|delete|drop|force-push|deploy|secret)\b/i.test(text)
      ? "destructive-or-shared"
      : "reversible-local",
    verifiability: /\b(test|spec|coverage)\b/i.test(text)
      ? "test"
      : /\b(ui|browser|screenshot|css)\b/i.test(text)
        ? "browser"
        : /\b(build|typecheck|lint)\b/i.test(text)
          ? "build"
          : "human-only",
    confidence,
  };
}

export function analyzeGaps(
  text: string,
  label: TaskLabel,
  options: { hasProject?: boolean } = {},
): Gap[] {
  const gaps: Gap[] = [];
  const hasPath = FILE_PATH.test(text);
  if (!hasPath && label.scope !== "greenfield" && !options.hasProject) {
    gaps.push({
      bucket: "discoverable",
      detail: "Target files are unnamed. Instruct the agent to inspect the repository.",
    });
  }
  if (label.class === "bugfix" && !/\b(expected|actual|repro)\b/i.test(text)) {
    gaps.push({
      bucket: "blocking",
      detail: "Expected versus actual behavior is unnamed.",
    });
  }
  if (label.class === "design-ui" && /\b(ugly|mess|less ugly)\b/i.test(text)) {
    gaps.push({
      bucket: "blocking",
      detail: "Acceptance look is unnamed. Do not invent a design system.",
    });
  }
  if (label.certainty === "discovery-first") {
    gaps.push({
      bucket: "inferable",
      detail: "Treat diagnosis as the authorized action unless the user asked to fix.",
    });
  }
  if (label.risk === "destructive-or-shared") {
    gaps.push({
      bucket: "inferable",
      detail: "Keep destructive or shared-system actions unauthorized until the user grants them.",
    });
  }
  return gaps;
}

export function elicitationPolicy(gaps: readonly Gap[], confidence: number): ElicitationPlan {
  const blocking = gaps.filter((gap) => gap.bucket === "blocking").slice(0, 3);
  if (blocking.length === 0 && confidence >= 0.6) {
    return { questions: [], skipAssumptions: [] };
  }
  const questions = blocking.map((gap) => gap.detail);
  const skipAssumptions = blocking.map(
    (gap) => `If unanswered, list this as missingInformation: ${gap.detail}`,
  );
  if (confidence < 0.6 && questions.length === 0) {
    questions.push("Confirm the task class before assuming an implementation plan.");
    skipAssumptions.push(
      "If unanswered, keep the prompt diagnostic and list the class as missingInformation.",
    );
  }
  return { questions, skipAssumptions };
}

export function planCompilerStages(input: {
  roughThoughts: string;
  target: PromptTarget;
  hasProject?: boolean;
  surface?: UntrustedSurface;
}): CompilerStagePlan {
  const capture = normalizeCapture({
    text: input.roughThoughts,
    ...(input.surface ? { surface: input.surface } : {}),
  });
  const label = classifyTask(capture.text);
  const gaps = analyzeGaps(
    capture.text,
    label,
    input.hasProject === undefined ? {} : { hasProject: input.hasProject },
  );
  const elicitation = elicitationPolicy(gaps, label.confidence);
  return {
    capture,
    label,
    gaps,
    elicitation,
    renderingAddendum: compilerRenderingAddendum(input.target),
    gapAddendum: compilerGapAddendum(label, gaps, elicitation),
  };
}

export function compilerGapAddendum(
  label: TaskLabel,
  gaps: readonly Gap[],
  elicitation: ElicitationPlan,
): string {
  const lines = [
    `Task class (rules, confidence ${label.confidence.toFixed(2)}): ${label.class}; scope ${label.scope}; certainty ${label.certainty}; risk ${label.risk}; verifiability ${label.verifiability}.`,
  ];
  for (const gap of gaps) {
    if (gap.bucket === "discoverable") {
      lines.push(`Discoverable gap: ${gap.detail} Do not ask the user.`);
    } else if (gap.bucket === "inferable") {
      lines.push(`Inferable default: ${gap.detail} Surface it as an assumption.`);
    } else {
      lines.push(`Blocking gap: ${gap.detail} Do not guess. List it in missingInformation.`);
    }
  }
  if (elicitation.questions.length > 0) {
    lines.push(
      `Elicitation is off on this path. ${elicitation.skipAssumptions.join(" ")}`,
    );
  }
  return lines.join("\n");
}

const FILE_PATH =
  /(?:[\w.-]+\/)+[\w.-]+\.(?:cjs|go|java|js|json|jsx|kt|md|mjs|py|rb|rs|swift|ts|tsx|yaml|yml)/;

function detectLanguage(text: string): "en" | "und" {
  const letters = text.replace(/[^A-Za-z\u00C0-\u024F]/g, "");
  if (letters.length < 8) return "en";
  const ascii = letters.replace(/[^A-Za-z]/g, "").length;
  return ascii / letters.length >= 0.85 ? "en" : "und";
}

function detectEvidenceTags(text: string): EvidenceTag[] {
  const tags: EvidenceTag[] = [];
  if (/^\s*at\s+\S+/m.test(text) || /Traceback \(most recent call last\)/.test(text)) {
    tags.push("stack-trace");
  }
  if (/^diff --git /m.test(text) || /^@@ -\d+/m.test(text)) tags.push("diff");
  if (/```/.test(text)) tags.push("code-block");
  if (FILE_PATH.test(text)) tags.push("file-path");
  if (/https?:\/\//i.test(text)) tags.push("url");
  if (tags.length === 0) tags.push("prose");
  return tags;
}
