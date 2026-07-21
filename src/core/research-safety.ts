import type { EnhancementInputSource } from "./enhancement.ts";
import { containsLikelySecret } from "./secrets.ts";

export function safeResearchSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname
      .toLowerCase()
      .replace(/^\[/, "")
      .replace(/\]$/, "");
    const decodedPathAndQuery = decodeURIComponent(
      `${url.pathname}${url.search}`,
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      isPrivateHost(host) ||
      hasCredentialQueryParameter(url) ||
      containsLikelySecret(decodedPathAndQuery)
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeRetrievedText(
  value: unknown,
  maximumBytes: number,
): string | undefined {
  if (
    typeof value !== "string" ||
    !Number.isInteger(maximumBytes) ||
    maximumBytes < 1
  ) {
    return undefined;
  }
  const withoutControls = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code !== 127)
        ? character
        : " ";
    })
    .join("");
  const sanitized = withoutControls.replace(/\r\n?/g, "\n").trim();
  if (!sanitized || containsLikelySecret(sanitized)) return undefined;
  return truncateUtf8(sanitized, maximumBytes);
}

export function truncateUtf8(value: string, maximumBytes: number): string {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
  if (encoded.length <= maximumBytes) return value;
  return new TextDecoder().decode(encoded.slice(0, maximumBytes)).trimEnd();
}

export function mergeReviewedSources(
  existing: EnhancementInputSource[] | undefined,
  incoming: EnhancementInputSource[],
): EnhancementInputSource[] {
  const encoder = new TextEncoder();
  const merged: EnhancementInputSource[] = [];
  const seenUrls = new Set<string>();
  let totalBytes = 0;

  for (const source of [...(existing ?? []), ...incoming]) {
    const sourceBytes = encoder.encode(source.content).length;
    if (
      seenUrls.has(source.url) ||
      sourceBytes > 12_000 ||
      totalBytes + sourceBytes > 30_000
    ) {
      continue;
    }
    merged.push(source);
    seenUrls.add(source.url);
    totalBytes += sourceBytes;
    if (merged.length === 30) break;
  }

  return merged;
}

function hasCredentialQueryParameter(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (
      /(?:^|[_-])(?:api[_-]?key|access[_-]?token|auth|authorization|credential|password|secret|signature|sig)(?:$|[_-])/i.test(
        key,
      )
    ) {
      return true;
    }
  }
  return false;
}

function isPrivateHost(host: string): boolean {
  return (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::" ||
    host === "::1" ||
    /^fe[89ab][0-9a-f]*:/i.test(host) ||
    /^f[cd][0-9a-f]*:/i.test(host)
  );
}
