import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  defaultEnhancementCompilerPolicy,
  validateEnhancementCompilerPolicy,
  type EnhancementCompilerPolicy,
} from "./enhancement.ts";

export interface CompilerActivationEvent {
  id: string;
  action: "activate" | "rollback";
  changedAt: string;
  fromDigest: string;
  toDigest: string;
  proposalId?: string;
  candidateId?: string;
}

export interface CompilerState {
  schemaVersion: 1;
  revision: number;
  updatedAt: string;
  currentDigest: string;
  policies: EnhancementCompilerPolicy[];
  events: CompilerActivationEvent[];
}

export function defaultCompilerStatePath(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Prompt Studio",
    "Optimization",
    "compiler-state.json",
  );
}

export async function loadCompilerState(
  path = defaultCompilerStatePath(),
): Promise<CompilerState> {
  try {
    return parseCompilerState(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissingFile(error)) return initialCompilerState();
    throw error;
  }
}

export async function loadActiveCompilerPolicy(
  path = defaultCompilerStatePath(),
): Promise<EnhancementCompilerPolicy> {
  const state = await loadCompilerState(path);
  const policy = state.policies.find(
    (candidate) => candidate.digest === state.currentDigest,
  );
  if (!policy) {
    throw new Error("Compiler state does not contain its current policy.");
  }
  return policy;
}

export async function activateCompilerPolicy(
  path: string,
  policy: EnhancementCompilerPolicy,
  options: {
    expectedCurrentDigest: string;
    confirmed: boolean;
    proposalId: string;
    candidateId: string;
    now?: Date;
  },
): Promise<CompilerState> {
  if (!options.confirmed) {
    throw new Error("Compiler activation requires explicit confirmation.");
  }
  const state = await loadCompilerState(path);
  if (state.currentDigest !== options.expectedCurrentDigest) {
    throw new Error(
      "The active compiler changed after review. Reload before approval.",
    );
  }
  const nextPolicy = validateEnhancementCompilerPolicy(policy);
  if (nextPolicy.digest === state.currentDigest) {
    throw new Error("The selected compiler policy is already active.");
  }
  const changedAt = (options.now ?? new Date()).toISOString();
  const event: CompilerActivationEvent = {
    id: randomUUID(),
    action: "activate",
    changedAt,
    fromDigest: state.currentDigest,
    toDigest: nextPolicy.digest,
    proposalId: requiredIdentifier(options.proposalId, "proposalId"),
    candidateId: requiredIdentifier(options.candidateId, "candidateId"),
  };
  const policies = state.policies.some(
    (candidate) => candidate.digest === nextPolicy.digest,
  )
    ? state.policies
    : [...state.policies, nextPolicy];
  const next = validateCompilerState({
    schemaVersion: 1,
    revision: state.revision + 1,
    updatedAt: changedAt,
    currentDigest: nextPolicy.digest,
    policies,
    events: [...state.events, event],
  });
  await atomicWrite(path, serializeCompilerState(next));
  return next;
}

export async function rollbackCompilerPolicy(
  path: string,
  targetDigest: string,
  options: {
    expectedCurrentDigest: string;
    confirmed: boolean;
    now?: Date;
  },
): Promise<CompilerState> {
  if (!options.confirmed) {
    throw new Error("Compiler rollback requires explicit confirmation.");
  }
  const state = await loadCompilerState(path);
  if (state.currentDigest !== options.expectedCurrentDigest) {
    throw new Error(
      "The active compiler changed after review. Reload before rollback.",
    );
  }
  const target = state.policies.find(
    (candidate) => candidate.digest === targetDigest,
  );
  if (!target) {
    throw new Error("The requested rollback compiler version was not found.");
  }
  if (target.digest === state.currentDigest) {
    throw new Error("The requested compiler version is already active.");
  }
  const changedAt = (options.now ?? new Date()).toISOString();
  const next = validateCompilerState({
    ...state,
    revision: state.revision + 1,
    updatedAt: changedAt,
    currentDigest: target.digest,
    events: [
      ...state.events,
      {
        id: randomUUID(),
        action: "rollback",
        changedAt,
        fromDigest: state.currentDigest,
        toDigest: target.digest,
        ...(target.proposalId ? { proposalId: target.proposalId } : {}),
        ...(target.candidateId ? { candidateId: target.candidateId } : {}),
      },
    ],
  });
  await atomicWrite(path, serializeCompilerState(next));
  return next;
}

