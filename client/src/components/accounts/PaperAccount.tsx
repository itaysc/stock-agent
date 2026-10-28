import { Alert, Button, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { Account } from '../../api/account-types';
import { api } from '../../api/client';
import { switchAccount } from '../../lib/account';
import { ModalActions } from '../shared/StickyAction';

/** A new paper account's virtual cash (as on the server). */
const STARTING = '$100,000';

/** Opens a Bullwether paper account: virtual money, real prices, no Alpaca account needed. */
export function OpenPaperCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await api.openPaper();
      switchAccount(a.id, `Your paper account is open, with ${STARTING} of virtual cash.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Paper p="md" withBorder>
      <Title order={5} mb={6}>
        Practice with virtual money
      </Title>
      <Text size="sm" c="dimmed" mb="sm">
        A Bullwether paper account starts with {STARTING} of virtual cash. Prices are real; the
        money and the trades are not. No Alpaca account needed.
      </Text>
      {error && (
        <Alert color="red" mb="sm">
          {error}
        </Alert>
      )}
      <Button fullWidth loading={busy} onClick={() => void open()}>
        Open a paper account
      </Button>
    </Paper>
  );
}

/** Back to the starting cash: no stocks, no history (a fresh account in its place). */
export function ResetModal({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [account]);
  const reset = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const fresh = await api.resetPaper(account.id);
      switchAccount(fresh.id, `"${fresh.name}" starts again with ${STARTING} of virtual cash.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal opened={!!account} onClose={onClose} title={`Reset "${account?.name}"?`}>
      <Stack>
        <Text size="sm">
          Back to {STARTING} of virtual cash, with no stocks. Its orders, investments and history
          are cleared. Stop any investment running in it first.
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <ModalActions>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" loading={busy} onClick={() => void reset()}>
            Reset
          </Button>
        </ModalActions>
      </Stack>
    </Modal>
  );
}
