import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LivePrices } from '../lib/live';

/**
 * ~Live prices of some stocks: fetched on opening (and when the list
 * changes), then every `everyMs`. A new `round` (bumped by "Refresh now")
 * fetches at once, skipping the server's one-minute cache, and restarts the
 * timer. Failed fetches keep the last prices.
 */
export function useLivePrices(symbols: string[], everyMs: number, round = 0) {
  const [prices, setPrices] = useState<LivePrices>({});
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const key = [...new Set(symbols)].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let fresh = round > 0;
    const fetchLive = () =>
      void api.brokerPrices(key.split(','), fresh).then(
        (r) => {
          setPrices(r.prices);
          setCheckedAt(new Date());
        },
        () => undefined,
      );
    fetchLive();
    fresh = false;
    const timer = setInterval(fetchLive, everyMs);
    return () => clearInterval(timer);
  }, [key, everyMs, round]);
  return {
    prices,
    checkedAt,
    nextAt: key && checkedAt ? new Date(checkedAt.getTime() + everyMs) : null,
  };
}
