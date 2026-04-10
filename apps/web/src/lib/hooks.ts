'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from './api';

type UseQueryResult<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useQuery<T>(
  path: string | null,
  params?: Record<string, string | number | boolean | undefined | null>,
): UseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const paramsKey = params ? JSON.stringify(params) : '';

  useEffect(() => {
    if (!path) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    apiFetch<T>(path, { params })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Error de conexión'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, isLoading, error, refetch };
}

type UseMutationResult<TInput, TOutput> = {
  mutate: (input: TInput) => Promise<TOutput>;
  isLoading: boolean;
  error: string | null;
};

export function useMutation<TInput = unknown, TOutput = unknown>(
  path: string,
  method = 'POST',
): UseMutationResult<TInput, TOutput> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<TOutput>(path, { method, body: input });
      return result;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Error de conexión';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [path, method]);

  return { mutate, isLoading, error };
}
