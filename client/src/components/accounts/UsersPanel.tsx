import {
  ActionIcon,
  Alert,
  Button,
  Code,
  CopyButton,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import type { NewInvite, UsersView } from '../../api/account-types';
import { inviteLink, usersApi } from '../../api/users-api';

/** The admin's users: invite someone with a one-time link, cancel invites, remove users. */
export function UsersPanel() {
  const [view, setView] = useState<UsersView | null>(null);
  const [note, setNote] = useState('');
  const [made, setMade] = useState<NewInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setView(await usersApi.list());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const invite = () =>
    act(async () => {
      setMade(await usersApi.invite(note));
      setNote('');
    });

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Title order={5}>Users</Title>
        <Text size="sm" c="dimmed">
          Invite someone with a one-time link (works for 7 days). They pick their own login and add
          their own Alpaca account; you can see everyone's.
        </Text>
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            label="Who is it for?"
            placeholder="e.g. Dana"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            maxLength={60}
            style={{ flex: 1 }}
          />
          <Button onClick={() => void invite()}>Create link</Button>
        </Group>
        {made && (
          <Alert color="teal" title={`Invite link${made.note ? ` for ${made.note}` : ''}`}>
            <Group gap="xs" wrap="nowrap">
              <Code style={{ overflowWrap: 'anywhere' }}>{inviteLink(made.token)}</Code>
              <CopyButton value={inviteLink(made.token)}>
                {({ copied, copy }) => (
                  <ActionIcon variant="subtle" onClick={copy} aria-label="Copy the link">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" mt={4}>
              Send it to them yourself. It is shown only now and works once.
            </Text>
          </Alert>
        )}
        {error && <Alert color="red">{error}</Alert>}
        {view?.invites.map((i) => (
          <Group key={i.id} justify="space-between" wrap="nowrap">
            <Text size="sm">
              Invite{i.note ? ` for ${i.note}` : ''}:{' '}
              <Text span c={i.expired ? 'red' : 'dimmed'} size="sm">
                {i.expired ? 'expired' : `open until ${new Date(i.expiresAt).toLocaleDateString()}`}
              </Text>
            </Text>
            <Tooltip label="Cancel the invite">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Cancel the invite"
                onClick={() => void act(() => usersApi.revokeInvite(i.id))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
        {view?.users.map((u) => (
          <Group key={u.email} justify="space-between" wrap="nowrap">
            <Text size="sm">
              {u.email}{' '}
              <Text span c="dimmed" size="xs">
                joined {new Date(u.joinedAt).toLocaleDateString()}
              </Text>
            </Text>
            <Tooltip label="Remove the user (delete their accounts first)">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remove ${u.email}`}
                onClick={() => void act(() => usersApi.remove(u.email))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
        {view && !view.users.length && !view.invites.length && (
          <Text size="sm" c="dimmed">
            Nobody else yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
