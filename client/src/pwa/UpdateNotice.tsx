import { Button, Group, Paper, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { applyUpdate, UPDATE_READY } from './pwa';

/** "A new version is ready": a small card at the bottom; Reload switches to it. */
export function UpdateNotice() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const show = () => setReady(true);
    window.addEventListener(UPDATE_READY, show);
    return () => window.removeEventListener(UPDATE_READY, show);
  }, []);
  if (!ready) return null;
  return (
    <Paper
      shadow="lg"
      p="sm"
      withBorder
      pos="fixed"
      left={16}
      right={16}
      maw={420}
      mx="auto"
      // Above the phone's tab bar and sticky actions.
      bottom="calc(env(safe-area-inset-bottom) + 64px + var(--sticky-cta, 0px) + 12px)"
      style={{ zIndex: 300 }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">A new version of Bullwether is ready.</Text>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant="subtle" color="gray" onClick={() => setReady(false)}>
            Later
          </Button>
          <Button size="xs" leftSection={<IconRefresh size={14} />} onClick={applyUpdate}>
            Reload
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
