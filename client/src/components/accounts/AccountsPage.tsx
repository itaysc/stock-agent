import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Account, AccountList } from '../../api/account-types';
import { currentAccountId, switchAccount } from '../../lib/account';
import { syncSummary } from '../../lib/sync';
import { DeleteModal, RenameModal } from './AccountModals';
import { useAuth } from '../auth/AuthGate';
import { AddAccountForm } from './AddAccountForm';
import { UsersPanel } from './UsersPanel';
import { alpacaAuthApi } from '../../api/alpaca-auth-api';
import { AlpacaButton } from '../auth/AlpacaButton';

/** Your Alpaca accounts: which one the app shows, and adding, renaming or deleting them. */
export function AccountsPage() {
  const [list, setList] = useState<AccountList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [alpacaLogin, setAlpacaLogin] = useState(false);
  useEffect(() => {
    void alpacaAuthApi.status().then(
      (s) => setAlpacaLogin(s.enabled),
      () => undefined,
    );
  }, []);
  const { user } = useAuth();
  const viewing = currentAccountId() ?? list?.accounts[0]?.id;

  const load = useCallback(async () => {
    try {
      setList(await api.accounts());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (!list) return error ? <Alert color="red">{error}</Alert> : <Loader />;

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Stack gap="sm">
        <Title order={4} visibleFrom="sm">
          Accounts
        </Title>
        <Text size="sm" c="dimmed">
          Every account keeps trading on its own. Switching only changes what the app shows.
        </Text>
        {notice && (
          <Alert color="teal" withCloseButton onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        {!list.accounts.length && (
          <Alert color="blue">No account yet: add your Alpaca paper key to start.</Alert>
        )}
        {list.accounts.map((a) => (
          <Paper key={a.id} p="md" withBorder>
            <Group justify="space-between" wrap="wrap" gap="xs">
              <div style={{ minWidth: 0 }}>
                <Group gap="xs" wrap="wrap">
                  <Text fw={700}>{a.name}</Text>
                  {a.id === viewing && <Badge color="teal">Viewing</Badge>}
                  <Badge variant="light" color={a.paper ? 'blue' : 'red'}>
                    {a.paper ? 'Paper' : 'Live'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {a.id} · {a.auth === 'oauth' ? 'connected with Alpaca' : `key …${a.keyHint}`}
                  {user?.admin && a.owner && a.owner !== user.email && ` · ${a.owner}'s`}
                </Text>
              </div>
              <Group gap="xs" wrap="nowrap">
                {a.id !== viewing && (
                  <Button size="xs" variant="light" onClick={() => switchAccount(a.id)}>
                    Switch
                  </Button>
                )}
                <Tooltip label="Rename">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setRenaming(a)}
                    aria-label={`Rename ${a.name}`}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => setDeleting(a)}
                    aria-label={`Delete ${a.name}`}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>
      <Stack gap="lg">
        <Paper p="md" withBorder>
          <Title order={5} mb="sm">
            Add a paper account
          </Title>
          {alpacaLogin && (
            <Stack gap={6} mb="md">
              <AlpacaButton mode="connect" label="Connect with Alpaca" />
              <Text size="xs" c="dimmed" ta="center">
                Sign in to Alpaca and approve: no key to copy. Or paste a key below.
              </Text>
            </Stack>
          )}
          <AddAccountForm
            canAdd={list.canAdd}
            onAdded={(a) => {
              const note = `Added "${a.name}". ${
                a.synced
                  ? syncSummary(a.synced)
                  : 'Its stocks could not be read yet: press Sync Data on the Trade page.'
              }`;
              // The first account: show it right away.
              if (!list.accounts.length) switchAccount(a.id, note);
              else {
                setNotice(note);
                void load();
              }
            }}
          />
        </Paper>
        {user?.admin && <UsersPanel />}
      </Stack>
      <RenameModal account={renaming} onClose={() => setRenaming(null)} onDone={load} />
      <DeleteModal
        account={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => {
          if (deleting?.id === viewing) window.location.reload();
          else void load();
        }}
      />
    </SimpleGrid>
  );
}
