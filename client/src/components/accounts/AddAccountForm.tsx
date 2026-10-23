import {
  Alert,
  Anchor,
  Button,
  Code,
  List,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { api } from '../../api/client';
import type { AddedAccount } from '../../api/account-types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { StickyAction } from '../shared/StickyAction';

/** Add a paper account by its API key: the server checks it with Alpaca, then saves it encrypted. */
export function AddAccountForm({
  canAdd,
  onAdded,
}: {
  canAdd: boolean;
  onAdded: (a: AddedAccount) => void;
}) {
  const mobile = useIsMobile();
  const [name, setName] = useState('');
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canAdd)
    return (
      <Alert color="yellow" title="Adding accounts is off">
        <Text size="sm">
          The server needs one secret (set once, for all users) to encrypt the API keys added here.
          Run this in a terminal in the project folder, then restart the server:
        </Text>
        <Code block mt="xs">
          echo "ACCOUNTS_SECRET_KEY=$(openssl rand -base64 32)" &gt;&gt; server/.env
        </Code>
        <Text size="xs" c="dimmed" mt="xs">
          Any random text of 32+ characters works. On Railway, add the same variable. Keep it safe:
          without it the saved keys can't be read.
        </Text>
      </Alert>
    );

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await api.addAccount({ name, keyId, secret });
      setName('');
      setKeyId('');
      setSecret('');
      onAdded(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Paper accounts only for now. Where to find a key:
      </Text>
      <List size="sm" type="ordered">
        <List.Item>
          Open{' '}
          <Anchor href="https://app.alpaca.markets" target="_blank" rel="noreferrer">
            app.alpaca.markets
          </Anchor>{' '}
          and switch to the paper account you want (top left).
        </List.Item>
        <List.Item>Under API Keys, press Generate (or Regenerate).</List.Item>
        <List.Item>Copy the Key (starts with PK) and the Secret (shown only once).</List.Item>
      </List>
      <TextInput
        label="Name"
        placeholder="e.g. Paper 2"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        maxLength={60}
      />
      <TextInput
        label="API key ID"
        placeholder="PK..."
        value={keyId}
        onChange={(e) => setKeyId(e.currentTarget.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <PasswordInput
        label="Secret"
        value={secret}
        onChange={(e) => setSecret(e.currentTarget.value)}
        autoComplete="new-password"
      />
      {error && <Alert color="red">{error}</Alert>}
      <StickyAction>
        <Button
          size={mobile ? 'md' : 'sm'}
          onClick={() => void add()}
          loading={busy}
          disabled={!keyId.trim() || !secret.trim()}
        >
          Check and add
        </Button>
      </StickyAction>
      <Text size="xs" c="dimmed">
        The stocks and open orders already in the account show on the Trade page. The key is checked
        with Alpaca, then stored encrypted on the server. It is never shown again: only its last 4
        characters.
      </Text>
    </Stack>
  );
}
