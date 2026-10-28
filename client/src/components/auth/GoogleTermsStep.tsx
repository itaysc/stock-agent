import { Alert, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { type GooglePending, googleAuthApi } from '../../api/google-auth-api';
import { AcceptTerms } from '../../legal/AcceptTerms';

/** After signing up with Google: the one more step, accepting the terms. */
export function GoogleTermsStep({
  pending,
  onDone,
}: {
  pending: GooglePending;
  onDone: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await googleAuthApi.complete(agreed);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Center h="100vh" p="md">
      <Paper withBorder p="xl" w={400} maw="100%">
        <form onSubmit={(e) => void submit(e)}>
          <Stack gap="md">
            <Stack gap={4} align="center">
              <Title order={3}>{pending.name ? `Welcome, ${pending.name}` : 'One more step'}</Title>
              <Text size="sm" c="dimmed" ta="center">
                You&apos;re signing up with your Google account <b>{pending.email}</b>. You start
                with a paper account of $100,000 in virtual cash.
              </Text>
            </Stack>
            <AcceptTerms checked={agreed} onChange={setAgreed} />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" size="md" loading={busy} fullWidth disabled={!agreed}>
              Create my user
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              Next time, just press Continue with Google.
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
