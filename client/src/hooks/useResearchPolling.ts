import { useEffect } from 'react';
import { api } from '../api/client';
import type { ResearchSession } from '../api/research-types';

const POLL_MS = 2_000;

/** While a research session runs, fetches it every 2 s and hands over each update. */
export function useResearchPolling(
  session: ResearchSession | null,
  onUpdate: (session: ResearchSession) => void,
) {
  const id = session?.status === 'running' ? session.id : null;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const timer = setInterval(() => {
      api.research(id).then(
        (next) => !cancelled && onUpdate(next),
        () => undefined, // keep trying (e.g. the server is restarting)
      );
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, onUpdate]);
}
