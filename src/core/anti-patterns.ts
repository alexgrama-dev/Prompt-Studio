export const ANTI_PATTERN_IDS = [
  "length-as-quality",
  "process-overspec",
  "absolutes-on-judgment",
  "emphasis-inflation",
  "unverifiable-success",
  "missing-stopping-rules",
  "fabricated-specifics",
  "silent-assumption-burial",
  "scope-inflation",
  "redundant-instruction",
  "cargo-cult-structure",
  "injection-passthrough",
  "merged-conflict-rendering",
  "tier-blind-density",
  "unguarded-tool-trust",
  "identifier-markup-drift",
] as const;

export type AntiPatternId = (typeof ANTI_PATTERN_IDS)[number];

export const UNTRUSTED_SURFACES = [
  "argument",
  "selection",
  "clipboard",
  "repository-file",
] as const;

export type UntrustedSurface = (typeof UNTRUSTED_SURFACES)[number];

export interface AntiPatternFinding {
  id: AntiPatternId;
  evidence: string;
}

export interface AntiPatternContext {
  prompt: string;
  roughInput: string;
  allowedProjectFiles?: readonly string[];
  untrustedSpans?: readonly string[];
  reasoningTier?: "reasoning" | "non-reasoning";
  identifierMarkup?: "xml" | "markdown-backticks";
  requiredGuards?: readonly string[];
}

const PATH_PATTERN =
  /(?:[\w.-]+\/)+[\w.-]+\.(?:cjs|go|java|js|json|jsx|kt|md|mjs|py|rb|rs|swift|ts|tsx|yaml|yml)/g;
const NUMBERED_STEP = /^\s*\d+[.)]\s+\S/gm;
const SAFETY_ABSOLUTE =
  /\b(?:NEVER (?:delete|force-push|commit secrets|deploy)|MUST NOT (?:deploy|force-push|delete|exfiltrate))\b/;

export function fenceUntrustedEvidence(
  text: string,
  surface: UntrustedSurface,
): string {
  if (!UNTRUSTED_SURFACES.includes(surface)) {
    throw new Error(`Unsupported untrusted surface: ${String(surface)}.`);
  }
  return `<untrusted-evidence source="${surface}">\n${text}\n</untrusted-evidence>`;
}

