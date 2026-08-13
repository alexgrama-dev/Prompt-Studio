import { join } from "node:path";
import {
  getEnhancementEvaluationPlan,
  normalizeEvaluationRepeats,
  runEnhancementEvaluation,
  type EvaluationSplit,
} from "../src/core/evaluation.ts";
import { providerKeyFromEnvironment } from "../src/core/enhancement-dispatch.ts";
import type { SelectableEnhancementProfileId } from "../src/core/provider-profiles.ts";

interface Arguments {
  profileId: SelectableEnhancementProfileId;
  split?: EvaluationSplit;
  caseIds?: string[];
  limit?: number;
  repeats?: number;
  maxUsd?: number;
  confirmSpend: boolean;
}

const args = parseArguments(process.argv.slice(2));
const selection = {
  ...(args.split ? { split: args.split } : {}),
  ...(args.caseIds?.length ? { caseIds: args.caseIds } : {}),
  ...(args.limit ? { limit: args.limit } : {}),
  ...(args.repeats ? { repeats: args.repeats } : {}),
};
const plan = getEnhancementEvaluationPlan(args.profileId, selection);

console.log(
  JSON.stringify(
    {
      mode: args.confirmSpend ? "live" : "dry-run",
      profile: {
        id: plan.profile.id,
        provider: plan.profile.provider,
        model: plan.profile.model,
        reasoningEffort: plan.profile.reasoningEffort,
        passes: plan.profile.passes,
      },
      cases: plan.cases.length,
      repeats: plan.repeats,
      generations: plan.cases.length * plan.repeats,
      splits: countBy(plan.cases, (item) => item.split),
      maximumModelTokenCostUsd: plan.maximumCostUsd,
      privacyDisclosure: plan.privacyDisclosure,
    },
    null,
    2,
  ),
);

if (!args.confirmSpend) {
  console.log(
    "\nDry run only. A live run additionally requires --confirm-spend, --max-usd <limit>, and the selected provider's environment key.",
  );
  if (plan.repeats < 3) {
    console.log(
      "Accept/reject decisions need --repeats 3 so cost and flip rates cover N generations.",
    );
  }
} else {
  if (!Number.isFinite(args.maxUsd) || (args.maxUsd ?? 0) <= 0) {
    throw new Error("A positive --max-usd limit is required for a live run.");
  }
  if (plan.maximumCostUsd > args.maxUsd!) {
    throw new Error(
      `The maximum estimate $${plan.maximumCostUsd.toFixed(3)} exceeds the approved --max-usd $${args.maxUsd!.toFixed(3)}.`,
    );
  }
  const key = providerKeyFromEnvironment(plan.profile.provider, process.env);
  const report = await runEnhancementEvaluation({
    profileId: args.profileId,
    apiKey: key.value,
    confirmedMaximumUsd: args.maxUsd!,
    selection,
    outputDirectory: join(process.cwd(), "evals", "runs"),
    onProgress: (progress) => {
      process.stdout.write(
        `[${progress.completed}/${progress.total}] ${progress.caseId} · ${progress.state}\n`,
      );
    },
  });
  console.log(
    JSON.stringify(
      {
        status: report.status,
        cases: report.caseCount,
        repeats: report.repeats,
        generations: report.generationCount,
        completed: report.completedCount,
        failed: report.failedCount,
        actualCostUsd: report.actualCostUsd,
        report: report.path,
      },
      null,
      2,
    ),
  );
  if (
    report.status === "cancelled" ||
    report.status === "incomplete" ||
    report.failedCount > 0
  ) {
    process.exitCode = 1;
  }
}

function parseArguments(values: string[]): Arguments {
  let profileId: SelectableEnhancementProfileId = "openai-standard-v1";
  let split: EvaluationSplit | undefined;
  const caseIds: string[] = [];
  let limit: number | undefined;
  let repeats: number | undefined;
  let maxUsd: number | undefined;
  let confirmSpend = false;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    const next = values[index + 1];
    if (value === "--") {
      continue;
    }
    if (value === "--profile" && next) {
      if (
        ![
          "openai-standard-v1",
          "openai-deep-v1",
          "anthropic-sonnet-5-v1",
          "google-gemini-3.5-flash-v1",
        ].includes(next)
      ) {
        throw new Error(`Unsupported enhancement profile: ${next}.`);
      }
      profileId = next as SelectableEnhancementProfileId;
      index += 1;
    } else if (value === "--split" && next) {
      if (!["development", "validation", "protected"].includes(next)) {
        throw new Error(`Unsupported evaluation split: ${next}.`);
      }
      split = next as EvaluationSplit;
      index += 1;
    } else if (value === "--case" && next) {
      caseIds.push(next);
      index += 1;
    } else if (value === "--limit" && next) {
      limit = positiveInteger(next, "--limit");
      index += 1;
    } else if (value === "--repeats" && next) {
      repeats = normalizeEvaluationRepeats(positiveInteger(next, "--repeats"));
      index += 1;
    } else if (value === "--max-usd" && next) {
      maxUsd = Number(next);
      index += 1;
    } else if (value === "--confirm-spend") {
      confirmSpend = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}.`);
    }
  }

  return {
    profileId,
    ...(split ? { split } : {}),
    ...(caseIds.length > 0 ? { caseIds } : {}),
    ...(limit ? { limit } : {}),
    ...(repeats ? { repeats } : {}),
    ...(maxUsd !== undefined ? { maxUsd } : {}),
    confirmSpend,
  };
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function countBy<T>(
  values: T[],
  key: (value: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const item = key(value);
    result[item] = (result[item] ?? 0) + 1;
  }
  return result;
}
