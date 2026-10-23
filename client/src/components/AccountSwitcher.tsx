import { Button, Menu, Text } from '@mantine/core';
import { IconCheck, IconChevronDown, IconSettings, IconUserCircle } from '@tabler/icons-react';
import type { Account } from '../api/account-types';
import { currentAccountId, switchAccount } from '../lib/account';

/** The account the app shows, with a menu to switch or manage accounts (on a phone: in the menu drawer). */
export function AccountSwitcher({
  accounts,
  onManage,
}: {
  accounts: Account[];
  onManage: () => void;
}) {
  const viewing = accounts.find((a) => a.id === currentAccountId()) ?? accounts[0];
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          variant="default"
          size="xs"
          px={8}
          leftSection={<IconUserCircle size={16} />}
          rightSection={<IconChevronDown size={14} />}
          maw={180}
          aria-label="Switch account"
        >
          <Text size="xs" truncate>
            {viewing?.name ?? 'No account'}
          </Text>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Show account</Menu.Label>
        {accounts.map((a) => (
          <Menu.Item
            key={a.id}
            leftSection={
              a.id === viewing?.id ? <IconCheck size={14} /> : <span style={{ width: 14 }} />
            }
            onClick={() => a.id !== viewing?.id && switchAccount(a.id)}
          >
            {a.name}
            {a.name !== a.id && (
              <Text size="xs" c="dimmed">
                {a.id}
              </Text>
            )}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconSettings size={14} />} onClick={onManage}>
          Manage accounts
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
