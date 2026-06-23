import {
  AuthSessionExpiredError,
  getAuthSessionAbortSignal,
  isAuthSessionExpired,
  isAuthSessionExpiredError
} from '@/auth/session';

interface SmartQueryCacheEntry<TData> {
  data: TData;
  signature: string;
  updatedAt: number;
}

export interface SmartQueryResult<TData> {
  data: TData;
  changed: boolean;
  fromCache: boolean;
  skipped: boolean;
  updatedAt: number;
}

export interface SmartQueryFetchContext<TData = unknown> {
  key: string;
  signal: AbortSignal;
  startedAt: number;
  cached?: TData;
}

export type SmartQueryFetcher<TData> = (context: SmartQueryFetchContext<TData>) => Promise<TData>;

interface RefreshSmartQueryOptions<TData> {
  key: string;
  fetcher: SmartQueryFetcher<TData>;
  force?: boolean;
  dedupeMs?: number;
  staleMs?: number;
  cancelPrevious?: boolean;
  trackActivity?: boolean;
}

interface RefreshSmartQueryResourceOptions<TData> extends RefreshSmartQueryOptions<TData> {
  apply: (data: TData) => void;
  background?: boolean;
  applyCached?: boolean;
  cancelPreviousMatching?: SmartQueryMatcher;
  isCurrent?: () => boolean;
  setLoading?: (loading: boolean) => void;
}

type SmartQueryMatcher = string | RegExp | ((key: string) => boolean);

export interface SmartQueryActivitySnapshot {
  pendingCount: number;
  activeKeys: string[];
  lastStartedAt?: number;
  lastFinishedAt?: number;
  lastSuccessAt?: number;
  lastSuccessKey?: string;
  lastErrorAt?: number;
  lastErrorKey?: string;
  lastErrorMessage?: string;
}

type SmartQueryActivityListener = (snapshot: SmartQueryActivitySnapshot) => void;

interface InFlightSmartQuery<TData> {
  controller: AbortController;
  promise: Promise<SmartQueryResult<TData>>;
  revision: number;
  startedAt: number;
}

const queryCache = new Map<string, SmartQueryCacheEntry<unknown>>();
const inFlightQueries = new Map<string, InFlightSmartQuery<unknown>>();
const staleQueryKeys = new Map<string, number>();
const queryRevisions = new Map<string, number>();
const activityListeners = new Set<SmartQueryActivityListener>();
const activeQueryCounts = new Map<string, number>();
const smartQueryActivity: Omit<SmartQueryActivitySnapshot, 'activeKeys'> = {
  pendingCount: 0
};
const DEFAULT_FORCE_DEDUPE_MS = 1_200;
const DEFAULT_STALE_MS = 120_000;

export function createSmartQueryKey(scope: string, params?: unknown) {
  return `${scope}:${stableSerialize(params ?? {})}`;
}

export function getSmartQueryData<TData>(key: string) {
  return queryCache.get(key)?.data as TData | undefined;
}

export function setSmartQueryData<TData>(key: string, data: TData) {
  queryCache.set(key, {
    data,
    signature: stableSerialize(data),
    updatedAt: Date.now()
  });
  staleQueryKeys.delete(key);
}

export function getSmartQueryKeys(matcher?: SmartQueryMatcher) {
  const keys = Array.from(queryCache.keys());
  return matcher ? keys.filter((key) => matchesSmartQueryKey(key, matcher)) : keys;
}

export function markSmartQueriesStale(matcher: SmartQueryMatcher) {
  const matchedKeys = new Set([
    ...getSmartQueryKeys(matcher),
    ...Array.from(inFlightQueries.keys()).filter((key) => matchesSmartQueryKey(key, matcher))
  ]);
  const staleAt = Date.now();

  for (const key of matchedKeys) {
    staleQueryKeys.set(key, staleAt);
  }
  return matchedKeys.size;
}

export function invalidateSmartQueries(matcher: SmartQueryMatcher) {
  let count = 0;

  for (const key of getSmartQueryKeys(matcher)) {
    queryCache.delete(key);
    staleQueryKeys.delete(key);
    bumpSmartQueryRevision(key);
    count += 1;
  }

  for (const key of Array.from(inFlightQueries.keys())) {
    if (matchesSmartQueryKey(key, matcher)) {
      cancelInFlightSmartQuery(key);
    }
  }

  return count;
}

export function cancelSmartQueries(matcher: SmartQueryMatcher) {
  let count = 0;

  for (const key of Array.from(inFlightQueries.keys())) {
    if (matchesSmartQueryKey(key, matcher)) {
      cancelInFlightSmartQuery(key);
      count += 1;
    }
  }

  return count;
}

export function clearSmartQueryCache() {
  for (const key of Array.from(inFlightQueries.keys())) {
    cancelInFlightSmartQuery(key);
  }

  queryCache.clear();
  staleQueryKeys.clear();
}

