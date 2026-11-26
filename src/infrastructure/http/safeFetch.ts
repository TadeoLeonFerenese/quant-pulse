import type { FetchResult, HttpFetcherPort, SafeParseSchema } from '@/domain/integrity/ports';

export const DEFAULT_FETCH_TIMEOUT_MS = 3_000;

function isStrictHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function extractHttpErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string' &&
      body.error.message.trim().length > 0
    ) {
      return body.error.message;
    }
  } catch {
    // Non-JSON error body; fall back to HTTP status code
  }
  return `HTTP ${String(response.status)}`;
}

export function createSafeFetcher(fetchImpl: typeof fetch = fetch): HttpFetcherPort {
  return {
    async fetchJson<T>(
      url: string,
      schema: SafeParseSchema<T>,
      timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    ): Promise<FetchResult<T>> {
      if (!isStrictHttpsUrl(url)) {
        return {
          ok: false,
          code: 'INSECURE_URL',
          message: 'Only strict HTTPS URLs are allowed',
        };
      }

      const controller = new AbortController();
      const timerId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await extractHttpErrorMessage(response);
          return { ok: false, code: 'HTTP_ERROR', message };
        }

        let rawJson: unknown;
        try {
          rawJson = await response.json();
        } catch {
          return {
            ok: false,
            code: 'INVALID_PAYLOAD',
            message: 'Response body is not valid JSON',
          };
        }

        const parsed = schema.safeParse(rawJson);
        if (!parsed.success) {
          return {
            ok: false,
            code: 'INVALID_PAYLOAD',
            message: parsed.error.message,
          };
        }

        return { ok: true, data: parsed.data };
      } catch (error: unknown) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
          return {
            ok: false,
            code: 'TIMEOUT',
            message: `Request timed out after ${String(timeoutMs)}ms`,
          };
        }
        return {
          ok: false,
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error',
        };
      } finally {
        clearTimeout(timerId);
      }
    },
  };
}
