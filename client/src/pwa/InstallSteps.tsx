import { List, Modal, Text, ThemeIcon } from '@mantine/core';
import { IconShare2, IconSquarePlus } from '@tabler/icons-react';

/** iPhone/iPad have no install button: the steps to add the app to the home screen. */
export function InstallSteps({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Add Bullwether to your home screen">
      <List spacing="md" size="sm" type="ordered">
        <List.Item>
          Tap{' '}
          <ThemeIcon size="sm" variant="light" style={{ verticalAlign: 'middle' }}>
            <IconShare2 size={14} />
          </ThemeIcon>{' '}
          <b>Share</b> in Safari&apos;s bar.
        </List.Item>
        <List.Item>
          Scroll down and tap{' '}
          <ThemeIcon size="sm" variant="light" style={{ verticalAlign: 'middle' }}>
            <IconSquarePlus size={14} />
          </ThemeIcon>{' '}
          <b>Add to Home Screen</b>, then <b>Add</b>.
        </List.Item>
      </List>
      <Text size="xs" c="dimmed" mt="md">
        It then opens full screen from its icon, like an app.
      </Text>
    </Modal>
  );
}