export function getSmartQueryActivitySnapshot(): SmartQueryActivitySnapshot {
  return {
    ...smartQueryActivity,
    activeKeys: [...activeQueryCounts.keys()],
    pendingCount: getActiveSmartQueryCount()
  };
}

export function subscribeSmartQueryActivity(listener: SmartQueryActivityListener) {
  activityListeners.add(listener);
  listener(getSmartQueryActivitySnapshot());

  return () => {
    activityListeners.delete(listener);
  };
}

export async function refreshSmartQuery<TData>({
  key,
  fetcher,
  force = true,
  dedupeMs = DEFAULT_FORCE_DEDUPE_MS,
  staleMs = DEFAULT_STALE_MS,
  cancelPrevious = false,
  trackActivity = true
}: RefreshSmartQueryOptions<TData>): Promise<SmartQueryResult<TData>> {
  const cached = queryCache.get(key) as SmartQueryCacheEntry<TData> | undefined;
  const now = Date.now();
  const isStale = staleQueryKeys.has(key);

  if (isAuthSessionExpired()) {
    if (cached) {
      return {
        data: cached.data,
        changed: false,
        fromCache: true,
        skipped: true,
        updatedAt: cached.updatedAt
      };
    }

    throw new AuthSessionExpiredError();
  }

  if (cached && force && !isStale && dedupeMs > 0 && now - cached.updatedAt < dedupeMs) {
    return {
      data: cached.data,
      changed: false,
      fromCache: true,
      skipped: true,
      updatedAt: cached.updatedAt
    };
  }

  if (cached && !force && !isStale && now - cached.updatedAt < staleMs) {
    return {
      data: cached.data,
      changed: false,
      fromCache: true,
      skipped: true,
      updatedAt: cached.updatedAt
    };
  }

  const pending = inFlightQueries.get(key) as InFlightSmartQuery<TData> | undefined;

  if (pending) {
    if (cancelPrevious) {
      cancelInFlightSmartQuery(key);
    } else {
      const staleMarkedAt = staleQueryKeys.get(key);

      if (!staleMarkedAt || staleMarkedAt <= pending.startedAt) {
        return pending.promise;
      }

      return pending.promise.then(() =>
        refreshSmartQuery({
          key,
          fetcher,
          force,
          dedupeMs: 0,
          staleMs,
          cancelPrevious,
          trackActivity
        })
      );
    }
  }

  const startedAt = Date.now();
  const revision = getSmartQueryRevision(key);
  const controller = new AbortController();
  const cleanupAuthAbort = bindAuthAbortSignal(controller);
  if (trackActivity) {
    markSmartQueryStarted(key, startedAt);
  }
  const promise = fetcher({
    key,
    signal: controller.signal,
    startedAt,
    cached: cached?.data
  })
    .then((data) => {
      if (controller.signal.aborted || getSmartQueryRevision(key) !== revision) {
        return {
          data,
          changed: false,
          fromCache: Boolean(cached),
          skipped: true,
          updatedAt: cached?.updatedAt ?? startedAt
        };
      }

      const signature = stableSerialize(data);
      const previous = queryCache.get(key) as SmartQueryCacheEntry<TData> | undefined;
      const updatedAt = Date.now();
      const staleMarkedAt = staleQueryKeys.get(key);
      const shouldRemainStale = Boolean(staleMarkedAt && staleMarkedAt > startedAt);

      if (previous?.signature === signature) {
        queryCache.set(key, {
          ...previous,
          updatedAt
        });

        if (!shouldRemainStale) {
          staleQueryKeys.delete(key);
        }

        if (trackActivity) {
          markSmartQuerySucceeded(key, updatedAt);
        }

        return {
          data: previous.data,
          changed: false,
          fromCache: true,
          skipped: false,
          updatedAt
        };
      }

      queryCache.set(key, {
        data,
        signature,
        updatedAt
      });

      if (!shouldRemainStale) {
        staleQueryKeys.delete(key);
      }

      if (trackActivity) {
        markSmartQuerySucceeded(key, updatedAt);
      }

      return {
        data,
        changed: true,
        fromCache: Boolean(previous),
        skipped: false,
        updatedAt
      };
    })
    .catch((error: unknown) => {
      if (trackActivity && !isSmartQueryCanceledError(error) && !isAuthSessionExpiredError(error)) {
        markSmartQueryFailed(key, error);
      }

      throw error;
    })
    .finally(() => {
      if (inFlightQueries.get(key)?.startedAt === startedAt) {
        inFlightQueries.delete(key);
      }
      cleanupAuthAbort();
      if (trackActivity) {
        markSmartQueryFinished(key);
      }
    });

  inFlightQueries.set(key, {
    controller,
    promise: promise as Promise<SmartQueryResult<unknown>>,
    revision,
    startedAt
  });

  return promise;
}

