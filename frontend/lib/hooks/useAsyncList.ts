"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/http";

type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Fetches async data whenever `deps` change, with loading + error state.
 * State is only ever set inside async callbacks (never synchronously in
 * the effect body), which satisfies the `react-hooks/set-state-in-effect`
 * lint rule. Keeps the previous data visible during refetches.
 */
export function useAsyncList<T>(fetcher: Fetcher<T>, deps: unknown[]) {
  const [data, setData] = useState<T>([] as unknown as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(() => {
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return controller;
  }, []);

  useEffect(() => {
    const controller = reload();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, setData, reload };
}
