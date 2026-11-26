import type { TrustedSnapshot } from './types';

export type SafeParseOutcome<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly message: string } };

export interface SafeParseSchema<T> {
  safeParse(input: unknown): SafeParseOutcome<T>;
}

export type FetchErrorCode =
  'INSECURE_URL' | 'TIMEOUT' | 'NETWORK_ERROR' | 'HTTP_ERROR' | 'INVALID_PAYLOAD';

export type FetchResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: FetchErrorCode; readonly message: string };

export interface HttpFetcherPort {
  fetchJson<T>(
    url: string,
    schema: SafeParseSchema<T>,
    timeoutMs?: number,
  ): Promise<FetchResult<T>>;
}

export interface SnapshotCachePort {
  get<T>(sourceId: string): Promise<TrustedSnapshot<T> | null>;
  set<T>(snapshot: TrustedSnapshot<T>): Promise<void>;
}