export async function refreshSmartQueryResource<TData>({
  apply,
  background = false,
  applyCached = true,
  cancelPreviousMatching,
  isCurrent,
  setLoading,
  ...queryOptions
}: RefreshSmartQueryResourceOptions<TData>) {
  const cached = applyCached ? getSmartQueryData<TData>(queryOptions.key) : undefined;
  const isStillCurrent = () => isCurrent?.() ?? true;

  if (cached !== undefined && isStillCurrent()) {
    apply(cached);
  }

  setLoading?.(cached === undefined && !background);

  try {
    if (cancelPreviousMatching) {
      cancelSmartQueries(cancelPreviousMatching);
    }

    const result = await refreshSmartQuery(queryOptions);

    if (isStillCurrent() && (result.changed || cached === undefined)) {
      apply(result.data);
    }

    return result;
  } catch (error) {
    if (isSmartQueryCanceledError(error) || isAuthSessionExpiredError(error)) {
      return undefined;
    }

    throw error;
  } finally {
    if (isStillCurrent()) {
      setLoading?.(false);
    }
  }
}

export function isSmartQueryCanceledError(error: unknown) {
  if (isAuthSessionExpiredError(error)) {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };

  return (
    candidate.code === 'ERR_CANCELED' ||
    candidate.name === 'AbortError' ||
    candidate.name === 'CanceledError' ||
    candidate.message === 'canceled'
  );
}

function bindAuthAbortSignal(controller: AbortController) {
  const authSignal = getAuthSessionAbortSignal();

  if (authSignal.aborted) {
    controller.abort(authSignal.reason);
    return () => undefined;
  }

  const abort = () => {
    controller.abort(authSignal.reason);
  };

  authSignal.addEventListener('abort', abort, { once: true });

  return () => authSignal.removeEventListener('abort', abort);
}

function matchesSmartQueryKey(key: string, matcher: SmartQueryMatcher) {
  if (typeof matcher === 'string') {
    return key === matcher || key.startsWith(`${matcher}:`);
  }

  if (matcher instanceof RegExp) {
    return matcher.test(key);
  }

  return matcher(key);
}

function markSmartQueryStarted(key: string, startedAt: number) {
  activeQueryCounts.set(key, (activeQueryCounts.get(key) ?? 0) + 1);
  smartQueryActivity.pendingCount = getActiveSmartQueryCount();
  smartQueryActivity.lastStartedAt = startedAt;
  emitSmartQueryActivity();
}

function markSmartQuerySucceeded(key: string, updatedAt: number) {
  smartQueryActivity.lastSuccessAt = updatedAt;
  smartQueryActivity.lastSuccessKey = key;
  smartQueryActivity.lastErrorAt = undefined;
  smartQueryActivity.lastErrorKey = undefined;
  smartQueryActivity.lastErrorMessage = undefined;
  emitSmartQueryActivity();
}

function markSmartQueryFailed(key: string, error: unknown) {
  smartQueryActivity.lastErrorAt = Date.now();
  smartQueryActivity.lastErrorKey = key;
  smartQueryActivity.lastErrorMessage =
    error instanceof Error ? error.message : '数据更新失败，请稍后重试';
  emitSmartQueryActivity();
}

function markSmartQueryFinished(key: string) {
  const nextCount = (activeQueryCounts.get(key) ?? 0) - 1;

  if (nextCount > 0) {
    activeQueryCounts.set(key, nextCount);
  } else {
    activeQueryCounts.delete(key);
  }

  smartQueryActivity.pendingCount = getActiveSmartQueryCount();
  smartQueryActivity.lastFinishedAt = Date.now();
  emitSmartQueryActivity();
}

function getActiveSmartQueryCount() {
  return Array.from(activeQueryCounts.values()).reduce((sum, count) => sum + count, 0);
}

function getSmartQueryRevision(key: string) {
  return queryRevisions.get(key) ?? 0;
}

function bumpSmartQueryRevision(key: string) {
  queryRevisions.set(key, getSmartQueryRevision(key) + 1);
}

function cancelInFlightSmartQuery(key: string) {
  const pending = inFlightQueries.get(key);

  if (!pending) {
    return;
  }

  bumpSmartQueryRevision(key);
  pending.controller.abort();
  inFlightQueries.delete(key);
}

function emitSmartQueryActivity() {
  if (!activityListeners.size) {
    return;
  }

  const snapshot = getSmartQueryActivitySnapshot();

  for (const listener of activityListeners) {
    listener(snapshot);
  }
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(normalizeForSignature(value));
}

function normalizeForSignature(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeForSignature);
  }

  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeForSignature((value as Record<string, unknown>)[key]);
  }

  return normalized;
}
