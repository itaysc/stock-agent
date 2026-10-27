import {
  Alert,
  Button,
  Center,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { api } from '../../api/client';
import { launch } from '../../lib/launch';
import { AppLogo } from '../AppLogo';
import { AlpacaButton } from './AlpacaButton';
import { GoogleButton } from './GoogleButton';
import { LegalLinks } from '../../legal/LegalLinks';

/** Email and password; the server answers with a JWT in an httpOnly cookie. */
export function LoginPage({
  onLoggedIn,
  alpaca,
  google,
}: {
  onLoggedIn: () => void;
  /** Log in with Alpaca is set up on the server. */
  alpaca: boolean;
  /** Continue with Google is set up on the server. */
  google: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Coming back from Alpaca or Google with a problem: say what it was.
  const [error, setError] = useState<string | null>(launch.authError ?? launch.alpacaError);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      setPassword('');
      onLoggedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Center h="100vh" p="md">
      <Paper withBorder p="xl" w={380} maw="100%">
        <form onSubmit={(e) => void submit(e)}>
          <Stack gap="md">
            <Stack gap={4} align="center">
              <AppLogo size={48} />
              <Title order={3}>Bullwether</Title>
              <Text size="sm" c="dimmed">
                Log in to your paper broker
              </Text>
            </Stack>
            {google && <GoogleButton />}
            {alpaca && (
              <>
                <AlpacaButton mode="login" label="Log in with Alpaca" />
                <Text size="xs" c="dimmed" ta="center" mt={-8}>
                  New here? It creates your user from your Alpaca paper account.
                </Text>
              </>
            )}
            {(google || alpaca) && <Divider label="or with your email" labelPosition="center" />}
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {error && (
              <Alert color="red" icon={<IconLock size={16} />}>
                {error}
              </Alert>
            )}
            <Button type="submit" loading={busy} fullWidth>
              Log in
            </Button>
            <LegalLinks note="Not investment advice" />
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
