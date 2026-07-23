import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_QUERY_CHARACTERS = 200;
const MAX_RECORDS_READ = 500;

export interface MissedSearchRecord {
  at: string;
  query: string;
}

export interface MissedSearchTally {
  query: string;
  count: number;
  lastAt: string;
}

export function missedSearchLogPath(promptDirectory: string): string {
  return join(promptDirectory, ".feedback", "missed-searches.jsonl");
}

export async function recordMissedSearch(
  promptDirectory: string,
  query: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  const trimmed = query.trim().slice(0, MAX_QUERY_CHARACTERS);
  if (!trimmed) return;
  await mkdir(join(promptDirectory, ".feedback"), { recursive: true });
  const record: MissedSearchRecord = {
    at: now().toISOString(),
    query: trimmed,
  };
  await appendFile(
    missedSearchLogPath(promptDirectory),
    `${JSON.stringify(record)}\n`,
    "utf8",
  );
}

export async function listMissedSearches(
  promptDirectory: string,
): Promise<MissedSearchRecord[]> {
  let raw: string;
  try {
    raw = await readFile(missedSearchLogPath(promptDirectory), "utf8");
  } catch {
    return [];
  }
  const records: MissedSearchRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as MissedSearchRecord).at === "string" &&
        typeof (parsed as MissedSearchRecord).query === "string"
      ) {
        records.push({
          at: (parsed as MissedSearchRecord).at,
          query: (parsed as MissedSearchRecord).query,
        });
      }
    } catch {
      // A malformed line never blocks the readable remainder of the log.
    }
  }
  return records.slice(-MAX_RECORDS_READ);
}

export function tallyMissedSearches(
  records: readonly MissedSearchRecord[],
): MissedSearchTally[] {
  const byQuery = new Map<string, MissedSearchTally>();
  for (const record of records) {
    const key = record.query.toLocaleLowerCase();
    const entry = byQuery.get(key);
    if (entry) {
      entry.count += 1;
      if (record.at > entry.lastAt) entry.lastAt = record.at;
    } else {
      byQuery.set(key, {
        query: record.query,
        count: 1,
        lastAt: record.at,
      });
    }
  }
  return [...byQuery.values()].sort(
    (left, right) =>
      right.count - left.count || right.lastAt.localeCompare(left.lastAt),
  );
}