export function detectAntiPatterns(
  context: AntiPatternContext,
): AntiPatternFinding[] {
  const prompt = context.prompt;
  const rough = context.roughInput;
  const findings: AntiPatternFinding[] = [];
  const add = (id: AntiPatternId, evidence: string) => {
    if (!findings.some((item) => item.id === id)) {
      findings.push({ id, evidence });
    }
  };

  const promptWords = wordCount(prompt);
  const roughWords = wordCount(rough);
  const numberedSteps = prompt.match(NUMBERED_STEP) ?? [];

  if (
    (promptWords > 350 && roughWords < 25) ||
    /you are (?:an? )?(?:expert|world-class)|take a deep breath|let'?s think step by step/i.test(
      prompt,
    )
  ) {
    add(
      "length-as-quality",
      "Ceremonial preamble or length far above the input size.",
    );
  }

  if (numberedSteps.length >= 6 && roughWords < 20) {
    add(
      "process-overspec",
      `Prescribes ${numberedSteps.length} numbered steps for a short ask.`,
    );
  }

  const absoluteMatches =
    prompt.match(/\b(?:ALWAYS|NEVER|MUST NOT|MUST)\b/g) ?? [];
  const safetyAbsolutes = prompt.match(
    new RegExp(SAFETY_ABSOLUTE.source, "g"),
  ) ?? [];
  if (absoluteMatches.length - safetyAbsolutes.length >= 4) {
    add(
      "absolutes-on-judgment",
      "Stacked ALWAYS/NEVER/MUST on non-safety judgment calls.",
    );
  }

  const emphasis =
    prompt.match(/\b(?:CRITICAL|IMPORTANT|WARNING|MANDATORY)\b/g) ?? [];
  if (emphasis.length >= 3 || /!!!/.test(prompt)) {
    add("emphasis-inflation", "Stacked criticality markers or shouting.");
  }

  if (
    /\b(?:make it (?:good|better|beautiful|nice)|ensure quality|handle(?: all)? edge cases|be robust)\b/i.test(
      prompt,
    ) &&
    !/\b(?:test|assert|command|status code|pixel|reproduc(?:e|tion))\b/i.test(
      prompt,
    )
  ) {
    add(
      "unverifiable-success",
      "Success language with nothing checkable behind it.",
    );
  }

  if (
    !/\b(?:done when|stop when|ask (?:the user )?when|do not (?:keep )?(?:iterating|continue)|finished when|stop iterating)\b/i.test(
      prompt,
    )
  ) {
    add("missing-stopping-rules", "No done / ask / stop-iterating condition.");
  }

  const allowed = new Set(
    [
      ...(context.allowedProjectFiles ?? []),
      ...extractPaths(rough),
    ].map((item) => item.toLocaleLowerCase()),
  );
  const invented = extractPaths(prompt).filter(
    (item) => !allowed.has(item.toLocaleLowerCase()),
  );
  if (invented.length > 0) {
    add("fabricated-specifics", invented[0]!);
  }

  if (
    /\b(?:the (?:app|project|codebase|stack) uses |i(?:'| a)ssume (?:we|you) use )\b/i.test(
      prompt,
    ) &&
    !/\bassumptions?\b/i.test(prompt)
  ) {
    add(
      "silent-assumption-burial",
      "Stack or tool inferred without an Assumptions section.",
    );
  }

  if (
    roughWords < 12 &&
    /\b(?:architecture review|redesign the (?:module|system|app|product)|migrate (?:the )?stack|introduce an abstraction|rewrite the (?:module|system)|multi-week)\b/i.test(
      prompt,
    )
  ) {
    add("scope-inflation", "Small ask expanded into a program of work.");
  }

  if (
    /\b(?:think step by step|you are a helpful assistant|take a deep breath|don'?t hallucinate|let'?s work this out)\b/i.test(
      prompt,
    )
  ) {
    add(
      "redundant-instruction",
      "Instruction duplicates native model behavior.",
    );
  }

  if (
    /(?:^|\n)## [^\n]+\n{2,}(?:## )/m.test(prompt) ||
    /(?:^|\n)## [^\n]+\n+(?:N\/A|TBD|None\.?)\s*(?:\n|$)/m.test(prompt)
  ) {
    add("cargo-cult-structure", "Empty or placeholder Markdown section.");
  }

  for (const span of context.untrustedSpans ?? []) {
    if (!span.trim()) continue;
    let from = 0;
    while (from <= prompt.length) {
      const index = prompt.indexOf(span, from);
      if (index < 0) break;
      if (!isInsideUntrustedFence(prompt, index, span.length)) {
        add(
          "injection-passthrough",
          "Untrusted span appears outside an evidence fence.",
        );
        break;
      }
      from = index + span.length;
    }
  }

  const contextFirst =
    /\bdocuments? (?:go |come )?(?:first|above|before)\b/i.test(prompt);
  const instructionsFirst =
    /\binstructions? (?:go |come )?(?:first|above|before)\b/i.test(prompt);
  const verifyScaffold =
    /\b(?:final verification step|subagent to verify)\b/i.test(prompt);
  const verifySuppress = /\bdo not (?:add|include) (?:a |extra )?verif/i.test(
    prompt,
  );
  const namedStack = /\b(?:shadcn|next-themes|lucide-react)\b/i.test(prompt);
  const antiDefault =
    /\b(?:preserve (?:the )?existing (?:design|system)|anti-slop|do not (?:use|emit) (?:a )?generic)\b/i.test(
      prompt,
    );
  if (
    (contextFirst && instructionsFirst) ||
    (verifyScaffold && verifySuppress) ||
    (namedStack && antiDefault)
  ) {
    add(
      "merged-conflict-rendering",
      "Prompt averages opposing vendor directives.",
    );
  }

  if (context.reasoningTier === "reasoning" && numberedSteps.length >= 6) {
    add(
      "tier-blind-density",
      "Numbered process list on a reasoning-tier target.",
    );
  }
  if (
    context.reasoningTier === "non-reasoning" &&
    promptWords < 40 &&
    !/\b(?:must|do not|constraint)\b/i.test(prompt)
  ) {
    add(
      "tier-blind-density",
      "Outcome-only prompt on a non-reasoning target.",
    );
  }

  for (const guard of context.requiredGuards ?? []) {
    if (
      guard.trim() &&
      !prompt.toLocaleLowerCase().includes(guard.toLocaleLowerCase())
    ) {
      add("unguarded-tool-trust", guard);
      break;
    }
  }

  const backtickPaths = prompt.match(/`[^`]+`/g) ?? [];
  const xmlMarkup = /<(?:file|path)[\s>]/i.test(prompt);
  if (
    context.identifierMarkup === "xml" &&
    backtickPaths.length >= 2 &&
    !xmlMarkup
  ) {
    add(
      "identifier-markup-drift",
      "Profile wants XML identifiers; prompt uses only Markdown backticks.",
    );
  }
  if (
    context.identifierMarkup === "markdown-backticks" &&
    xmlMarkup &&
    backtickPaths.length === 0
  ) {
    add(
      "identifier-markup-drift",
      "Profile wants Markdown backticks; prompt uses XML tags.",
    );
  }

  return findings;
}

export function antiPatternIdsIn(
  findings: readonly AntiPatternFinding[],
): AntiPatternId[] {
  return findings.map((item) => item.id);
}

function extractPaths(value: string): string[] {
  return value.match(PATH_PATTERN) ?? [];
}

function wordCount(value: string): number {
  return value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
}

function isInsideUntrustedFence(
  prompt: string,
  index: number,
  length: number,
): boolean {
  const before = prompt.slice(0, index);
  const open = before.lastIndexOf("<untrusted-evidence");
  const close = before.lastIndexOf("</untrusted-evidence>");
  if (open < 0 || open < close) return false;
  const after = prompt.slice(index + length);
  return after.includes("</untrusted-evidence>");
}
