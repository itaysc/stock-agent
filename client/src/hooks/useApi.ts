import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { BacktestOptions, ReportItem } from '../api/types';

const RETRY_MS = 2_000;
const MAX_WAIT_MS = 3 * 60_000;

/**
 * Loads the backtest options. While the server is unreachable (e.g. still
 * starting) it keeps retrying for a few minutes instead of failing at once.
 */
export function useOptions() {
  const [options, setOptions] = useState<BacktestOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const load = () => {
      api.options().then(
        (result) => {
          if (cancelled) return;
          setOptions(result);
          setWaiting(false);
        },
        (err: ApiError) => {
          if (cancelled) return;
          if (err.unreachable && Date.now() - started < MAX_WAIT_MS) {
            setWaiting(true);
            timer = setTimeout(load, RETRY_MS);
          } else {
            setWaiting(false);
            setError(err.message);
          }
        },
      );
    };
    setError(null);
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { options, error, waiting, retry };
}

export function useReports() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const refresh = useCallback(() => {
    api.reports().then(setReports, () => setReports([]));
  }, []);
  useEffect(refresh, [refresh]);
  return { reports, refresh };
}
