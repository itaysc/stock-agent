import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconChartLine, IconLock } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { api } from '../../api/client';

/** Email and password; the server answers with a JWT in an httpOnly cookie. */
export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
              <ThemeIcon
                size={44}
                radius="md"
                variant="gradient"
                gradient={{ from: 'indigo', to: 'cyan' }}
              >
                <IconChartLine size={26} />
              </ThemeIcon>
              <Title order={3}>Stock Invest</Title>
              <Text size="sm" c="dimmed">
                Log in to your paper broker
              </Text>
            </Stack>
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
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
