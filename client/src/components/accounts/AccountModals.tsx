import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Account } from '../../api/account-types';
import { ModalActions } from '../shared/StickyAction';

/** Renames an account. */
export function RenameModal({
  account,
  onClose,
  onDone,
}: {
  account: Account | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setName(account?.name ?? '');
    setError(null);
  }, [account]);
  const save = async () => {
    if (!account) return;
    try {
      await api.renameAccount(account.id, name);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal opened={!!account} onClose={onClose} title="Rename account">
      <Stack>
        <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={60} />
        {error && <Alert color="red">{error}</Alert>}
        <Button onClick={() => void save()} disabled={!name.trim()}>
          Save
        </Button>
      </Stack>
    </Modal>
  );
}

/** Deletes an account (the server refuses while its investments run). */
export function DeleteModal({
  account,
  onClose,
  onDone,
}: {
  account: Account | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [account]);
  const remove = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await api.deleteAccount(account.id);
      onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={!!account} onClose={onClose} title={`Delete "${account?.name}"?`}>
      <Stack>
        <Text size="sm">
          {account?.auth === 'sim'
            ? 'Its virtual cash, stocks and history are deleted. You can open a new paper account afterwards.'
            : 'The app forgets this account and its key. Its shares and cash stay in Alpaca, and its records stay in the database (they come back if you add the account again).'}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <ModalActions>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={busy} onClick={() => void remove()}>
            Delete
          </Button>
        </ModalActions>
      </Stack>
    </Modal>
  );
}
