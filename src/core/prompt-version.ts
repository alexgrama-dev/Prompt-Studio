import { createHash } from "node:crypto";
import { promptVersionSnapshot } from "./feedback-store.ts";
import type { PromptRecord } from "./prompt-store.ts";

const VERSION_TOKEN = /^v1:[a-f0-9]{64}$/;

export function promptVersionToken(record: PromptRecord): string {
  const digest = promptVersionSnapshot(record).sourceDigest;
  return `v1:${createHash("sha256")
    .update(`${record.id}\0${record.updatedAt}\0${digest}`)
    .digest("hex")}`;
}

export function resolvePromptVersion(
  records: readonly PromptRecord[],
  token: string,
): PromptRecord | undefined {
  if (!VERSION_TOKEN.test(token)) return undefined;
  return records.find((record) => promptVersionToken(record) === token);
}

export function validPromptVersionToken(value: unknown): value is string {
  return typeof value === "string" && VERSION_TOKEN.test(value);
}
