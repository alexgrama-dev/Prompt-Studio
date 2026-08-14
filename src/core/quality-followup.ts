export const QUALITY_REWRITE_BELOW = 7;

export interface QualityFollowup {
  low: boolean;
  rewrite: boolean;
  needEvidence: boolean;
  needProject: boolean;
  instruction: string;
}

const EVIDENCE_GAP =
  /\b(log|logs|stack trace|traceback|screenshot|error output|repro(?:duction)?|evidence|paste the|no log|missing log|without (?:a |the )?log)\b/i;
const PROJECT_GAP =
  /\b(repo|repository|project context|no project|without (?:the )?(?:codebase|repo|repository)|named files|working tree|local project)\b/i;

export function classifyQualityFollowup(
  score: number,
  rationale: string,
): QualityFollowup {
  const trimmed = rationale.trim();
  if (score >= QUALITY_REWRITE_BELOW) {
    return {
      low: false,
      rewrite: false,
      needEvidence: false,
      needProject: false,
      instruction: "",
    };
  }
  const needEvidence = EVIDENCE_GAP.test(trimmed);
  const needProject = PROJECT_GAP.test(trimmed);
  const rewrite = !needEvidence && !needProject;
  return {
    low: true,
    rewrite,
    needEvidence,
    needProject,
    instruction: rewrite ? rewriteInstructionFromQuality(trimmed) : trimmed,
  };
}

export function rewriteInstructionFromQuality(rationale: string): string {
  const reason = rationale.trim();
  return [
    `The quality rater scored this prompt low for this reason: ${reason}`,
    "Fix that gap.",
    "Keep every constraint from the rough thoughts.",
    "Do not invent files or evidence the user did not supply.",
    "Propose a success check if the user did not name one.",
  ].join(" ");
}
