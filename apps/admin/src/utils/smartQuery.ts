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

interface RefreshSmartQueryOptions<TData> {
  key: string;
  fetcher: () => Promise<TData>;
  force?: boolean;
  dedupeMs?: number;
  staleMs?: number;
}

interface RefreshSmartQueryResourceOptions<TData> extends RefreshSmartQueryOptions<TData> {
  apply: (data: TData) => void;
  background?: boolean;
  applyCached?: boolean;
  isCurrent?: () => boolean;
  setLoading?: (loading: boolean) => void;
}

type SmartQueryMatcher = string | RegExp | ((key: string) => boolean);
interface InFlightSmartQuery<TData> {
  promise: Promise<SmartQueryResult<TData>>;
  startedAt: number;
}

const queryCache = new Map<string, SmartQueryCacheEntry<unknown>>();
const inFlightQueries = new Map<string, InFlightSmartQuery<unknown>>();
const staleQueryKeys = new Map<string, number>();
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
    count += 1;
  }

  for (const key of Array.from(inFlightQueries.keys())) {
    if (matchesSmartQueryKey(key, matcher)) {
      inFlightQueries.delete(key);
    }
  }

  return count;
}

export function clearSmartQueryCache() {
  queryCache.clear();
  inFlightQueries.clear();
  staleQueryKeys.clear();
}

export async function refreshSmartQuery<TData>({
  key,
  fetcher,
  force = true,
  dedupeMs = DEFAULT_FORCE_DEDUPE_MS,
  staleMs = DEFAULT_STALE_MS
}: RefreshSmartQueryOptions<TData>): Promise<SmartQueryResult<TData>> {
  const cached = queryCache.get(key) as SmartQueryCacheEntry<TData> | undefined;
  const now = Date.now();
  const isStale = staleQueryKeys.has(key);

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
        staleMs
      })
    );
  }

  const startedAt = Date.now();
  const promise = fetcher()
    .then((data) => {
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

      return {
        data,
        changed: true,
        fromCache: Boolean(previous),
        skipped: false,
        updatedAt
      };
    })
    .finally(() => {
      inFlightQueries.delete(key);
    });

  inFlightQueries.set(key, {
    promise: promise as Promise<SmartQueryResult<unknown>>,
    startedAt
  });

  return promise;
}

export async function refreshSmartQueryResource<TData>({
  apply,
  background = false,
  applyCached = true,
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
    const result = await refreshSmartQuery(queryOptions);

    if (isStillCurrent() && (result.changed || cached === undefined)) {
      apply(result.data);
    }

    return result;
  } finally {
    if (isStillCurrent()) {
      setLoading?.(false);
    }
  }
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
