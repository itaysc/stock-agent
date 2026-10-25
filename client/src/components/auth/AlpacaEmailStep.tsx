import { Alert, Button, Center, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { type FormEvent, useState } from 'react';
import { alpacaAuthApi } from '../../api/alpaca-auth-api';

/** After signing up with Alpaca: the one more step, the user's email (Alpaca doesn't share it). */
export function AlpacaEmailStep({ account, onDone }: { account: string; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await alpacaAuthApi.complete(email);
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
              <Title order={3}>One more step</Title>
              <Text size="sm" c="dimmed" ta="center">
                Your Alpaca account <b>{account}</b> is connected. What&apos;s your email?
              </Text>
            </Stack>
            <TextInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" size="md" loading={busy} fullWidth>
              Continue
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              Next time, just press Log in with Alpaca.
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
