import { Alert, Center, Drawer, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { ResearchSession } from '../../api/research-types';
import { ResearchView } from '../results/ResearchView';

/** The agent's reasoning for one research session: every round, test and check, live while it runs. */
export function ResearchDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setSession(null);
    setError(null);
    if (!id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let gone = false;
    const load = () =>
      api.research(id).then(
        (s) => {
          if (gone) return;
          setSession(s);
          if (s.status === 'running') timer = setTimeout(() => void load(), 4_000);
        },
        (err: Error) => !gone && setError(err.message),
      );
    void load();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [id]);
  return (
    <Drawer
      opened={!!id}
      onClose={onClose}
      position="right"
      size="min(1100px, 100%)"
      title="The agent's reasoning"
    >
      {error ? (
        <Alert color="red">{error}</Alert>
      ) : session ? (
        <ResearchView session={session} />
      ) : (
        <Center h={200}>
          <Loader />
        </Center>
      )}
    </Drawer>
  );
}
