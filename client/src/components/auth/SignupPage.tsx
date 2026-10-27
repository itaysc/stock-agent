import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { type FormEvent, useEffect, useState } from 'react';
import { usersApi } from '../../api/users-api';
import { AcceptTerms } from '../../legal/AcceptTerms';

const MIN_PASSWORD = 10;

/** Joining with an invite link: your email and a password, then you're logged in. */
export function SignupPage({ token, onDone }: { token: string; onDone: () => void }) {
  const [valid, setValid] = useState<true | string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void usersApi.checkInvite(token).then(
      () => setValid(true),
      (e: Error) => setValid(e.message),
    );
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) return setError("The two passwords don't match");
    setBusy(true);
    setError(null);
    try {
      await usersApi.signUp({ token, email, password, acceptTerms: agreed });
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
        <Stack gap="md">
          <Stack gap={4} align="center">
            <Title order={3}>Join Bullwether</Title>
            <Text size="sm" c="dimmed" ta="center">
              You were invited. Pick your login, then add your own Alpaca paper account.
            </Text>
          </Stack>
          {valid === null ? (
            <Text size="sm">Checking the invite…</Text>
          ) : valid !== true ? (
            <Alert color="red">{valid}</Alert>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Password"
                  description={`At least ${MIN_PASSWORD} characters`}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Password again"
                  autoComplete="new-password"
                  required
                  value={again}
                  onChange={(e) => setAgain(e.currentTarget.value)}
                />
                <AcceptTerms checked={agreed} onChange={setAgreed} />
                {error && <Alert color="red">{error}</Alert>}
                <Button type="submit" loading={busy} fullWidth disabled={!agreed}>
                  Create my login
                </Button>
              </Stack>
            </form>
          )}
          <Anchor size="xs" ta="center" href="/">
            I already have a login
          </Anchor>
        </Stack>
      </Paper>
    </Center>
  );
}
