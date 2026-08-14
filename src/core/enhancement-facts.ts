const FILE_PATH =
  /(?:[\w.-]+\/)+[\w.-]+\.(?:cjs|go|java|js|json|jsx|kt|md|mjs|py|rb|rs|swift|ts|tsx|yaml|yml)/g;
const QUOTED = /"([^"]{3,80})"|'([^']{3,80})'/g;
const FORBID =
  /\b(do not|don't|never|must not|without|forbid|not allowed)\b/i;
const DIAGNOSE_ONLY =
  /\b(diagnose|investigate|analyze|review|plan|summarize|find the cause)\b/i;
const IMPLEMENT =
  /\b(fix|implement|build|change|edit|patch|apply)\b/i;

export interface DerivedEnhancementFacts {
  requiredFacts: string[];
  prohibitedInventions: string[];
}

export function deriveEnhancementFacts(input: {
  roughThoughts: string;
  allowedProjectFiles?: readonly string[];
  projectName?: string;
}): DerivedEnhancementFacts {
  const text = input.roughThoughts.trim();
  const requiredFacts: string[] = [];
  const prohibitedInventions: string[] = [
    "A file, command, library, version, or API the user did not name.",
  ];

  for (const sentence of splitSentences(text)) {
    if (FORBID.test(sentence) || /\bmust\b/i.test(sentence)) {
      pushUnique(requiredFacts, clipFact(sentence));
    }
  }

  for (const match of text.matchAll(FILE_PATH)) {
    pushUnique(requiredFacts, `Named file ${match[0]} must stay in scope.`);
  }

  for (const match of text.matchAll(QUOTED)) {
    const quoted = match[1] ?? match[2];
    if (quoted) pushUnique(requiredFacts, `Keep the stated phrase "${quoted}".`);
  }

  if (input.projectName?.trim()) {
    pushUnique(
      requiredFacts,
      `Work stays inside the supplied project ${input.projectName.trim()}.`,
    );
  }
  for (const file of input.allowedProjectFiles ?? []) {
    pushUnique(requiredFacts, `Supplied project file ${file} is not an invention.`);
  }

  if (DIAGNOSE_ONLY.test(text) && !IMPLEMENT.test(text)) {
    pushUnique(
      prohibitedInventions,
      "Permission to implement, edit files, or apply a fix.",
    );
  }
  if (!(input.allowedProjectFiles && input.allowedProjectFiles.length > 0)) {
    pushUnique(
      prohibitedInventions,
      "A repository layout, file path, or command the user did not name.",
    );
  }
  pushUnique(
    prohibitedInventions,
    "A claim that tests, builds, or reviews already passed.",
  );

  return {
    requiredFacts: requiredFacts.slice(0, 8),
    prohibitedInventions: prohibitedInventions.slice(0, 6),
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
}

function clipFact(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 179).trimEnd()}…`;
}

function pushUnique(items: string[], value: string): void {
  if (!value || items.includes(value)) return;
  items.push(value);
}
