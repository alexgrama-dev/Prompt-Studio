#!/usr/bin/env node

import { spawn } from "node:child_process";
import { executePromptStudioCli } from "../src/core/cli.ts";

const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());

const execution = await executePromptStudioCli(process.argv.slice(2), {
  env: process.env,
  signal: controller.signal,
  readStdin,
  writeClipboard,
});

if (execution.stdout) process.stdout.write(execution.stdout);
if (execution.stderr) process.stderr.write(execution.stderr);
process.exitCode = execution.exitCode;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeClipboard(value: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("/usr/bin/pbcopy", [], {
      stdio: ["pipe", "ignore", "pipe"],
    });
    const errors: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `pbcopy exited with code ${String(code)}${errors.length > 0 ? `: ${Buffer.concat(errors).toString("utf8").trim().slice(0, 300)}` : ""}`,
        ),
      );
    });
    child.stdin.end(value);
  });
}
