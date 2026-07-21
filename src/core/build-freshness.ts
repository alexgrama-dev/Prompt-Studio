import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ponytail: mtime comparison, not content hashing; touch or rsync can fool
// it, and the upgrade path is embedding a source digest at build time.
export function buildFreshnessWarning(
  bundlePath: string | undefined,
  rebuildCommand: string,
): string | undefined {
  if (!bundlePath) return undefined;
  try {
    const bundle = statSync(bundlePath);
    const repoRoot = findRepoRoot(resolve(bundlePath));
    if (!repoRoot) return undefined;
    const newest = newestMtime(join(repoRoot, "src", "core"));
    if (newest !== undefined && newest > bundle.mtimeMs) {
      const minutes = Math.max(
        1,
        Math.round((newest - bundle.mtimeMs) / 60_000),
      );
      return `This build is about ${minutes} minute${minutes === 1 ? "" : "s"} older than the newest shared-core change. Run ${rebuildCommand}.`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function findRepoRoot(bundlePath: string): string | undefined {
  let current = dirname(bundlePath);
  for (let depth = 0; depth < 4; depth += 1) {
    try {
      statSync(join(current, "src", "core"));
      return current;
    } catch {
      current = dirname(current);
    }
  }
  return undefined;
}

function newestMtime(directory: string): number | undefined {
  let newest: number | undefined;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const stamp = statSync(join(directory, entry.name)).mtimeMs;
    if (newest === undefined || stamp > newest) newest = stamp;
  }
  return newest;
}