export function parseCompilerState(source: string): CompilerState {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("Compiler state is not valid JSON.");
  }
  return validateCompilerState(value);
}

export function serializeCompilerState(state: CompilerState): string {
  return `${JSON.stringify(validateCompilerState(state), null, 2)}\n`;
}

function initialCompilerState(): CompilerState {
  const policy = defaultEnhancementCompilerPolicy();
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: "1970-01-01T00:00:00.000Z",
    currentDigest: policy.digest,
    policies: [policy],
    events: [],
  };
}

function validateCompilerState(value: unknown): CompilerState {
  const object = requiredObject(value, "compiler state");
  assertExactKeys(object, "compiler state", [
    "schemaVersion",
    "revision",
    "updatedAt",
    "currentDigest",
    "policies",
    "events",
  ]);
  if (object.schemaVersion !== 1) {
    throw new Error("Unsupported compiler state schema version.");
  }
  const policies = requiredArray(object.policies, "policies").map((policy) =>
    validateEnhancementCompilerPolicy(
      requiredObject(
        policy,
        "compiler policy",
      ) as unknown as EnhancementCompilerPolicy,
    ),
  );
  if (policies.length === 0 || policies.length > 100) {
    throw new Error("Compiler state must contain between 1 and 100 policies.");
  }
  const policyDigests = new Set(policies.map((policy) => policy.digest));
  if (policyDigests.size !== policies.length) {
    throw new Error("Compiler state contains duplicate policy digests.");
  }
  const currentDigest = digest(object.currentDigest, "currentDigest");
  if (!policyDigests.has(currentDigest)) {
    throw new Error("Compiler state currentDigest does not name a policy.");
  }
  const events = requiredArray(object.events, "events").map(validateEvent);
  if (events.length > 1_000) {
    throw new Error("Compiler state contains too many activation events.");
  }
  return {
    schemaVersion: 1,
    revision: nonNegativeInteger(object.revision, "revision"),
    updatedAt: timestamp(object.updatedAt, "updatedAt"),
    currentDigest,
    policies,
    events,
  };
}

function validateEvent(value: unknown): CompilerActivationEvent {
  const object = requiredObject(value, "compiler activation event");
  assertExactKeys(object, "compiler activation event", [
    "id",
    "action",
    "changedAt",
    "fromDigest",
    "toDigest",
    "proposalId",
    "candidateId",
  ]);
  if (object.action !== "activate" && object.action !== "rollback") {
    throw new Error("Compiler activation event has an unsupported action.");
  }
  return {
    id: requiredIdentifier(object.id, "event.id"),
    action: object.action,
    changedAt: timestamp(object.changedAt, "event.changedAt"),
    fromDigest: digest(object.fromDigest, "event.fromDigest"),
    toDigest: digest(object.toDigest, "event.toDigest"),
    ...(object.proposalId !== undefined
      ? { proposalId: requiredIdentifier(object.proposalId, "proposalId") }
      : {}),
    ...(object.candidateId !== undefined
      ? { candidateId: requiredIdentifier(object.candidateId, "candidateId") }
      : {}),
  };
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  return value;
}

function requiredIdentifier(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 160 ||
    !/^[a-zA-Z0-9._:/+-]+$/.test(value)
  ) {
    throw new Error(`${name} must be a bounded identifier.`);
  }
  return value;
}

function timestamp(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${name} must be an ISO 8601 UTC timestamp.`);
  }
  return value;
}

function digest(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value as number;
}

function assertExactKeys(
  value: Record<string, unknown>,
  name: string,
  keys: string[],
): void {
  const allowed = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${name} contains unsupported fields: ${unexpected.join(", ")}.`,
    );
  }
}

async function atomicWrite(path: string, source: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    error !== null &&
    error !== undefined &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
