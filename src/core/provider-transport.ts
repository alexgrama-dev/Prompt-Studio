export interface ProviderTransportOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  endpoint?: string;
  retryLimit?: number;
}

export async function fetchProviderWithRetry(
  provider: string,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
  options: ProviderTransportOptions,
): Promise<Response> {
  if (options.endpoint && !options.fetcher) {
    throw new Error(
      `${provider} endpoint overrides are allowed only with an injected test transport.`,
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const retryLimit = Math.max(0, Math.min(options.retryLimit ?? 2, 3));
  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new Error(`${provider} request timed out.`)),
      timeoutMs,
    );
    try {
      const response = await fetcher(options.endpoint ?? endpoint, {
        ...init,
        signal: controller.signal,
      });
      if (!isRetryableStatus(response.status) || attempt === retryLimit) {
        return response;
      }
      const retryAfter = retryAfterMilliseconds(response);
      await response.body?.cancel();
      await abortableDelay(retryAfter ?? 500 * 3 ** attempt, options.signal);
    } catch (error) {
      if (options.signal?.aborted) {
        throw new Error("Enhancement cancelled. No prompt was saved.");
      }
      if (attempt === retryLimit || !isTransientFetchError(error)) throw error;
      await abortableDelay(500 * 3 ** attempt, options.signal);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  throw new Error(`${provider} request failed after retrying.`);
}

export async function providerResponseErrorCode(
  response: Response,
): Promise<string> {
  try {
    const raw: unknown = await response.json();
    if (!isObject(raw) || !isObject(raw.error)) return "";
    const value = raw.error.code ?? raw.error.status ?? raw.error.type;
    const code = typeof value === "string" ? value.slice(0, 100) : "";
    // The provider message names the rejected field; without it a 400 is undiagnosable.
    const message =
      typeof raw.error.message === "string"
        ? raw.error.message.slice(0, 300)
        : "";
    if (!message) return code;
    return code ? `${code}: ${message}` : message;
  } catch {
    return "";
  }
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const raw = response.headers.get("Retry-After");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, Math.min(timestamp - Date.now(), 30_000));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function isTransientFetchError(error: unknown): boolean {
  if (isObject(error) && error.name === "AbortError") return false;
  return error instanceof TypeError;
}

async function abortableDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new Error("Enhancement cancelled. No prompt was saved.");
  }
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(new Error("Enhancement cancelled. No prompt was saved."));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
