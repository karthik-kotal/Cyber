import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type ApiErrorCode } from '../services/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

/**
 * Generic data-fetching hook. All pages use this so loading/empty/error states
 * behave the same app-wide. Requests are aborted on unmount.
 */
export function useApiData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = []
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'TIMEOUT') {
            // treat as error, not silent
            setError(err);
          } else {
            setError(err);
          }
        } else {
          setError(new ApiError('UNKNOWN' satisfies ApiErrorCode, 'Something went wrong.'));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((v) => v + 1), []);

  return { data, loading, error, refresh };
}
