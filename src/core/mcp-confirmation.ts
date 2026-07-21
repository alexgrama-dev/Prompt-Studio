import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const MCP_MUTATION_ACTIONS = [
  "create",
  "update",
  "archive",
  "enhance",
] as const;

export type McpMutationAction = (typeof MCP_MUTATION_ACTIONS)[number];

interface ConfirmationRecord {
  schemaVersion: 1;
  action: McpMutationAction;
  requestDigest: string;
  createdAt: string;
  expiresAt: string;
}

export interface IssuedMcpConfirmation {
  token: string;
  action: McpMutationAction;
  requestDigest: string;
  createdAt: string;
  expiresAt: string;
}

export function defaultMcpConfirmationDirectory(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Prompt Studio",
    "mcp-confirmations",
  );
}

export function mcpMutationRequestDigest(
  action: McpMutationAction,
  payload: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(`${action}\n${canonicalJson(payload)}`)
    .digest("hex");
}

export async function issueMcpConfirmation(
  directory: string,
  action: McpMutationAction,
  requestDigest: string,
  ttlSeconds = 300,
  now = new Date(),
): Promise<IssuedMcpConfirmation> {
  assertDigest(requestDigest);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) {
    throw new Error("Confirmation lifetime must be 30-900 seconds.");
  }
  const token = randomBytes(24).toString("base64url");
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000).toISOString();
  const record: ConfirmationRecord = {
    schemaVersion: 1,
    action,
    requestDigest,
    createdAt,
    expiresAt,
  };
  const path = tokenPath(directory, token);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { token, action, requestDigest, createdAt, expiresAt };
}

export async function consumeMcpConfirmation(
  directory: string,
  token: string,
  action: McpMutationAction,
  requestDigest: string,
  now = new Date(),
): Promise<void> {
  assertDigest(requestDigest);
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    throw new Error("Confirmation token is invalid or already used.");
  }
  const path = tokenPath(directory, token);
  const claimed = `${path}.${randomUUID()}.consuming`;
  try {
    await rename(path, claimed);
  } catch {
    throw new Error("Confirmation token is invalid or already used.");
  }
  try {
    const record = parseConfirmation(await readFile(claimed, "utf8"));
    if (
      record.action !== action ||
      !safeEqual(record.requestDigest, requestDigest)
    ) {
      throw new Error(
        "Confirmation token does not match this exact mutation request.",
      );
    }
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      throw new Error("Confirmation token has expired.");
    }
  } finally {
    await rm(claimed, { force: true });
  }
}

function tokenPath(directory: string, token: string): string {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return join(directory, `${tokenHash}.json`);
}

function parseConfirmation(value: string): ConfirmationRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Confirmation token record is invalid.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Confirmation token record is invalid.");
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    !MCP_MUTATION_ACTIONS.includes(record.action as McpMutationAction) ||
    typeof record.requestDigest !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    !Number.isFinite(Date.parse(record.expiresAt))
  ) {
    throw new Error("Confirmation token record is invalid.");
  }
  assertDigest(record.requestDigest);
  return record as unknown as ConfirmationRecord;
}

function assertDigest(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(
      "Confirmation request digest must be 64 lowercase hex characters.",
    );
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("Mutation payload contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Mutation payload contains a non-JSON value.");
}
